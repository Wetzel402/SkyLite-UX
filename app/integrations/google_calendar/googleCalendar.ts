import consola from "consola";

import type { CalendarEvent } from "~/types/calendar";
import type { Integration } from "~/types/database";
import type { CalendarConfig, CalendarIntegrationService, IntegrationStatus, UserWithColor } from "~/types/integrations";

import { integrationRegistry } from "~/types/integrations";

import type { GoogleCalendarEvent, GoogleCalendarListItem } from "../../../server/integrations/google_calendar/types";

import "./types";

export class GoogleCalendarService implements CalendarIntegrationService {
  private integrationId: string;
  private clientId: string;
  private clientSecret: string;

  private status: IntegrationStatus = {
    isConnected: false,
    lastChecked: new Date(),
  };

  private gisLoaded = false;

  constructor(
    integrationId: string,
    clientId: string,
    clientSecret: string,
  ) {
    this.integrationId = integrationId;
    this.clientId = clientId;
    this.clientSecret = clientSecret;

    this.status.lastChecked = new Date();
  }

  async initialize(): Promise<void> {
    await this.loadGoogleAPIs();
    await this.validate();
  }

  private async loadGoogleAPIs(): Promise<void> {
    if (typeof window === "undefined") {
      return;
    }

    if (!this.gisLoaded) {
      await this.loadScript("https://accounts.google.com/gsi/client");
      this.gisLoaded = true;
    }
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === "undefined") {
        resolve();
        return;
      }

      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  async authenticate(integrationData: Record<string, unknown>): Promise<void> {
    if (typeof window === "undefined") {
      throw new TypeError("Authentication requires browser environment");
    }

    await this.loadGoogleAPIs();

    const baseUrl = window.location.origin;
    const redirectUri = `${baseUrl}/api/integrations/google_calendar/callback`;

    const stateData = {
      ...integrationData,
      redirectUri,
    };
    const state = encodeURIComponent(JSON.stringify(stateData));

    return new Promise((resolve) => {
      if (!window.google) {
        throw new Error("Google Identity Services not loaded");
      }

      const client = window.google.accounts.oauth2.initCodeClient({
        client_id: this.clientId,
        scope: "https://www.googleapis.com/auth/calendar.events",
        ux_mode: "redirect",
        redirect_uri: redirectUri,
        state,
        access_type: "offline",
        prompt: "consent",
      });

      client.requestCode();

      resolve();
    });
  }

  async getAvailableCalendars(): Promise<GoogleCalendarListItem[]> {
    try {
      const result = await $fetch<{ calendars: GoogleCalendarListItem[] }>(
        "/api/integrations/google_calendar/calendars",
        { query: { integrationId: this.integrationId } },
      );
      return result.calendars;
    }
    catch (error) {
      consola.error("GoogleCalendar: Failed to fetch calendars:", error);
      throw error;
    }
  }

  async validate(): Promise<boolean> {
    try {
      await $fetch<{ events: GoogleCalendarEvent[] }>(
        "/api/integrations/google_calendar/events",
        { query: { integrationId: this.integrationId } },
      );

      this.status = {
        isConnected: true,
        lastChecked: new Date(),
      };

      return true;
    }
    catch (error) {
      this.status = {
        isConnected: false,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
      return false;
    }
  }

  async getStatus(): Promise<IntegrationStatus> {
    return this.status;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.loadGoogleAPIs();

      this.status = {
        isConnected: true,
        lastChecked: new Date(),
      };

      return true;
    }
    catch (error) {
      consola.error("GoogleCalendar: Connection test error:", error);
      this.status = {
        isConnected: false,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
      return false;
    }
  }

  async getCapabilities(): Promise<string[]> {
    const config = integrationRegistry.get("calendar:google");
    return config?.capabilities || [];
  }

  async getEvents(): Promise<CalendarEvent[]> {
    const result = await $fetch<{ events: GoogleCalendarEvent[]; calendars: CalendarConfig[] }>(
      "/api/integrations/google_calendar/events",
      { query: { integrationId: this.integrationId } },
    );

    const calendars = result.calendars || [];
    let allUsers: UserWithColor[] = [];

    try {
      const users = await $fetch<{ id: string; name: string; color: string | null }[]>("/api/users");
      if (users) {
        allUsers = users;
      }
    }
    catch (error) {
      consola.warn("GoogleCalendar: Failed to fetch users for Google Calendar integration:", error);
    }

    return result.events.map((event) => {
      const startDateTime = event.start.dateTime || event.start.date;
      const endDateTime = event.end.dateTime || event.end.date;

      const start = new Date(startDateTime || "");
      const end = new Date(endDateTime || "");

      const isAllDay = !event.start.dateTime && !!event.start.date;

      const calendarConfig = calendars.find(c => c.id === event.calendarId);
      const eventColor = calendarConfig?.eventColor || "sky";
      const useUserColors = calendarConfig?.useUserColors || false;
      const userIds = calendarConfig?.user || [];

      const users = allUsers.filter(u => userIds.includes(u.id));

      let color: string | string[] | undefined = eventColor;
      if (useUserColors && users.length > 0) {
        const userColors = users.map(u => u.color).filter((color): color is string => color !== null);
        if (userColors.length > 0) {
          color = userColors.length === 1 ? userColors[0] : userColors;
        }
        else {
          color = eventColor;
        }
      }

      return {
        id: event.id,
        title: event.summary,
        description: event.description || "",
        start,
        end,
        allDay: isAllDay,
        color,
        location: event.location,
        integrationId: this.integrationId,
        calendarId: event.calendarId,
        users: useUserColors ? users : undefined,
      };
    });
  }

  async updateEvent(eventId: string, eventData: Partial<CalendarEvent>): Promise<CalendarEvent> {
    try {
      const baseEventId = eventId.includes("-") ? eventId.split("-")[0] : eventId;

      const response = await $fetch<CalendarEvent>(`/api/integrations/google_calendar/events/${baseEventId}`, {
        method: "PUT",
        body: {
          integrationId: this.integrationId,
          calendarId: eventData.calendarId,
          ...eventData,
        },
      });

      return response;
    }
    catch (error) {
      consola.error("GoogleCalendarService: Failed to update event:", error);
      throw error;
    }
  }
}

export function createGoogleCalendarService(
  integrationId: string,
  clientId: string,
  clientSecret: string,
): GoogleCalendarService {
  return new GoogleCalendarService(
    integrationId,
    clientId,
    clientSecret,
  );
}

export async function handleGoogleCalendarSave(
  integrationData: Record<string, unknown>,
  settingsData: Record<string, unknown>,
  isExisting: boolean,
  originalIntegration?: Integration | null,
): Promise<boolean> {
  const needsReauth = originalIntegration?.settings
    ? (originalIntegration.settings as { needsReauth?: boolean })?.needsReauth
    : false;

  const needsOAuth = !isExisting || needsReauth;

  if (!needsOAuth) {
    return false;
  }

  const tempService = createGoogleCalendarService(
    "temp",
    settingsData.clientId?.toString() || "",
    settingsData.clientSecret?.toString() || "",
  );

  const authData = isExisting
    ? { ...integrationData, integrationId: (integrationData as { id?: string }).id }
    : integrationData;

  await tempService.authenticate(authData);
  return true;
}
