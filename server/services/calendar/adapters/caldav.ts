import { consola } from 'consola';
import { createDAVClient } from 'tsdav';
import { CalendarAdapter, CalendarEvent, CalendarSource } from '~/lib/calendar/types';
import { ConflictError, QuotaExceededError, WriteNotAllowedError, DryRunError } from '../errors';

/**
 * CalDAV Calendar Adapter
 * Fetches events from CalDAV servers (Nextcloud, Radicale, iCloud, Fastmail, Google via CalDAV)
 * Supports authentication, calendar discovery, and event fetching with conditional requests
 */

interface CalDAVCredentials {
  username: string;
  password: string;
  serverUrl: string;
  calendarName?: string;
}

export class CalDAVAdapter implements CalendarAdapter {
  readonly type = 'caldav' as const;

  async fetchEvents(source: CalendarSource): Promise<CalendarEvent[]> {
    if (!source.credentials) {
      throw new Error(`CalDAV source ${source.id} has no credentials`);
    }

    const credentials = source.credentials as CalDAVCredentials;
    
    try {
      // Mask credentials in logs
      const maskedUsername = this.maskCredentials(credentials.username);
      consola.debug(`Fetching CalDAV events: ${source.name} (${credentials.serverUrl}) [user: ${maskedUsername}]`);
      
      // Create DAV client
      const client = createDAVClient({
        serverUrl: credentials.serverUrl,
        credentials: {
          username: credentials.username,
          password: credentials.password,
        },
        authMethod: 'Basic',
      });

      // Discover calendar home
      const calendarHome = await client.findCalendarHome();
      if (!calendarHome) {
        throw new Error('Calendar home not found');
      }

      // List available calendars
      const calendars = await client.findCalendars({
        calendarHome,
      });

      if (calendars.length === 0) {
        consola.warn(`No calendars found for ${source.name}`);
        return [];
      }

      // Filter calendars if specific calendar name is provided
      let targetCalendars = calendars;
      if (credentials.calendarName) {
        targetCalendars = calendars.filter(cal => 
          cal.displayName?.toLowerCase().includes(credentials.calendarName!.toLowerCase()) ||
          cal.url.includes(credentials.calendarName!)
        );
        
        if (targetCalendars.length === 0) {
          consola.warn(`Calendar '${credentials.calendarName}' not found for ${source.name}`);
          return [];
        }
      }

      // Fetch events from all target calendars
      const allEvents: CalendarEvent[] = [];
      const timeWindow = this.getTimeWindow();

      for (const calendar of targetCalendars) {
        try {
          consola.debug(`Fetching events from calendar: ${calendar.displayName || calendar.url}`);
          
          const events = await client.fetchCalendarObjects({
            calendar,
            timeRange: {
              start: timeWindow.start,
              end: timeWindow.end,
            },
          });

          const parsedEvents = this.parseCalDAVEvents(events, source);
          allEvents.push(...parsedEvents);
          
          consola.debug(`Parsed ${parsedEvents.length} events from ${calendar.displayName || calendar.url}`);
        } catch (error) {
          consola.error(`Failed to fetch events from calendar ${calendar.displayName || calendar.url}:`, error);
          // Continue with other calendars
        }
      }

      consola.debug(`Total CalDAV events fetched: ${allEvents.length} from ${source.name}`);
      return allEvents;

    } catch (error) {
      // Mask credentials in error messages
      const maskedUsername = this.maskCredentials(credentials.username);
      consola.error(`Failed to fetch CalDAV events from ${source.name} [user: ${maskedUsername}]:`, error);
      throw error;
    }
  }

  async validateSource(source: CalendarSource): Promise<boolean> {
    if (!source.credentials) {
      return false;
    }

    const credentials = source.credentials as CalDAVCredentials;
    
    try {
      // Test connection with a simple PROPFIND request
      const client = createDAVClient({
        serverUrl: credentials.serverUrl,
        credentials: {
          username: credentials.username,
          password: credentials.password,
        },
        authMethod: 'Basic',
      });

      // Try to discover calendar home (this will fail if credentials are wrong)
      await client.findCalendarHome();
      return true;
    } catch (error) {
      consola.debug(`CalDAV source validation failed for ${source.name}:`, error);
      return false;
    }
  }

  private getTimeWindow(): { start: Date; end: Date } {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start of current week
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // Extend window by 2 days on each side for kiosk needs
    const start = new Date(startOfWeek);
    start.setDate(startOfWeek.getDate() - 2);
    
    const end = new Date(endOfWeek);
    end.setDate(endOfWeek.getDate() + 2);

    return { start, end };
  }

