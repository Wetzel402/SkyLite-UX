import type { calendar_v3 } from "googleapis";

import consola from "consola";
import { google } from "googleapis";

import type { GoogleCalendarEvent, GoogleCalendarListItem } from "./types";

/**
 * Google Calendar Server Service
 *
 * Implements OAuth2 token refresh according to Google's best practices:
 * https://developers.google.com/identity/protocols/oauth2
 *
 * IMPORTANT - Test Mode Limitations:
 * - If your Google Cloud project is in "Testing" mode, refresh tokens expire after 7 days
 * - When tokens expire, users must re-authorize the integration
 * - For production use, publish your app or request extended testing access
 *
 * Token Refresh Strategy:
 * - Access tokens are refreshed 5 minutes before expiry (recommended buffer)
 * - Refresh is deduplicated if multiple calls happen simultaneously
 * - New tokens are persisted to database via callback
 * - Invalid refresh tokens trigger re-authorization flow
 */
export class GoogleCalendarServerService {
  private oauth2Client;
  private calendar: calendar_v3.Calendar;
  private refreshPromise: Promise<void> | null = null;
  private integrationId?: string;
  private onTokenRefresh?: (integrationId: string, accessToken: string, expiry: number) => Promise<void>;

  constructor(
    clientId: string,
    clientSecret: string,
    refreshToken: string,
    accessToken?: string,
    expiry?: number,
    integrationId?: string,
    onTokenRefresh?: (integrationId: string, accessToken: string, expiry: number) => Promise<void>,
  ) {
    this.integrationId = integrationId;
    this.onTokenRefresh = onTokenRefresh;
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
    const now = Date.now();
    const expiryDate = credentials.expiry_date;
    const accessToken = credentials.access_token;

    // Per Google OAuth2 best practices, refresh token 5 minutes before expiry
    // https://developers.google.com/identity/protocols/oauth2#expiration
    // Also refresh if access_token is missing
    const needsRefresh = !accessToken || !expiryDate || expiryDate < now + 300000;

    if (!needsRefresh) {
      return;
    }

    // If a refresh is already in progress, wait for it
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        consola.debug("GoogleCalendarServerService: Refreshing access token...");
        await this.oauth2Client.refreshAccessToken();

        const newCredentials = this.oauth2Client.credentials;
        const newAccessToken = newCredentials.access_token;
        const newExpiry = newCredentials.expiry_date;

        consola.debug("GoogleCalendarServerService: Access token refreshed successfully");

        // Persist the new token to database
        if (this.integrationId && this.onTokenRefresh && newAccessToken && newExpiry) {
          try {
            await this.onTokenRefresh(this.integrationId, newAccessToken, newExpiry);
            consola.debug("GoogleCalendarServerService: Refreshed token persisted to database");
          }
          catch (callbackError) {
            consola.error("GoogleCalendarServerService: Failed to persist refreshed token via callback:", callbackError);
            // Don't throw - we can still use the token in memory
          }
        }
      }
      catch (error: unknown) {
        const err = error as { code?: number; message?: string; response?: { status?: number; data?: { error?: string } } };

        // Check for refresh token expiration or revocation (including HTTP 401 responses)
        if (
          err?.response?.status === 401
          || err?.message?.includes("invalid_grant")
          || err?.message?.includes("Token has been expired or revoked")
          || err?.response?.data?.error === "invalid_grant"
        ) {
          consola.error("GoogleCalendarServerService: Refresh token is invalid or expired. User needs to re-authorize.");
          const authError = new Error("Refresh token expired. Please re-authorize the integration.");
          (authError as { code?: number }).code = 401;
          throw authError;
        }

        consola.error("GoogleCalendarServerService: Failed to refresh access token:", err);
        throw error;
      }
      finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  async listCalendars(): Promise<GoogleCalendarListItem[]> {
    await this.ensureValidToken();

    try {
      const response = await this.calendar.calendarList.list();
      const calendars = response.data.items || [];

      return calendars.map((cal) => {
        const googleRole = cal.accessRole || "";
        const accessRole = (googleRole === "writer" || googleRole === "owner") ? "write" : "read";

        return {
          id: cal.id || "",
          summary: cal.summary || "",
          description: cal.description || undefined,
          backgroundColor: cal.backgroundColor || "#000000",
          foregroundColor: cal.foregroundColor || "#FFFFFF",
          primary: cal.primary || undefined,
          accessRole,
        };
      });
    }
    catch (error) {
      consola.error("GoogleCalendarServerService: Failed to list calendars:", error);
      throw error;
    }
  }

