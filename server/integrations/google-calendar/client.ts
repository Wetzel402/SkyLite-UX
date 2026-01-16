import type { OAuth2Client } from "google-auth-library";
import type { calendar_v3 } from "googleapis";

import { consola } from "consola";
import { google } from "googleapis";

import type { CalendarEvent } from "~/types/calendar";

import type { GoogleCalendarInfo, GoogleCalendarSettings, GoogleEvent } from "./types";

import { createOAuth2Client, decryptToken, encryptToken, refreshAccessToken } from "./oauth";

/**
 * Google Calendar Server Service
 * Handles all interactions with Google Calendar API
 */
export class GoogleCalendarServerService {
  private oauth2Client: OAuth2Client;
  private calendar: calendar_v3.Calendar | null = null;
  private initialized = false;

  constructor(
    private integrationId: string,
    private accessToken: string,
    private refreshToken: string,
    private tokenExpiry: Date | null,
    private settings: GoogleCalendarSettings,
  ) {
    this.oauth2Client = createOAuth2Client();
  }

  /**
   * Initialize the service by setting up OAuth credentials
   * Refreshes token if expired
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Decrypt tokens
      const decryptedAccess = decryptToken(this.accessToken);
      const decryptedRefresh = decryptToken(this.refreshToken);

      // Check if token needs refresh
      const now = new Date();
      if (this.tokenExpiry && this.tokenExpiry <= now) {
        consola.debug(`Access token expired for integration ${this.integrationId}, refreshing...`);
        await this.refreshTokens(decryptedRefresh);
      }
      else {
        this.oauth2Client.setCredentials({
          access_token: decryptedAccess,
          refresh_token: decryptedRefresh,
        });
      }

      // Initialize Calendar API client
      this.calendar = google.calendar({ version: "v3", auth: this.oauth2Client });
      this.initialized = true;

      consola.debug(`Google Calendar service initialized for integration ${this.integrationId}`);
    }
    catch (error) {
      consola.error(`Failed to initialize Google Calendar service for integration ${this.integrationId}:`, error);
      throw new Error("Failed to initialize Google Calendar service");
    }
  }

  /**
   * Refresh expired access token
   */
  private async refreshTokens(refreshToken: string): Promise<void> {
    try {
      const tokenInfo = await refreshAccessToken(this.oauth2Client, refreshToken);

      // Update database with new tokens
      const prisma = await import("~/lib/prisma").then(m => m.default);
      await prisma.integration.update({
        where: { id: this.integrationId },
        data: {
          accessToken: encryptToken(tokenInfo.accessToken),
          tokenExpiry: new Date(tokenInfo.expiryDate),
          updatedAt: new Date(),
        },
      });

      // Update local credentials
      this.oauth2Client.setCredentials({
        access_token: tokenInfo.accessToken,
        refresh_token: tokenInfo.refreshToken,
      });

      consola.debug(`Access token refreshed for integration ${this.integrationId}`);
    }
    catch (error) {
      consola.error(`Failed to refresh tokens for integration ${this.integrationId}:`, error);
      throw new Error("Token refresh failed - re-authorization required");
    }
  }

  /**
   * List all calendars available to the user
   */
  async listCalendars(): Promise<GoogleCalendarInfo[]> {
    if (!this.calendar) {
      throw new Error("Service not initialized");
    }

    try {
      const response = await this.calendar.calendarList.list();

      return (response.data.items || []).map((item): GoogleCalendarInfo => ({
        id: item.id || "",
        summary: item.summary || "Unnamed Calendar",
        description: item.description,
        primary: item.primary || false,
        accessRole: item.accessRole || "reader",
        backgroundColor: item.backgroundColor,
        foregroundColor: item.foregroundColor,
      }));
    }
    catch (error) {
      consola.error(`Failed to list calendars for integration ${this.integrationId}:`, error);
      throw new Error("Failed to fetch calendars from Google");
    }
  }

  /**
   * Get events from all selected calendars
   */
  async getEvents(): Promise<GoogleEvent[]> {
    if (!this.calendar) {
      throw new Error("Service not initialized");
    }

    const selectedCalendars = this.settings.selectedCalendars || [];
    if (selectedCalendars.length === 0) {
      consola.warn(`No calendars selected for integration ${this.integrationId}`);
      return [];
    }

    const allEvents: GoogleEvent[] = [];

    // Fetch events from each selected calendar
    for (const calendarId of selectedCalendars) {
      try {
        const events = await this.fetchEventsFromCalendar(calendarId);
        allEvents.push(...events);
      }
      catch (error) {
        consola.error(`Failed to fetch events from calendar ${calendarId}:`, error);
        // Continue with other calendars even if one fails
      }
    }

    consola.debug(`Fetched ${allEvents.length} events from ${selectedCalendars.length} calendars for integration ${this.integrationId}`);

    return allEvents;
  }

  /**
   * Fetch events from a specific calendar
   */
  private async fetchEventsFromCalendar(calendarId: string): Promise<GoogleEvent[]> {
    if (!this.calendar) {
      throw new Error("Service not initialized");
    }

    const timeMin = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 year ago
    const timeMax = new Date(Date.now() + 730 * 24 * 60 * 60 * 1000); // 2 years ahead

    const response = await this.calendar.events.list({
      calendarId,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      maxResults: 2500,
      singleEvents: true, // Expand recurring events
      orderBy: "startTime",
    });

    return (response.data.items || []).map((item): GoogleEvent => ({
      id: item.id || "",
      summary: item.summary || "(No title)",
      description: item.description,
      location: item.location,
      start: {
        dateTime: item.start?.dateTime,
        date: item.start?.date,
        timeZone: item.start?.timeZone,
      },
      end: {
        dateTime: item.end?.dateTime,
        date: item.end?.date,
        timeZone: item.end?.timeZone,
      },
      attendees: item.attendees?.map(att => ({
        email: att.email || "",
        displayName: att.displayName,
        responseStatus: att.responseStatus,
      })),
      recurrence: item.recurrence,
      status: item.status,
      etag: item.etag,
      calendarId,
    }));
  }

