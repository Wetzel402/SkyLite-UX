import consola from "consola";

import type { CalendarEvent } from "~/types/calendar";
import type { CalendarIntegrationService, IntegrationStatus } from "~/types/integrations";

import { DEFAULT_LOCAL_EVENT_COLOR } from "~/types/global";
import { integrationRegistry } from "~/types/integrations";

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
      consola.info(`[iCal ${this.integrationId}] Starting validation...`);
      const query: Record<string, string> = { integrationId: this.integrationId };
      if (this.integrationId === "temp" || this.integrationId.startsWith("temp-")) {
        query.baseUrl = this.baseUrl;
      }

      const result = await $fetch<{ events: CalendarEvent[] }>("/api/integrations/iCal", { query });
      consola.info(`[iCal ${this.integrationId}] Validation successful - fetched ${result.events.length} events`);

      this.status = {
        isConnected: true,
        lastChecked: new Date(),
      };

      return true;
    }
    catch (error) {
      consola.error(`[iCal ${this.integrationId}] Validation failed:`, error);
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
      await $fetch<{ events: CalendarEvent[] }>("/api/integrations/iCal", { query });

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

    // The API endpoint now handles all transformation from ICalEvent to CalendarEvent
    // including date parsing, color handling, user assignment, and unique ID generation
    const result = await $fetch<{ events: CalendarEvent[] }>("/api/integrations/iCal", { query });

    consola.info(`[iCal ${this.integrationId}] Fetched ${result.events.length} events from feed`);

    // Events are already fully transformed by the API, just return them
    return result.events;
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
