import consola from "consola";

import type { CalendarEvent } from "~/types/calendar";
import type { CalendarIntegrationService, IntegrationStatus, UserWithColor } from "~/types/integrations";

import { DEFAULT_LOCAL_EVENT_COLOR } from "~/types/global";
import { integrationRegistry } from "~/types/integrations";

import type { ICalEvent } from "../../../server/integrations/iCal/types";

import { ICalServerService } from "../../../server/integrations/iCal";

export class ICalService implements CalendarIntegrationService {
  private integrationId: string;
  private baseUrl: string;
  private eventColor?: string;
  private user?: string[];
  private useUserColors: boolean;

  private status: IntegrationStatus = {
    isConnected: false,
    lastChecked: new Date(),
  };

  private serverService: ICalServerService;

  constructor(
    integrationId: string,
    baseUrl: string,
    eventColor: string = DEFAULT_LOCAL_EVENT_COLOR,
    user?: string[],
    useUserColors: boolean = false,
  ) {
    this.integrationId = integrationId;
    this.baseUrl = baseUrl;
    this.eventColor = eventColor;
    this.user = user;
    this.useUserColors = useUserColors;
    this.serverService = new ICalServerService(integrationId, baseUrl);

    this.status.lastChecked = new Date();
  }

  async initialize(): Promise<void> {
    await this.validate();
  }

  async validate(): Promise<boolean> {
    try {
      const query: Record<string, string> = { integrationId: this.integrationId };
      if (this.integrationId === "temp" || this.integrationId.startsWith("temp-")) {
        query.baseUrl = this.baseUrl;
      }
      await $fetch<{ events: ICalEvent[] }>("/api/integrations/iCal", { query });

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
      const query: Record<string, string> = { integrationId: this.integrationId };
      if (this.integrationId === "temp" || this.integrationId.startsWith("temp-")) {
        query.baseUrl = this.baseUrl;
      }
      await $fetch<{ events: ICalEvent[] }>("/api/integrations/iCal", { query });

      this.status = {
        isConnected: true,
        lastChecked: new Date(),
      };

      return true;
    }
    catch (error) {
      consola.error("iCalendar: iCal connection test error:", error);
      this.status = {
        isConnected: false,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
      return false;
    }
  }

  async getCapabilities(): Promise<string[]> {
    const config = integrationRegistry.get("calendar:ical");
    return config?.capabilities || [];
  }

  async getEvents(): Promise<CalendarEvent[]> {
    const query: Record<string, string> = { integrationId: this.integrationId };
    if (this.integrationId === "temp" || this.integrationId.startsWith("temp-")) {
      query.baseUrl = this.baseUrl;
    }
    const result = await $fetch<{ events: ICalEvent[] }>("/api/integrations/iCal", { query });

    let users: UserWithColor[] = [];
    if (this.useUserColors && this.user && this.user.length > 0) {
      try {
        const allUsers = await $fetch<{ id: string; name: string; color: string | null }[]>("/api/users");
        if (allUsers) {
          users = allUsers.filter((user: UserWithColor) => this.user?.includes(user.id));
        }
      }
      catch (error) {
        consola.warn("iCalendar: Failed to fetch users for iCal integration:", error);
      }
    }

    return result.events.map((event) => {
      const start = new Date(event.dtstart);
      const end = new Date(event.dtend);

      // Determine if this is an all-day event based on iCalendar RFC 5545 standard
      // All-day events typically have:
      // 1. DATE value type for DTSTART (no time component)
      // 2. DATETIME with time 00:00:00 for both DTSTART and DTEND
      const isDateOnly = !event.dtstart.includes("T") && !event.dtstart.includes("Z");
      const isMidnightToMidnight = event.dtstart.includes("T00:00:00")
        && event.dtend.includes("T00:00:00")
        && new Date(event.dtend).getTime() - new Date(event.dtstart).getTime() === 24 * 60 * 60 * 1000;

      const isAllDay = isDateOnly || isMidnightToMidnight;

      let color: string | string[] | undefined = this.eventColor || DEFAULT_LOCAL_EVENT_COLOR;
      if (this.useUserColors && users.length > 0) {
        const userColors = users.map((user: UserWithColor) => user.color).filter((color): color is string => color !== null);
        if (userColors.length > 0) {
          color = userColors.length === 1 ? userColors[0] : userColors;
        }
        else {
          color = this.eventColor || DEFAULT_LOCAL_EVENT_COLOR;
        }
      }
      else {
        color = this.eventColor || DEFAULT_LOCAL_EVENT_COLOR;
      }

      return {
        id: event.uid,
        title: event.summary,
        description: event.description || "",
        start,
        end,
        allDay: isAllDay,
        color,
        location: event.location,
        ical_event: event,
        integrationId: this.integrationId,
        users: this.useUserColors ? users : undefined,
      };
    });
  }
}

export function createICalService(
  integrationId: string,
  baseUrl: string,
  eventColor: string = DEFAULT_LOCAL_EVENT_COLOR,
  user?: string | string[],
  useUserColors: boolean = false,
): ICalService {
  return new ICalService(integrationId, baseUrl, eventColor, user as string[], useUserColors);
}