  private parseCalDAVEvents(events: any[], source: CalendarSource): CalendarEvent[] {
    const parsedEvents: CalendarEvent[] = [];

    for (const event of events) {
      try {
        const parsed = this.parseCalDAVEvent(event, source);
        if (parsed) {
          parsedEvents.push(parsed);
        }
      } catch (error) {
        consola.warn(`Failed to parse CalDAV event:`, error);
        // Continue with other events
      }
    }

    return parsedEvents;
  }

  private parseCalDAVEvent(event: any, source: CalendarSource): CalendarEvent | null {
    if (!event.data) {
      return null;
    }

    // Parse the ICS content from the CalDAV event
    const icsContent = event.data;
    const lines = icsContent.split(/\r?\n/);
    
    let currentEvent: Partial<CalendarEvent> = {
      sourceType: 'caldav',
      sourceId: source.id,
      sourceName: source.name,
      color: source.color,
    };

    let inEvent = false;
    let hasValidEvent = false;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine === 'BEGIN:VEVENT') {
        inEvent = true;
        hasValidEvent = false;
      } else if (trimmedLine === 'END:VEVENT' && inEvent) {
        if (hasValidEvent && this.isValidEvent(currentEvent)) {
          return this.normalizeEvent(currentEvent as CalendarEvent);
        }
        inEvent = false;
        currentEvent = {
          sourceType: 'caldav',
          sourceId: source.id,
          sourceName: source.name,
          color: source.color,
        };
      } else if (inEvent && trimmedLine.includes(':')) {
        this.parseEventProperty(trimmedLine, currentEvent);
        hasValidEvent = true;
      }
    }

    return null;
  }

  private parseEventProperty(line: string, event: Partial<CalendarEvent>): void {
    const [name, ...valueParts] = line.split(':');
    const value = valueParts.join(':');
    const propertyName = name.toUpperCase();

    switch (propertyName) {
      case 'UID':
        event.uid = value;
        event.id = `${event.sourceId}:${value}`;
        break;
      case 'SUMMARY':
        event.title = this.decodeICSValue(value);
        break;
      case 'DESCRIPTION':
        event.description = this.decodeICSValue(value);
        break;
      case 'DTSTART':
        event.start = this.parseICSDate(value);
        break;
      case 'DTEND':
        event.end = this.parseICSDate(value);
        break;
      case 'LOCATION':
        event.location = this.decodeICSValue(value);
        break;
    }
  }

  private parseICSDate(dateStr: string): Date {
    // Handle both date and datetime formats
    if (dateStr.length === 8) {
      // Date only (YYYYMMDD)
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1;
      const day = parseInt(dateStr.substring(6, 8));
      return new Date(Date.UTC(year, month, day));
    } else if (dateStr.length === 15 && dateStr.endsWith('Z')) {
      // UTC datetime (YYYYMMDDTHHMMSSZ)
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1;
      const day = parseInt(dateStr.substring(6, 8));
      const hour = parseInt(dateStr.substring(9, 11));
      const minute = parseInt(dateStr.substring(11, 13));
      const second = parseInt(dateStr.substring(13, 15));
      return new Date(Date.UTC(year, month, day, hour, minute, second));
    } else {
      // Try to parse as ISO string
      return new Date(dateStr);
    }
  }

  private decodeICSValue(value: string): string {
    // Basic ICS value decoding
    return value
      .replace(/\\n/g, '\n')
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';')
      .replace(/\\\\/g, '\\');
  }

  private isValidEvent(event: Partial<CalendarEvent>): boolean {
    return !!(
      event.uid &&
      event.title &&
      event.start &&
      event.end
    );
  }

  private normalizeEvent(event: CalendarEvent): CalendarEvent {
    // Ensure allDay is set correctly
    const startTime = event.start.getTime();
    const endTime = event.end.getTime();
    const isAllDay = (endTime - startTime) % (24 * 60 * 60 * 1000) === 0;

    // Strip HTML from description
    const cleanDescription = event.description?.replace(/<[^>]*>/g, '') || '';

    return {
      ...event,
      allDay: isAllDay,
      description: cleanDescription,
      updatedAt: new Date(),
    };
  }

  private maskCredentials(value: string): string {
    if (!value || value.length <= 4) {
      return '****';
    }
    return `${value.substring(0, 2)}****${value.substring(value.length - 2)}`;
  }

  // Write methods for CalDAV (Phase 3 - Experimental)
  
  async createEvent(source: CalendarSource, input: {
    title: string;
    description?: string;
    location?: string;
    start: Date;
    end: Date;
    allDay?: boolean;
    uid?: string;
    recurrenceId?: string;
  }): Promise<{ uid: string; etag: string }> {
    // Check if writes are allowed
    if (!this.isWriteAllowed(source)) {
      throw new WriteNotAllowedError(`Writes not allowed for source ${source.id}`);
    }

    // Check if dry run mode
    if (process.env.CALDAV_DRY_RUN === 'true') {
      consola.info(`CalDAV Write: DRY RUN - Would create event "${input.title}" for source ${source.name}`);
      return {
        uid: input.uid || `dry-run-${Date.now()}`,
        etag: `dry-run-etag-${Date.now()}`
      };
    }

    const credentials = source.credentials as CalDAVCredentials;
    const maskedUsername = this.maskCredentials(credentials.username);
    
    try {
      consola.debug(`Creating CalDAV event: ${input.title} for ${source.name} [user: ${maskedUsername}]`);
      
      const client = createDAVClient({
        serverUrl: credentials.serverUrl,
        credentials: {
          username: credentials.username,
          password: credentials.password,
        },
        authMethod: 'Basic',
      });

      // Discover calendar home and target calendar
      const calendarHome = await client.findCalendarHome();
      if (!calendarHome) {
        throw new Error('Calendar home not found');
      }

      const calendars = await client.findCalendars({ calendarHome });
      const targetCalendar = this.findTargetCalendar(calendars, credentials.calendarName);
      
      if (!targetCalendar) {
        throw new Error(`Target calendar not found: ${credentials.calendarName || 'default'}`);
      }

      // Generate UID if not provided
      const uid = input.uid || this.generateUID();
      
      // Create VEVENT content
      const veventContent = this.createVEVENTContent({
        ...input,
        uid
      });

      // Create the event on the server
      const result = await client.createCalendarObject({
        calendar: targetCalendar,
        filename: `${uid}.ics`,
        iCalString: veventContent,
      });

      if (!result || !result.etag) {
        throw new Error('Failed to create event on server');
      }

      consola.debug(`Created CalDAV event: ${uid} with etag ${result.etag}`);
      
      return {
        uid,
        etag: result.etag
      };

    } catch (error) {
      consola.error(`Failed to create CalDAV event for ${source.name} [user: ${maskedUsername}]:`, error);
      throw error;
    }
  }

  async updateEvent(source: CalendarSource, event: CalendarEvent, changes: Partial<{
    title: string;
    description?: string;
    location?: string;
    start: Date;
    end: Date;
    allDay?: boolean;
  }>): Promise<{ uid: string; etag: string }> {
    // Check if writes are allowed
    if (!this.isWriteAllowed(source)) {
      throw new WriteNotAllowedError(`Writes not allowed for source ${source.id}`);
    }

    // Check if dry run mode
    if (process.env.CALDAV_DRY_RUN === 'true') {
      consola.info(`CalDAV Write: DRY RUN - Would update event "${event.title}" for source ${source.name}`);
      return {
        uid: event.uid,
        etag: `dry-run-etag-${Date.now()}`
      };
    }

    const credentials = source.credentials as CalDAVCredentials;
    const maskedUsername = this.maskCredentials(credentials.username);
    
    try {
      consola.debug(`Updating CalDAV event: ${event.title} (${event.uid}) for ${source.name} [user: ${maskedUsername}]`);
      
      const client = createDAVClient({
        serverUrl: credentials.serverUrl,
        credentials: {
          username: credentials.username,
          password: credentials.password,
        },
        authMethod: 'Basic',
      });

      // Discover calendar home and target calendar
      const calendarHome = await client.findCalendarHome();
      if (!calendarHome) {
        throw new Error('Calendar home not found');
      }

      const calendars = await client.findCalendars({ calendarHome });
      const targetCalendar = this.findTargetCalendar(calendars, credentials.calendarName);
      
      if (!targetCalendar) {
        throw new Error(`Target calendar not found: ${credentials.calendarName || 'default'}`);
      }

      // Create updated VEVENT content
      const updatedEvent = { ...event, ...changes };
      const veventContent = this.createVEVENTContent(updatedEvent);

      // Update the event with If-Match header for optimistic concurrency
      const headers: Record<string, string> = {};
      if (event.lastRemoteEtag) {
        headers['If-Match'] = event.lastRemoteEtag;
      }

      const result = await client.updateCalendarObject({
        calendar: targetCalendar,
        filename: `${event.uid}.ics`,
        iCalString: veventContent,
        headers
      });

      if (!result || !result.etag) {
        throw new Error('Failed to update event on server');
      }

      consola.debug(`Updated CalDAV event: ${event.uid} with etag ${result.etag}`);
      
      return {
        uid: event.uid,
        etag: result.etag
      };

    } catch (error) {
      // Handle conflict errors
      if (error instanceof Error && error.message.includes('412')) {
        throw new ConflictError(
          `Event was modified by another client`,
          event,
          changes,
          'Event was modified remotely'
        );
      }
      
      consola.error(`Failed to update CalDAV event ${event.uid} for ${source.name} [user: ${maskedUsername}]:`, error);
      throw error;
    }
  }

  async deleteEvent(source: CalendarSource, event: CalendarEvent): Promise<void> {
    // Check if writes are allowed
    if (!this.isWriteAllowed(source)) {
      throw new WriteNotAllowedError(`Writes not allowed for source ${source.id}`);
    }

    // Check if dry run mode
    if (process.env.CALDAV_DRY_RUN === 'true') {
      consola.info(`CalDAV Write: DRY RUN - Would delete event "${event.title}" for source ${source.name}`);
      return;
    }

    const credentials = source.credentials as CalDAVCredentials;
    const maskedUsername = this.maskCredentials(credentials.username);
    
    try {
      consola.debug(`Deleting CalDAV event: ${event.title} (${event.uid}) for ${source.name} [user: ${maskedUsername}]`);
      
      const client = createDAVClient({
        serverUrl: credentials.serverUrl,
        credentials: {
          username: credentials.username,
          password: credentials.password,
        },
        authMethod: 'Basic',
      });

      // Discover calendar home and target calendar
      const calendarHome = await client.findCalendarHome();
      if (!calendarHome) {
        throw new Error('Calendar home not found');
      }

      const calendars = await client.findCalendars({ calendarHome });
      const targetCalendar = this.findTargetCalendar(calendars, credentials.calendarName);
      
      if (!targetCalendar) {
        throw new Error(`Target calendar not found: ${credentials.calendarName || 'default'}`);
      }

      // Delete the event with If-Match header for optimistic concurrency
      const headers: Record<string, string> = {};
      if (event.lastRemoteEtag) {
        headers['If-Match'] = event.lastRemoteEtag;
      }

      await client.deleteCalendarObject({
        calendar: targetCalendar,
        filename: `${event.uid}.ics`,
        headers
      });

      consola.debug(`Deleted CalDAV event: ${event.uid}`);

    } catch (error) {
      // Handle 404 as success (event already deleted)
      if (error instanceof Error && error.message.includes('404')) {
        consola.debug(`CalDAV event ${event.uid} was already deleted`);
        return;
      }
      
      // Handle conflict errors
      if (error instanceof Error && error.message.includes('412')) {
        throw new ConflictError(
          `Event was modified by another client`,
          event,
          null,
          'Event was modified remotely'
        );
      }
      
      consola.error(`Failed to delete CalDAV event ${event.uid} for ${source.name} [user: ${maskedUsername}]:`, error);
      throw error;
    }
  }

  // Helper methods for write operations

  private isWriteAllowed(source: CalendarSource): boolean {
    // Check global write flag
    if (process.env.CALDAV_WRITE_ENABLED !== 'true') {
      return false;
    }

    // Check source write policy
    if (source.writePolicy !== 'write') {
      return false;
    }

    return true;
  }

  private findTargetCalendar(calendars: any[], calendarName?: string): any {
    if (!calendarName) {
      return calendars[0]; // Return first calendar if no specific name
    }

    return calendars.find(cal => 
      cal.displayName?.toLowerCase().includes(calendarName.toLowerCase()) ||
      cal.url.includes(calendarName)
    );
  }

  private generateUID(): string {
    return `skylite-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private createVEVENTContent(event: {
    uid: string;
    title: string;
    description?: string;
    location?: string;
    start: Date;
    end: Date;
    allDay?: boolean;
    recurrenceId?: string;
  }): string {
    const formatDate = (date: Date, allDay: boolean = false): string => {
      if (allDay) {
        return date.toISOString().replace(/[-:]/g, '').split('T')[0];
      }
      return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    };

    const formatDateTime = (date: Date, allDay: boolean = false): string => {
      if (allDay) {
        return `DTSTART;VALUE=DATE:${formatDate(date, true)}`;
      }
      return `DTSTART:${formatDate(date, false)}`;
    };

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SkyLite-UX//Calendar//EN',
      'BEGIN:VEVENT',
      `UID:${event.uid}`,
      `SUMMARY:${this.encodeICSValue(event.title)}`,
    ];

    if (event.description) {
      lines.push(`DESCRIPTION:${this.encodeICSValue(event.description)}`);
    }

    if (event.location) {
      lines.push(`LOCATION:${this.encodeICSValue(event.location)}`);
    }

    if (event.recurrenceId) {
      lines.push(`RECURRENCE-ID:${event.recurrenceId}`);
    }

    lines.push(formatDateTime(event.start, event.allDay));
    lines.push(formatDateTime(event.end, event.allDay));

    if (event.allDay) {
      lines.push('DTEND;VALUE=DATE:' + formatDate(event.end, true));
    }

    lines.push('STATUS:CONFIRMED');
    lines.push('END:VEVENT');
    lines.push('END:VCALENDAR');

    return lines.join('\r\n');
  }

  private encodeICSValue(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '');
  }
}
