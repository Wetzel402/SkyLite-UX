import type { CalendarEvent } from "~/types/calendar";
import type { CalendarIntegrationService, IntegrationStatus } from "~/types/integrations";

/**
 * Client-side Google Calendar integration service
 * Implements CalendarIntegrationService interface for frontend
 */
export class GoogleCalendarService implements CalendarIntegrationService {
  private integrationId: string;
  private status: IntegrationStatus = {
    isConnected: false,
    lastChecked: new Date(),
  };

  constructor(integrationId: string) {
    this.integrationId = integrationId;
  }

  async initialize(): Promise<void> {
    await this.validate();
  }

  async validate(): Promise<boolean> {
    try {
      await $fetch("/api/integrations/google-calendar/events", {
        query: { integrationId: this.integrationId },
      });

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
    return this.validate();
  }

  async getCapabilities(): Promise<string[]> {
    return ["get_events", "add_events", "edit_events", "delete_events"];
  }

  async getEvents(): Promise<CalendarEvent[]> {
    const result = await $fetch<{ events: CalendarEvent[] }>(
      "/api/integrations/google-calendar/events",
      { query: { integrationId: this.integrationId } },
    );

    return result.events;
  }
}

/**
 * Factory function to create Google Calendar service instance
 */
export function createGoogleCalendarService(integrationId: string): GoogleCalendarService {
  return new GoogleCalendarService(integrationId);
}
