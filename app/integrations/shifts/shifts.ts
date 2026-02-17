import type { CalendarEvent } from "~/types/calendar";
import type {
  CalendarIntegrationService,
  IntegrationStatus,
  UserWithColor,
} from "~/types/integrations";

import { DEFAULT_LOCAL_EVENT_COLOR } from "~/types/global";

export class ShiftsService implements CalendarIntegrationService {
  private integrationId: string;
  private eventColor: string;
  private user: string[] | undefined;
  private useUserColors: boolean;

  private status: IntegrationStatus = {
    isConnected: false,
    lastChecked: new Date(),
  };

  constructor(
    integrationId: string,
    _apiKey: string,
    _baseUrl: string,
    settings?: { eventColor?: string; user?: string[]; useUserColors?: boolean },
  ) {
    this.integrationId = integrationId;
    this.eventColor = settings?.eventColor ?? DEFAULT_LOCAL_EVENT_COLOR;
    this.user = settings?.user;
    this.useUserColors = settings?.useUserColors ?? false;
    this.status.lastChecked = new Date();
  }

  async initialize(): Promise<void> {
    this.status = { isConnected: true, lastChecked: new Date() };
  }

  async validate(): Promise<boolean> {
    try {
      await $fetch<{ events: CalendarEvent[] }>("/api/integrations/shifts", {
        query: { integrationId: this.integrationId },
      });
      this.status = { isConnected: true, lastChecked: new Date() };
      return true;
    }
    catch {
      this.status = {
        isConnected: false,
        lastChecked: new Date(),
        error: "Failed to load shifts",
      };
      return false;
    }
  }

  async getStatus(): Promise<IntegrationStatus> {
    return this.status;
  }

  async testConnection(): Promise<boolean> {
    this.status = { isConnected: true, lastChecked: new Date() };
    return true;
  }

  async getCapabilities(): Promise<string[]> {
    return ["get_events"];
  }

  async getEvents(): Promise<CalendarEvent[]> {
    const result = await $fetch<{ events: CalendarEvent[] }>(
      "/api/integrations/shifts",
      { query: { integrationId: this.integrationId } },
    );

    let users: UserWithColor[] = [];
    if (this.useUserColors && this.user?.length) {
      try {
        const allUsers = await $fetch<{ id: string; name: string; color: string | null }[]>(
          "/api/users",
        );
        if (allUsers)
          users = allUsers.filter((u: UserWithColor) => this.user?.includes(u.id));
      }
      catch {
        // keep users empty
      }
    }

    return result.events.map(ev => ({
      ...ev,
      color: ev.color ?? this.eventColor,
      users: this.useUserColors && users.length ? users : ev.users,
    }));
  }
}

export function createShiftsService(
  integrationId: string,
  _apiKey: string,
  _baseUrl: string,
  settings?: { eventColor?: string; user?: string[]; useUserColors?: boolean },
): ShiftsService {
  return new ShiftsService(integrationId, _apiKey, _baseUrl, settings);
}
