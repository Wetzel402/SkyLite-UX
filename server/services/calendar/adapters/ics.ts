import { consola } from 'consola';
import { CalendarAdapter, CalendarEvent, CalendarSource } from '~/lib/calendar/types';

/**
 * ICS Calendar Adapter
 * Fetches and parses ICS feeds with conditional requests and error handling
 */

interface ICSComponent {
  type: string;
  properties: Record<string, any>;
  components?: ICSComponent[];
}

interface ICSProperty {
  name: string;
  value: string;
  parameters?: Record<string, string>;
}

export class ICSAdapter implements CalendarAdapter {
  readonly type = 'ics' as const;

  async fetchEvents(source: CalendarSource): Promise<CalendarEvent[]> {
    if (!source.url) {
      throw new Error(`ICS source ${source.id} has no URL`);
    }

    try {
      consola.debug(`Fetching ICS feed: ${source.name} (${source.url})`);
      
      const response = await this.fetchWithConditionalRequest(source.url);
      
      if (response.status === 304) {
        consola.debug(`ICS feed ${source.name} not modified (304)`);
        return [];
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const icsContent = await response.text();
      const events = this.parseICS(icsContent, source);
      
      consola.debug(`Parsed ${events.length} events from ${source.name}`);
      return events;

    } catch (error) {
      consola.error(`Failed to fetch ICS feed ${source.name}:`, error);
      throw error;
    }
  }

  async validateSource(source: CalendarSource): Promise<boolean> {
    if (!source.url) {
      return false;
    }

    try {
      const response = await fetch(source.url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });
      
      return response.ok && response.headers.get('content-type')?.includes('text/calendar');
    } catch {
      return false;
    }
  }

  private async fetchWithConditionalRequest(url: string): Promise<Response> {
    // TODO: Implement ETag/Last-Modified caching
    // For now, just fetch without conditional headers
    return fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'SkyLite-UX/1.0',
        'Accept': 'text/calendar, text/plain, */*',
      },
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });
  }

  private parseICS(content: string, source: CalendarSource): CalendarEvent[] {
    const events: CalendarEvent[] = [];
    const lines = content.split(/\r?\n/);
    let currentEvent: Partial<CalendarEvent> | null = null;
    let inEvent = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line === 'BEGIN:VEVENT') {
        inEvent = true;
        currentEvent = {
          sourceType: 'ics',
          sourceId: source.id,
          sourceName: source.name,
          color: source.color,
        };
      } else if (line === 'END:VEVENT' && inEvent && currentEvent) {
        if (this.isValidEvent(currentEvent)) {
          events.push(this.normalizeEvent(currentEvent as CalendarEvent));
        }
        inEvent = false;
        currentEvent = null;
      } else if (inEvent && currentEvent && line.includes(':')) {
        this.parseEventProperty(line, currentEvent);
      }
    }

    return events;
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
}
