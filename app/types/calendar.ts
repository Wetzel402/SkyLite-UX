import type { ICalEvent } from "../../server/integrations/iCal/types";

export type CalendarView = "month" | "week" | "day" | "agenda";

export type SourceCalendar = {
  integrationId: string;
  integrationName?: string;
  calendarId: string;
  calendarName?: string;
  accessRole: "read" | "write";
  canEdit: boolean;
  eventColor?: string;
  userColor?: string | string[];
  eventId?: string;
};

export type CalendarEvent = {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  color?: string | string[];
  location?: string;
  ical_event?: ICalEvent;
  integrationId?: string;
  calendarId?: string;
  sourceCalendars?: SourceCalendar[];
  users?: Array<{
    id: string;
    name: string;
    avatar?: string | null;
    color?: string | null;
  }>;
};

export type PlaceholderEvent = CalendarEvent & {
  isPlaceholder: true;
  position: number;
};

export type IntegrationTarget = {
  integrationId: string;
  calendarId?: string | null;
};
