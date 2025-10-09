import { consola } from 'consola';
import { CalendarAdapter, CalendarEvent, CalendarSource, CalendarSyncConfig, CalendarSyncResult } from '~/lib/calendar/types';
import { ICSAdapter } from './adapters/ics';

/**
 * Calendar Sync Service
 * Manages background synchronization of calendar sources
 */

class CalendarSyncService {
  private adapters: Map<string, CalendarAdapter> = new Map();
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    this.registerAdapters();
  }

  private registerAdapters(): void {
    this.adapters.set('ics', new ICSAdapter());
    // TODO: Add CalDAV adapter in Phase 2
  }

  async start(config: CalendarSyncConfig): Promise<void> {
    if (this.isRunning) {
      consola.warn('Calendar sync service is already running');
      return;
    }

    if (!config.enabled) {
      consola.info('Calendar sync is disabled');
      return;
    }

    consola.info(`Starting calendar sync service (interval: ${config.intervalSeconds}s)`);
    this.isRunning = true;

    // Initial sync
    await this.syncAllSources(config.sources);

    // Schedule periodic sync
    this.syncInterval = setInterval(
      () => this.syncAllSources(config.sources),
      config.intervalSeconds * 1000
    );
  }

  async stop(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isRunning = false;
    consola.info('Calendar sync service stopped');
  }

  async syncAllSources(sources: CalendarSource[]): Promise<CalendarSyncResult[]> {
    const results: CalendarSyncResult[] = [];
    
    for (const source of sources) {
      if (!source.enabled) {
        continue;
      }

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

  async syncSource(source: CalendarSource): Promise<CalendarSyncResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      consola.debug(`Syncing calendar source: ${source.name} (${source.type})`);

      const adapter = this.adapters.get(source.type);
      if (!adapter) {
        throw new Error(`No adapter found for source type: ${source.type}`);
      }

      // Validate source before syncing
      const isValid = await adapter.validateSource(source);
      if (!isValid) {
        throw new Error(`Source validation failed for ${source.name}`);
      }

      // Fetch events from source
      const events = await adapter.fetchEvents(source);
      
      // TODO: Store events in database
      // For now, just log the events
      consola.debug(`Fetched ${events.length} events from ${source.name}`);

      const duration = Date.now() - startTime;
      
      return {
        sourceId: source.id,
        success: true,
        eventsCount: events.length,
        newEvents: events.length, // TODO: Calculate actual new/updated
        updatedEvents: 0,
        errors,
        duration,
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(errorMessage);

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

  async getStatus(): Promise<{ running: boolean; sources: number }> {
    return {
      running: this.isRunning,
      sources: this.adapters.size,
    };
  }
}

// Singleton instance
export const calendarSyncService = new CalendarSyncService();

// Auto-start if enabled
if (process.env.CALENDAR_SYNC_ENABLED === 'true') {
  const config = parseSyncConfig();
  if (config.enabled) {
    calendarSyncService.start(config).catch(error => {
      consola.error('Failed to start calendar sync service:', error);
    });
  }
}

function parseSyncConfig(): CalendarSyncConfig {
  const enabled = process.env.CALENDAR_SYNC_ENABLED === 'true';
  const intervalSeconds = parseInt(process.env.ICS_SYNC_INTERVAL_SECONDS || '900', 10);
  
  let sources: CalendarSource[] = [];
  
  try {
    const feedsJson = process.env.ICS_FEEDS;
    if (feedsJson) {
      const feeds = JSON.parse(feedsJson);
      sources = feeds.map((feed: any, index: number) => ({
        id: `ics-${index}`,
        name: feed.name || `Feed ${index + 1}`,
        type: 'ics' as const,
        color: feed.color || '#3B82F6',
        url: feed.url,
        enabled: true,
      }));
    }
  } catch (error) {
    consola.warn('Invalid ICS_FEEDS configuration, skipping calendar sync:', error);
  }

  return {
    enabled,
    intervalSeconds,
    sources,
  };
}