  /**
   * Convert Google event to SkyLite CalendarEvent format
   */
  convertToCalendarEvent(googleEvent: GoogleEvent): CalendarEvent {
    const start = googleEvent.start.dateTime
      ? new Date(googleEvent.start.dateTime)
      : new Date(`${googleEvent.start.date}T00:00:00`);

    const end = googleEvent.end.dateTime
      ? new Date(googleEvent.end.dateTime)
      : new Date(`${googleEvent.end.date}T00:00:00`);

    const allDay = !!googleEvent.start.date;

    return {
      id: `google-${this.integrationId}-${googleEvent.id}`,
      title: googleEvent.summary,
      description: googleEvent.description,
      location: googleEvent.location,
      start,
      end,
      allDay,
      color: this.settings.useUserColors ? undefined : { background: this.settings.eventColor || "#06b6d4" },
      users: this.settings.user || [],
    };
  }

  /**
   * Add an event to a Google Calendar
   */
  async addEvent(event: Omit<CalendarEvent, "id">, calendarId: string): Promise<GoogleEvent> {
    if (!this.calendar) {
      throw new Error("Service not initialized");
    }

    try {
      const googleEvent = this.convertFromCalendarEvent(event);

      const response = await this.calendar.events.insert({
        calendarId,
        requestBody: googleEvent,
      });

      if (!response.data.id) {
        throw new Error("No event ID returned from Google");
      }

      consola.debug(`Created event ${response.data.id} in calendar ${calendarId}`);

      return {
        id: response.data.id,
        summary: response.data.summary || "",
        description: response.data.description,
        location: response.data.location,
        start: {
          dateTime: response.data.start?.dateTime,
          date: response.data.start?.date,
          timeZone: response.data.start?.timeZone,
        },
        end: {
          dateTime: response.data.end?.dateTime,
          date: response.data.end?.date,
          timeZone: response.data.end?.timeZone,
        },
        status: response.data.status,
        etag: response.data.etag,
        calendarId,
      };
    }
    catch (error) {
      consola.error(`Failed to add event to calendar ${calendarId}:`, error);
      throw new Error("Failed to create event in Google Calendar");
    }
  }

  /**
   * Update an existing event in Google Calendar
   */
  async updateEvent(eventId: string, calendarId: string, updates: Partial<CalendarEvent>): Promise<GoogleEvent> {
    if (!this.calendar) {
      throw new Error("Service not initialized");
    }

    try {
      const googleEvent = this.convertFromCalendarEvent(updates);

      const response = await this.calendar.events.patch({
        calendarId,
        eventId,
        requestBody: googleEvent,
      });

      consola.debug(`Updated event ${eventId} in calendar ${calendarId}`);

      return {
        id: response.data.id || eventId,
        summary: response.data.summary || "",
        description: response.data.description,
        location: response.data.location,
        start: {
          dateTime: response.data.start?.dateTime,
          date: response.data.start?.date,
          timeZone: response.data.start?.timeZone,
        },
        end: {
          dateTime: response.data.end?.dateTime,
          date: response.data.end?.date,
          timeZone: response.data.end?.timeZone,
        },
        status: response.data.status,
        etag: response.data.etag,
        calendarId,
      };
    }
    catch (error) {
      consola.error(`Failed to update event ${eventId} in calendar ${calendarId}:`, error);
      throw new Error("Failed to update event in Google Calendar");
    }
  }

  /**
   * Delete an event from Google Calendar
   */
  async deleteEvent(eventId: string, calendarId: string): Promise<void> {
    if (!this.calendar) {
      throw new Error("Service not initialized");
    }

    try {
      await this.calendar.events.delete({
        calendarId,
        eventId,
      });

      consola.debug(`Deleted event ${eventId} from calendar ${calendarId}`);
    }
    catch (error) {
      consola.error(`Failed to delete event ${eventId} from calendar ${calendarId}:`, error);
      throw new Error("Failed to delete event from Google Calendar");
    }
  }

  /**
   * Convert SkyLite CalendarEvent to Google Calendar event format
   */
  private convertFromCalendarEvent(event: Partial<CalendarEvent>): calendar_v3.Schema$Event {
    const googleEvent: calendar_v3.Schema$Event = {};

    if (event.title !== undefined) {
      googleEvent.summary = event.title;
    }

    if (event.description !== undefined) {
      googleEvent.description = event.description || undefined;
    }

    if (event.location !== undefined) {
      googleEvent.location = event.location || undefined;
    }

    if (event.start && event.end) {
      if (event.allDay) {
        // All-day event - use date format
        googleEvent.start = {
          date: event.start.toISOString().split("T")[0],
        };
        googleEvent.end = {
          date: event.end.toISOString().split("T")[0],
        };
      }
      else {
        // Timed event - use dateTime format
        googleEvent.start = {
          dateTime: event.start.toISOString(),
          timeZone: "UTC",
        };
        googleEvent.end = {
          dateTime: event.end.toISOString(),
          timeZone: "UTC",
        };
      }
    }

    return googleEvent;
  }
}
