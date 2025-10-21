import type { calendar_v3 } from "googleapis";

import consola from "consola";
import { google } from "googleapis";

import type { GoogleCalendarEvent, GoogleCalendarListItem } from "./types";

export class GoogleCalendarServerService {
  private oauth2Client;
  private calendar: calendar_v3.Calendar;

  constructor(clientId: string, clientSecret: string, refreshToken: string, accessToken?: string, expiry?: number) {
    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      "postmessage",
    );

    this.oauth2Client.setCredentials({
      refresh_token: refreshToken,
      access_token: accessToken,
      expiry_date: expiry,
    });

    this.calendar = google.calendar({ version: "v3", auth: this.oauth2Client });
  }

  async refreshAccessToken(): Promise<void> {
    try {
      await this.oauth2Client.refreshAccessToken();
    }
    catch (error) {
      consola.error("GoogleCalendarServerService: Failed to refresh access token:", error);
      throw error;
    }
  }

  private async ensureValidToken(): Promise<void> {
    const credentials = this.oauth2Client.credentials;

    if (!credentials.expiry_date || credentials.expiry_date < Date.now() + 300000) {
      consola.debug("GoogleCalendarServerService: Proactively refreshing access token");
      await this.oauth2Client.refreshAccessToken();
    }
  }

  async listCalendars(): Promise<GoogleCalendarListItem[]> {
    await this.ensureValidToken();

    try {
      const response = await this.calendar.calendarList.list();
      const calendars = response.data.items || [];

      return calendars.map(cal => ({
        id: cal.id || "",
        summary: cal.summary || "",
        description: cal.description || undefined,
        backgroundColor: cal.backgroundColor || "#000000",
        foregroundColor: cal.foregroundColor || "#FFFFFF",
        primary: cal.primary || undefined,
        accessRole: cal.accessRole || "",
      }));
    }
    catch (error) {
      consola.error("GoogleCalendarServerService: Failed to list calendars:", error);
      throw error;
    }
  }

  async fetchEventsFromCalendar(calendarId: string): Promise<GoogleCalendarEvent[]> {
    try {
      const now = new Date();
      const startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      const endDate = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());

      const response = await this.calendar.events.list({
        calendarId,
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        maxResults: 2500,
        singleEvents: true,
        orderBy: "startTime",
      });

      const events = response.data.items || [];

      return events.map(event => ({
        id: event.id || "",
        summary: event.summary || "",
        description: event.description || undefined,
        start: {
          dateTime: event.start?.dateTime || undefined,
          date: event.start?.date || undefined,
        },
        end: {
          dateTime: event.end?.dateTime || undefined,
          date: event.end?.date || undefined,
        },
        location: event.location || undefined,
        recurrence: event.recurrence || undefined,
        status: event.status || "",
        calendarId,
      }));
    }
    catch (error) {
      consola.error(`GoogleCalendarServerService: Failed to fetch events from calendar ${calendarId}:`, error);
      throw error;
    }
  }

  async fetchEvents(calendarIds: string[]): Promise<GoogleCalendarEvent[]> {
    await this.ensureValidToken();

    if (!calendarIds || calendarIds.length === 0) {
      calendarIds = ["primary"];
    }

    const allEvents: GoogleCalendarEvent[] = [];
    let authError: Error | null = null;

    for (const calendarId of calendarIds) {
      try {
        const events = await this.fetchEventsFromCalendar(calendarId);
        allEvents.push(...events);
      }
      catch (error: unknown) {
        const err = error as { message?: string };
        if (err?.message?.includes("Invalid Credentials") || err?.message?.includes("invalid_grant")) {
          authError = error instanceof Error ? error : new Error(err?.message || "Authentication failed");
          consola.error(`GoogleCalendarServerService: Auth error for calendar ${calendarId}:`, error);
          break;
        }
        consola.warn(`GoogleCalendarServerService: Skipping calendar ${calendarId} due to error:`, error);
      }
    }

    if (authError) {
      throw authError;
    }

    return allEvents;
  }
}
