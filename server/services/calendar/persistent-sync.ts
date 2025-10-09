import { consola } from 'consola';
import { PrismaClient } from '@prisma/client';
import { CalendarAdapter, CalendarEvent, CalendarSource, CalendarSyncConfig, CalendarSyncResult } from '~/lib/calendar/types';
import { ICSAdapter } from './adapters/ics';
import { CalDAVAdapter } from './adapters/caldav';
import { CalendarSourceManager } from './source-manager';
import { createHash } from 'crypto';

/**
 * Persistent Calendar Sync Service
 * Manages background synchronization with database persistence
 */

interface SyncMetadata {
  etag?: string;
  ctag?: string;
  syncToken?: string;
}

export class PersistentCalendarSyncService {
  private adapters: Map<string, CalendarAdapter> = new Map();
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private prisma: PrismaClient;
  private sourceManager: CalendarSourceManager;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.sourceManager = new CalendarSourceManager(prisma);
    this.registerAdapters();
  }

  private registerAdapters(): void {
    this.adapters.set('ics', new ICSAdapter());
    this.adapters.set('caldav', new CalDAVAdapter());
  }

  /**
   * Bootstrap sources and start sync service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      consola.warn('Calendar sync service is already running');
      return;
    }

    if (process.env.CALENDAR_SYNC_ENABLED !== 'true') {
      consola.info('Calendar sync is disabled');
      return;
    }

    consola.info('Starting persistent calendar sync service...');

    // Bootstrap sources from environment
    await this.sourceManager.bootstrapSources();

    // Get all sources from database
    const sources = await this.sourceManager.getAllSources();
    if (sources.length === 0) {
      consola.warn('No calendar sources found');
      return;
    }

    this.isRunning = true;
    const intervalSeconds = parseInt(process.env.ICS_SYNC_INTERVAL_SECONDS || '900', 10);

    // Initial sync
    await this.syncAllSources(sources);

    // Schedule periodic sync
    this.syncInterval = setInterval(
      () => this.syncAllSources(sources),
      intervalSeconds * 1000
    );

    consola.info(`Calendar sync service started (interval: ${intervalSeconds}s, sources: ${sources.length})`);
  }

  async stop(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isRunning = false;
    consola.info('Calendar sync service stopped');
  }

  /**
   * Sync all sources - handles no sources gracefully
   */
  async syncAll(): Promise<CalendarSyncResult[]> {
    try {
      const sources = await this.sourceManager.getAllSources();
      
      if (sources.length === 0) {
        consola.info('No calendar sources configured for sync');
        return [];
      }
      
      consola.info(`Syncing ${sources.length} calendar sources`);
      return await this.syncAllSources(sources);
    } catch (error) {
      consola.error('Failed to sync all sources:', error);
      return [];
    }
  }

  async syncAllSources(sources: any[]): Promise<CalendarSyncResult[]> {
    const results: CalendarSyncResult[] = [];
    
    for (const source of sources) {
      try {
        const result = await this.syncSource(source);
        results.push(result);
      } catch (error) {
        consola.error(`Failed to sync source ${source.name}:`, error);
        results.push({
          sourceId: source.id,
          success: false,
          eventsCount: 0,
          newEvents: 0,
          updatedEvents: 0,
          errors: [error instanceof Error ? error.message : String(error)],
          duration: 0,
        });
      }
    }

    return results;
  }

  async syncSource(source: any): Promise<CalendarSyncResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      consola.debug(`Syncing calendar source: ${source.name} (${source.type})`);

      const adapter = this.adapters.get(source.type);
      if (!adapter) {
        throw new Error(`No adapter found for source type: ${source.type}`);
      }

      // Get current sync metadata
      const syncMetadata = {
        etag: source.etag,
        ctag: source.ctag,
        syncToken: source.syncToken,
      };

      // Convert database source to adapter format
      const adapterSource = this.convertToAdapterSource(source);

      // Validate source before syncing
      const isValid = await adapter.validateSource(adapterSource);
      if (!isValid) {
        throw new Error(`Source validation failed for ${source.name}`);
      }

      // Fetch events from source with conditional requests
      const events = await adapter.fetchEvents(adapterSource);
      
      // Store events in database atomically
      const { newEvents, updatedEvents } = await this.storeEvents(source.id, events);

      // Update sync metadata
      await this.sourceManager.updateSyncMetadata(source.id, {
        lastSyncAt: new Date(),
        errorCount: 0,
      });

      // Create audit log entry
      await this.createAuditLog(source.id, 'sync', 'system', {
        eventsCount: events.length,
        newEvents,
        updatedEvents,
      });

      const duration = Date.now() - startTime;
      
      consola.debug(`Synced ${source.name}: ${events.length} events (${newEvents} new, ${updatedEvents} updated)`);

      return {
        sourceId: source.id,
        success: true,
        eventsCount: events.length,
        newEvents,
        updatedEvents,
        errors,
        duration,
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(errorMessage);

      // Update error metadata
      await this.sourceManager.updateSyncMetadata(source.id, {
        lastErrorAt: new Date(),
        errorCount: (source.errorCount || 0) + 1,
      });

      consola.error(`Sync failed for ${source.name}:`, errorMessage);

      return {
        sourceId: source.id,
        success: false,
        eventsCount: 0,
        newEvents: 0,
        updatedEvents: 0,
        errors,
        duration,
      };
    }
  }

  /**
   * Convert database source to adapter format
   */
  private convertToAdapterSource(source: any): CalendarSource {
    return {
      id: source.id,
      name: source.name,
      type: source.type,
      color: source.color,
      enabled: true,
      url: source.serverUrl,
      credentials: source.type === 'caldav' ? {
        username: source.username,
        password: source.password,
        serverUrl: source.serverUrl,
      } : undefined,
    };
  }

  /**
   * Store events in database with deduplication
   */
  private async storeEvents(sourceId: string, events: CalendarEvent[]): Promise<{ newEvents: number; updatedEvents: number }> {
    let newEvents = 0;
    let updatedEvents = 0;

    for (const event of events) {
      try {
        // Generate stable UID if missing
        const uid = event.uid || this.generateSyntheticUID(event);
        
        // Create unique key for deduplication
        const uniqueKey = {
          sourceId,
          uid,
          recurrenceId: event.recurrenceId || null,
          start: event.start,
          end: event.end,
        };

        // Check if event exists
        const existing = await this.prisma.calendarEvent.findFirst({
          where: uniqueKey
        });

        if (existing) {
          // Check if content changed
          const contentChanged = this.hasContentChanged(existing, event);
          
          if (contentChanged) {
            await this.prisma.calendarEvent.update({
              where: { id: existing.id },
              data: {
                title: event.title,
                description: event.description,
                location: event.location,
                start: event.start,
                end: event.end,
                allDay: event.allDay,
                status: event.status,
                lastRemoteEtag: event.lastRemoteEtag,
                version: existing.version + 1,
                updatedAt: new Date(),
              }
            });
            updatedEvents++;
          }
        } else {
          // Create new event
          await this.prisma.calendarEvent.create({
            data: {
              sourceId,
              uid,
              recurrenceId: event.recurrenceId,
              lastRemoteEtag: event.lastRemoteEtag,
              title: event.title,
              description: event.description,
              location: event.location,
              start: event.start,
              end: event.end,
              allDay: event.allDay,
              status: event.status,
              version: 1,
            }
          });
          newEvents++;
        }
      } catch (error) {
        consola.warn(`Failed to store event: ${event.title}`, error);
      }
    }

    return { newEvents, updatedEvents };
  }

  /**
   * Generate synthetic UID for events without UID
   */
  private generateSyntheticUID(event: CalendarEvent): string {
    const content = `${event.title}|${event.start.toISOString()}|${event.end.toISOString()}|${event.location || ''}`;
    return createHash('sha1').update(content).digest('hex');
  }

  /**
   * Check if event content has changed
   */
  private hasContentChanged(existing: any, event: CalendarEvent): boolean {
    return (
      existing.title !== event.title ||
      existing.description !== event.description ||
      existing.location !== event.location ||
      existing.start.getTime() !== event.start.getTime() ||
      existing.end.getTime() !== event.end.getTime() ||
      existing.allDay !== event.allDay ||
      existing.status !== event.status
    );
  }

  /**
   * Create audit log entry
   */
  private async createAuditLog(sourceId: string, op: string, actor: string, data: any) {
    await this.prisma.calendarAudit.create({
      data: {
        sourceId,
        op,
        actor,
        after: data,
        at: new Date(),
      }
    });
  }

  async getStatus(): Promise<{ running: boolean; sources: number }> {
    const sources = await this.sourceManager.getAllSources();
    return {
      running: this.isRunning,
      sources: sources.length,
    };
  }

  /**
   * Get events for a specific source
   */
  async getSourceEvents(sourceId: string, startDate?: Date, endDate?: Date) {
    const where: any = { sourceId };
    
    if (startDate && endDate) {
      where.start = {
        gte: startDate,
        lte: endDate,
      };
    }

    return this.prisma.calendarEvent.findMany({
      where,
      include: {
        source: true,
        users: {
          include: {
            user: true,
          },
        },
      },
      orderBy: { start: 'asc' },
    });
  }

  /**
   * Get all events across all sources
   */
  async getAllEvents(startDate?: Date, endDate?: Date) {
    try {
      const where: any = {};
      
      if (startDate && endDate) {
        where.start = {
          gte: startDate,
          lte: endDate,
        };
      }

      return await this.prisma.calendarEvent.findMany({
        where,
        include: {
          source: true,
          users: {
            include: {
              user: true,
            },
          },
        },
        orderBy: { start: 'asc' },
      });
    } catch (error) {
      consola.error('Failed to fetch events from database:', error);
      return [];
    }
  }
}

