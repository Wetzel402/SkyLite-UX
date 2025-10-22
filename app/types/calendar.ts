import type { ICalEvent } from "../../server/integrations/iCal/types";

export type CalendarView = "month" | "week" | "day" | "agenda";

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
