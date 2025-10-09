import { consola } from 'consola';
import { CalendarEvent } from '~/lib/calendar/types';
import { PersistentCalendarSyncService } from './persistent-sync';
import { PrismaClient } from '@prisma/client';

/**
 * Event Merger Service
 * Merges events from different sources (local, ICS, CalDAV) with proper deduplication
 */

interface MergedEvent {
  id: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  allDay: boolean;
  color: string;
  location?: string;
  sourceType: 'local' | 'ics' | 'caldav';
  sourceName: string;
  users?: Array<{
    id: string;
    name: string;
    color?: string | null;
  }>;
}

export class EventMergerService {
  private static instance: EventMergerService;
  private eventCache: Map<string, MergedEvent[]> = new Map();
  private cacheTimeout = 30000; // 30 seconds
  private prisma: PrismaClient;
  private syncService: PersistentCalendarSyncService;

  constructor(prisma: PrismaClient, syncService: PersistentCalendarSyncService) {
    this.prisma = prisma;
    this.syncService = syncService;
  }

  static getInstance(prisma: PrismaClient, syncService: PersistentCalendarSyncService): EventMergerService {
    if (!EventMergerService.instance) {
      EventMergerService.instance = new EventMergerService(prisma, syncService);
    }
    return EventMergerService.instance;
  }

  async getMergedEvents(startDate: Date, endDate: Date): Promise<MergedEvent[]> {
    const cacheKey = `${startDate.toISOString()}-${endDate.toISOString()}`;
    
    // Check cache first
    if (this.eventCache.has(cacheKey)) {
      const cached = this.eventCache.get(cacheKey)!;
      consola.debug(`Using cached events: ${cached.length} events`);
      return cached;
    }

    try {
      // Get events from all sources
      const [localEvents, syncedEvents] = await Promise.all([
        this.getLocalEvents(startDate, endDate),
        this.getSyncedEvents(startDate, endDate),
      ]);

      // Merge and deduplicate events
      const mergedEvents = this.mergeEvents(localEvents, syncedEvents);
      
      // Sort by start time, then by source priority (local > caldav > ics)
      const sortedEvents = this.sortEvents(mergedEvents);

      // Cache the result
      this.eventCache.set(cacheKey, sortedEvents);
      
      // Clear cache after timeout
      setTimeout(() => {
        this.eventCache.delete(cacheKey);
      }, this.cacheTimeout);

      consola.debug(`Merged ${sortedEvents.length} events (${localEvents.length} local, ${syncedEvents.length} synced)`);
      return sortedEvents;

    } catch (error) {
      consola.error('Failed to merge events:', error);
      return [];
    }
  }

  private async getLocalEvents(startDate: Date, endDate: Date): Promise<MergedEvent[]> {
    try {
      // Get local events (events without a sourceId or with sourceId = 'local')
      const events = await this.prisma.calendarEvent.findMany({
        where: {
          start: {
            gte: startDate,
            lte: endDate,
          },
          OR: [
            { sourceId: null },
            { source: { type: 'local' } }
          ]
        },
        include: {
          users: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                },
              },
            },
          },
        },
        orderBy: {
          start: 'asc',
        },
      });

      return events.map(event => {
        // Get primary user color or use event color
        let eventColor = '#3B82F6'; // Default blue
        
        if (event.color) {
          if (typeof event.color === 'string') {
            eventColor = event.color;
          } else if (typeof event.color === 'object' && event.color.primary) {
            eventColor = event.color.primary;
          }
        } else if (event.users.length > 0) {
          // Use first user's color
          const userColor = event.users[0].user.color;
          if (userColor) {
            eventColor = userColor;
          }
        }

        return {
          id: event.id,
          title: event.title,
          description: event.description,
          start: event.start.toISOString(),
          end: event.end.toISOString(),
          allDay: event.allDay,
          color: eventColor,
          location: event.location,
          sourceType: 'local' as const,
          sourceName: 'Local',
          users: event.users.map(u => ({
            id: u.user.id,
            name: u.user.name,
            color: u.user.color,
          })),
        };
      });
    } catch (error) {
      consola.error('Failed to fetch local events:', error);
      return [];
    }
  }

  private async getSyncedEvents(startDate: Date, endDate: Date): Promise<MergedEvent[]> {
    try {
      // Get synced events from database
      const events = await this.syncService.getAllEvents(startDate, endDate);

      return events.map(event => {
        // Get source color or use default
        const eventColor = event.source?.color || '#2E7D32'; // Default green for synced events

        return {
          id: event.id,
          title: event.title,
          description: event.description,
          start: event.start.toISOString(),
          end: event.end.toISOString(),
          allDay: event.allDay,
          color: eventColor,
          location: event.location,
          sourceType: event.source?.type as 'ics' | 'caldav',
          sourceName: event.source?.name || 'Unknown Source',
          users: event.users.map(u => ({
            id: u.user.id,
            name: u.user.name,
            color: u.user.color,
          })),
        };
      });

    } catch (error) {
      consola.error('Failed to fetch synced events:', error);
      return [];
    }
  }

  private mergeEvents(localEvents: MergedEvent[], syncedEvents: MergedEvent[]): MergedEvent[] {
    const eventMap = new Map<string, MergedEvent>();

    // Add local events first (highest priority)
    for (const event of localEvents) {
      const key = this.getEventKey(event);
      eventMap.set(key, event);
    }

    // Add synced events (lower priority, won't override local)
    for (const event of syncedEvents) {
      const key = this.getEventKey(event);
      if (!eventMap.has(key)) {
        eventMap.set(key, event);
      }
    }

    return Array.from(eventMap.values());
  }

  private getEventKey(event: MergedEvent): string {
    // Create a unique key for deduplication based on title, start time, and source
    const startTime = new Date(event.start).getTime();
    return `${event.title}:${startTime}:${event.sourceType}`;
  }

  private sortEvents(events: MergedEvent[]): MergedEvent[] {
    return events.sort((a, b) => {
      // First sort by start time
      const timeA = new Date(a.start).getTime();
      const timeB = new Date(b.start).getTime();
      
      if (timeA !== timeB) {
        return timeA - timeB;
      }

      // Then sort by source priority (local > caldav > ics)
      const priorityOrder = { local: 0, caldav: 1, ics: 2 };
      return priorityOrder[a.sourceType] - priorityOrder[b.sourceType];
    });
  }

  clearCache(): void {
    this.eventCache.clear();
    consola.debug('Event cache cleared');
  }
}

// Export function to get instance with dependencies
export function getEventMergerService(prisma: PrismaClient, syncService: PersistentCalendarSyncService): EventMergerService {
  return EventMergerService.getInstance(prisma, syncService);
}
