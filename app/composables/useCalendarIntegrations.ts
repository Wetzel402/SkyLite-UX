import { consola } from "consola";
import { computed, readonly } from "vue";

import type { CalendarEvent } from "~/types/calendar";
import type { Integration } from "~/types/database";
import type { CalendarConfig, CalendarIntegrationService, IntegrationService } from "~/types/integrations";

import { useCalendar } from "./useCalendar";
import { useIntegrations } from "./useIntegrations";
import { useSyncManager } from "./useSyncManager";
import { useUsers } from "./useUsers";

function isCalendarService(service: IntegrationService | null | undefined): service is CalendarIntegrationService {
  return service !== null && service !== undefined && typeof (service as CalendarIntegrationService).getEvents === "function";
}

export function useCalendarIntegrations() {
  const { combineEvents, getEventUserColors, getIntegrationEvents } = useCalendar();
  const { integrations, loading: integrationsLoading, error: integrationsError, getService } = useIntegrations();
  const { users } = useUsers();

  const calendarIntegrations = computed(() =>
    (integrations.value as Integration[]).filter(integration =>
      integration.type === "calendar" && integration.enabled,
    ),
  );

  const calendarServices = computed(() => {
    const services: Map<string, CalendarIntegrationService> = new Map();
    calendarIntegrations.value.forEach((integration) => {
      const service = getService(integration.id);
      if (isCalendarService(service)) {
        services.set(integration.id, service);
      }
    });
    return services;
  });

  const processedCalendarEvents = computed(() => {
    const allEvents: CalendarEvent[] = [];

    calendarIntegrations.value.forEach((integration) => {
      try {
        const events = getIntegrationEvents(integration.id);
        if (!events || !Array.isArray(events))
          return;

        const eventColor = integration.settings?.eventColor as string || "#06b6d4";
        const userIds = integration.settings?.user as string[] | undefined;
        const useUserColors = integration.settings?.useUserColors as boolean | undefined;

        const eventUsers = userIds?.map(userId =>
          users.value?.find(user => user.id === userId),
        ).filter(Boolean).map(user => ({
          id: user!.id,
          name: user!.name,
          avatar: user!.avatar,
          color: user!.color,
        })) || [];

        allEvents.push(...events.map((event: CalendarEvent) => ({
          ...event,
          users: eventUsers,
          color: getEventUserColors(event, { eventColor, useUserColors, defaultColor: "#06b6d4" }),
          integrationId: integration.id,
          integrationName: integration.name || "Unknown",
        })));
      }
      catch (error) {
        consola.warn(`Use Calendar Integrations: Failed to process calendar events for integration ${integration.id}:`, error);
      }
    });

    return combineEvents(allEvents);
  });

  const calendarSyncStatus = computed(() => {
    const { getCalendarSyncData } = useSyncManager();
    return getCalendarSyncData();
  });

  const getProcessedIntegrationEvents = (integrationId: string): CalendarEvent[] => {
    const integration = calendarIntegrations.value.find(i => i.id === integrationId);
    if (!integration)
      return [];

    try {
      const events = getIntegrationEvents(integrationId);
      if (!events || !Array.isArray(events))
        return [];

      const eventColor = integration.settings?.eventColor as string || "#06b6d4";
      const userIds = integration.settings?.user as string[] | undefined;
      const useUserColors = integration.settings?.useUserColors as boolean | undefined;

      const eventUsers = userIds?.map(userId =>
        users.value?.find(user => user.id === userId),
      ).filter(Boolean).map(user => ({
        id: user!.id,
        name: user!.name,
        avatar: user!.avatar,
        color: user!.color,
      })) || [];

      return events.map((event: CalendarEvent) => ({
        ...event,
        users: eventUsers,
        color: getEventUserColors(event, { eventColor, useUserColors, defaultColor: "#06b6d4" }),
        integrationId: integration.id,
        integrationName: integration.name || "Unknown",
      }));
    }
    catch (error) {
      consola.warn(`Use Calendar Integrations: Failed to process events for integration ${integrationId}:`, error);
      return [];
    }
  };

  function getCalendarAccessRole(integrationId: string, calendarId: string): "read" | "write" | null {
    const integration = calendarIntegrations.value.find(i => i.id === integrationId);
    if (!integration)
      return null;

    const settings = integration.settings as { calendars?: CalendarConfig[] };
    const calendar = settings?.calendars?.find(c => c.id === calendarId);

    return calendar?.accessRole || null;
  }

  function canEditCalendar(integrationId: string, calendarId: string): boolean {
    const role = getCalendarAccessRole(integrationId, calendarId);
    return role === "write";
  }

  const updateCalendarEvent = async (
    integrationId: string,
    eventId: string,
    updates: Partial<CalendarEvent>,
  ): Promise<CalendarEvent> => {
    const service = calendarServices.value.get(integrationId);
    if (!service) {
      throw new Error(`Integration service not found for ${integrationId}`);
    }

    if (!service.updateEvent) {
      throw new Error(`Integration service does not support updating events`);
    }

    try {
      const updatedEvent = await service.updateEvent(eventId, updates);
      return updatedEvent;
    }
    catch (err) {
      consola.error(`Use Calendar Integrations: Error updating event ${eventId} in integration ${integrationId}:`, err);
      throw err;
    }
  };

  return {
    calendarEvents: readonly(processedCalendarEvents),
    calendarIntegrations: readonly(calendarIntegrations),
    calendarServices: readonly(calendarServices),
    calendarSyncStatus: readonly(calendarSyncStatus),

    integrationsLoading: readonly(integrationsLoading),
    integrationsError: readonly(integrationsError),

    getProcessedIntegrationEvents,
    getCalendarAccessRole,
    canEditCalendar,
    updateCalendarEvent,
  };
}
