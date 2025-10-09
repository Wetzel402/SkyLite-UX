/**
 * Calendar Sync Types
 * Defines the adapter interface for different calendar sources
 */

export type CalendarSourceType = 'ics' | 'caldav';

export interface CalendarEvent {
  id: string;
  uid: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  allDay: boolean;
  location?: string;
  color: string;
  sourceType: CalendarSourceType;
  sourceId: string;
  sourceName: string;
  updatedAt: Date;
}

export interface CalendarSource {
  id: string;
  name: string;
  type: CalendarSourceType;
  color: string;
  url?: string;
  credentials?: Record<string, string>;
  enabled: boolean;
  lastSync?: Date;
  lastError?: string;
}

export interface CalendarAdapter {
  readonly type: CalendarSourceType;
  fetchEvents(source: CalendarSource): Promise<CalendarEvent[]>;
  validateSource(source: CalendarSource): Promise<boolean>;
}

export interface CalendarSyncResult {
  sourceId: string;
  success: boolean;
  eventsCount: number;
  newEvents: number;
  updatedEvents: number;
  errors: string[];
  duration: number;
}

export interface CalendarSyncConfig {
  enabled: boolean;
  intervalSeconds: number;
  sources: CalendarSource[];
}