  async fetchEventsFromCalendar(calendarId: string): Promise<GoogleCalendarEvent[]> {
    // Ensure token is valid before each calendar fetch
    // This is important when fetching multiple calendars sequentially
    await this.ensureValidToken();

    try {
      const now = new Date();
      const startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      const endDate = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());

      const response = await this.calendar.events.list({
        calendarId,
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        maxResults: 2500,
        singleEvents: false,
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
        const err = error as { code?: number; message?: string; response?: { status?: number; data?: { error?: string } } };

        // Check for authentication errors (including HTTP 401 responses)
        const isAuthError = err?.code === 401
          || err?.response?.status === 401
          || err?.message?.includes("Invalid Credentials")
          || err?.message?.includes("invalid_grant")
          || err?.message?.includes("Refresh token expired")
          || err?.message?.includes("Token has been expired or revoked")
          || err?.response?.data?.error === "invalid_grant";

        if (isAuthError) {
          authError = error instanceof Error ? error : new Error(err?.message || "Authentication failed");
          (authError as { code?: number }).code = 401;
          consola.error(`GoogleCalendarServerService: Auth error for calendar ${calendarId}:`, error);
          break;
        }

        // For non-auth errors, log and continue with other calendars
        consola.warn(`GoogleCalendarServerService: Skipping calendar ${calendarId} due to error:`, error);
      }
    }

    if (authError) {
      throw authError;
    }

    return allEvents;
  }

  async fetchEvent(calendarId: string, eventId: string): Promise<GoogleCalendarEvent> {
    await this.ensureValidToken();

    try {
      const response = await this.calendar.events.get({
        calendarId,
        eventId,
      });

      const event = response.data;

      return {
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
      };
    }
    catch (error) {
      consola.error(`GoogleCalendarServerService: Failed to fetch event ${eventId} from calendar ${calendarId}:`, error);
      throw error;
    }
  }

  async updateEvent(calendarId: string, eventId: string, eventData: {
    summary: string;
    description?: string;
    start: { dateTime?: string; date?: string; timeZone?: string };
    end: { dateTime?: string; date?: string; timeZone?: string };
    location?: string;
    recurrence?: string[];
  }): Promise<GoogleCalendarEvent> {
    await this.ensureValidToken();

    try {
      const response = await this.calendar.events.update({
        calendarId,
        eventId,
        requestBody: {
          summary: eventData.summary,
          description: eventData.description,
          location: eventData.location,
          start: eventData.start,
          end: eventData.end,
          recurrence: eventData.recurrence,
        },
      });

      return {
        id: response.data.id || "",
        summary: response.data.summary || "",
        description: response.data.description || undefined,
        start: {
          dateTime: response.data.start?.dateTime || undefined,
          date: response.data.start?.date || undefined,
        },
        end: {
          dateTime: response.data.end?.dateTime || undefined,
          date: response.data.end?.date || undefined,
        },
        location: response.data.location || undefined,
        recurrence: response.data.recurrence || undefined,
        status: response.data.status || "",
        calendarId,
      };
    }
    catch (error) {
      consola.error(`GoogleCalendarServerService: Failed to update event ${eventId}:`, error);
      throw error;
    }
  }

  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    await this.ensureValidToken();

    try {
      await this.calendar.events.delete({
        calendarId,
        eventId,
        sendUpdates: "all",
      });
    }
    catch (error) {
      consola.error(`GoogleCalendarServerService: Failed to delete event ${eventId}:`, error);
      throw error;
    }
  }

  async addEvent(calendarId: string, eventData: {
    summary: string;
    description?: string;
    start: { dateTime?: string; date?: string; timeZone?: string };
    end: { dateTime?: string; date?: string; timeZone?: string };
    location?: string;
    recurrence?: string[];
  }): Promise<GoogleCalendarEvent> {
    await this.ensureValidToken();

    try {
      const response = await this.calendar.events.insert({
        calendarId,
        requestBody: {
          summary: eventData.summary,
          description: eventData.description,
          location: eventData.location,
          start: eventData.start,
          end: eventData.end,
          recurrence: eventData.recurrence,
        },
      });

      return {
        id: response.data.id || "",
        summary: response.data.summary || "",
        description: response.data.description || undefined,
        start: {
          dateTime: response.data.start?.dateTime || undefined,
          date: response.data.start?.date || undefined,
        },
        end: {
          dateTime: response.data.end?.dateTime || undefined,
          date: response.data.end?.date || undefined,
        },
        location: response.data.location || undefined,
        recurrence: response.data.recurrence || undefined,
        status: response.data.status || "",
        calendarId,
      };
    }
    catch (error) {
      consola.error(`GoogleCalendarServerService: Failed to add event:`, error);
      throw error;
    }
  }
}
