export type GoogleCalendarSettings = {
  selectedCalendars: string[];
  eventColor?: string;
  user?: string[];
  useUserColors?: boolean;
  syncDirection?: "read_only" | "read_write";
};

export type GoogleCalendarInfo = {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  accessRole: string;
  backgroundColor?: string;
  foregroundColor?: string;
};

export type GoogleEvent = {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: string;
  }>;
  recurrence?: string[];
  status?: string;
  etag?: string;
  calendarId?: string;
};

export type TokenInfo = {
  accessToken: string;
  refreshToken: string;
  expiryDate: number;
};
