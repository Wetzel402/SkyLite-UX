import { consola } from "consola";
import { computed, readonly } from "vue";

import type { CalendarEvent, SourceCalendar } from "~/types/calendar";
import type { Integration } from "~/types/database";
import type {
  CalendarConfig,
  CalendarIntegrationService,
  IntegrationService,
} from "~/types/integrations";

import { integrationRegistry } from "~/types/integrations";

import { useCalendar } from "./useCalendar";
import { useIntegrations } from "./useIntegrations";
import { useSyncManager } from "./useSyncManager";
import { useUsers } from "./useUsers";

function isCalendarService(
  service: IntegrationService | null | undefined,
): service is CalendarIntegrationService {
  return (
    service !== null &&
    service !== undefined &&
    typeof (service as CalendarIntegrationService).getEvents === "function"
  );
}

function resolveIntegrationCapabilities(integration: Integration): string[] {
  const config = integrationRegistry.get(
    `${integration.type}:${integration.service}`,
  );
  return config?.capabilities || [];
}

function mapSourceCalendars(
  integration: Integration,
  event: CalendarEvent,
  capabilities: string[],
  eventColor: string,
  userColor?: string,
): SourceCalendar[] {
  const hasEditEvents = capabilities.includes("edit_events");
  const supportsSelectCalendars = capabilities.includes("select_calendars");
  const calendars = Array.isArray(integration.settings?.calendars)
    ? (integration.settings?.calendars as CalendarConfig[])
    : [];

  if (supportsSelectCalendars && calendars.length > 0) {
    if (event.calendarId) {
      const calendar = calendars.find((c) => c.id === event.calendarId);
      if (calendar) {
        const accessRole =
          hasEditEvents && calendar.accessRole === "write" ? "write" : "read";
        return [
          {
            integrationId: integration.id,
            integrationName: integration.name || integration.service,
            calendarId: calendar.id,
            calendarName: calendar.name,
            accessRole,
            canEdit: accessRole === "write",
            eventColor,
            userColor,
            eventId: event.id,
          },
        ];
      }
    }

    return [
      {
        integrationId: integration.id,
        integrationName: integration.name || integration.service,
        calendarId: event.calendarId || integration.id,
        calendarName: event.calendarId,
        accessRole: "read",
        canEdit: false,
        eventColor,
        userColor,
        eventId: event.id,
      },
    ];
  }

  const accessRole = hasEditEvents ? "write" : "read";
  return [
    {
      integrationId: integration.id,
      integrationName: integration.name || integration.service,
      calendarId: event.calendarId || integration.id,
      calendarName: event.calendarId,
      accessRole,
      canEdit: hasEditEvents,
      eventColor,
      userColor,
      eventId: event.id,
    },
  ];
}

export function useCalendarIntegrations() {
  const { combineEvents, getEventUserColors, getIntegrationEvents } =
    useCalendar();
  const {
    integrations,
    loading: integrationsLoading,
    error: integrationsError,
    getService,
  } = useIntegrations();
  const { users } = useUsers();

  const calendarIntegrations = computed(() =>
    (integrations.value as Integration[]).filter(
      (integration) => integration.type === "calendar" && integration.enabled,
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
        if (!events || !Array.isArray(events)) return;

        const capabilities = resolveIntegrationCapabilities(integration);
        const supportsSelectCalendars =
          capabilities.includes("select_calendars");
        const calendars = Array.isArray(integration.settings?.calendars)
          ? (integration.settings?.calendars as CalendarConfig[])
          : [];

        allEvents.push(
          ...events.map((event: CalendarEvent) => {
            let eventColor: string;
            let userIds: string[] | undefined;
            let useUserColors: boolean | undefined;

            if (
              supportsSelectCalendars &&
              calendars.length > 0 &&
              event.calendarId
            ) {
              const calendarConfig = calendars.find(
                (c) => c.id === event.calendarId,
              );
              eventColor = calendarConfig?.eventColor || "#06b6d4";
              userIds = calendarConfig?.user;
              useUserColors = calendarConfig?.useUserColors;
            } else {
              eventColor =
                (integration.settings?.eventColor as string) || "#06b6d4";
              userIds = integration.settings?.user as string[] | undefined;
              useUserColors = integration.settings?.useUserColors as
                | boolean
                | undefined;
            }

            const eventUsers =
              userIds
                ?.map((userId) =>
                  users.value?.find((user) => user.id === userId),
                )
                .filter(Boolean)
                .map((user) => ({
                  id: user!.id,
                  name: user!.name,
                  avatar: user!.avatar,
                  color: user!.color,
                })) || [];
            const userColor =
              eventUsers.find((u) => u.color !== null && u.color !== undefined)
                ?.color ?? undefined;

            return {
              ...event,
              users: eventUsers,
              color: getEventUserColors(event, {
                eventColor,
                useUserColors,
                defaultColor: "#06b6d4",
              }),
              integrationId: integration.id,
              integrationName: integration.name || "Unknown",
              sourceCalendars: mapSourceCalendars(
                integration,
                event,
                capabilities,
                eventColor,
                userColor,
              ),
            };
          }),
        );
      } catch (error) {
        consola.warn(
          `Use Calendar Integrations: Failed to process calendar events for integration ${integration.id}:`,
          error,
        );
      }
    });

    return combineEvents(allEvents);
  });

  const calendarSyncStatus = computed(() => {
    const { getCalendarSyncData } = useSyncManager();
    return getCalendarSyncData();
  });

  const getProcessedIntegrationEvents = (
    integrationId: string,
  ): CalendarEvent[] => {
    const integration = calendarIntegrations.value.find(
      (i) => i.id === integrationId,
    );
    if (!integration) return [];

    try {
      const events = getIntegrationEvents(integrationId);
      if (!events || !Array.isArray(events)) return [];

      const capabilities = resolveIntegrationCapabilities(integration);
      const supportsSelectCalendars = capabilities.includes("select_calendars");
      const calendars = Array.isArray(integration.settings?.calendars)
        ? (integration.settings?.calendars as CalendarConfig[])
        : [];

      return events.map((event: CalendarEvent) => {
        let eventColor: string;
        let userIds: string[] | undefined;
        let useUserColors: boolean | undefined;

        if (
          supportsSelectCalendars &&
          calendars.length > 0 &&
          event.calendarId
        ) {
          const calendarConfig = calendars.find(
            (c) => c.id === event.calendarId,
          );
          eventColor = calendarConfig?.eventColor || "#06b6d4";
          userIds = calendarConfig?.user;
          useUserColors = calendarConfig?.useUserColors;
        } else {
          eventColor =
            (integration.settings?.eventColor as string) || "#06b6d4";
          userIds = integration.settings?.user as string[] | undefined;
          useUserColors = integration.settings?.useUserColors as
            | boolean
            | undefined;
        }

        const eventUsers =
          userIds
            ?.map((userId) => users.value?.find((user) => user.id === userId))
            .filter(Boolean)
            .map((user) => ({
              id: user!.id,
              name: user!.name,
              avatar: user!.avatar,
              color: user!.color,
            })) || [];
        const userColor =
          eventUsers.find((u) => u.color !== null && u.color !== undefined)
            ?.color ?? undefined;

        return {
          ...event,
          users: eventUsers,
          color: getEventUserColors(event, {
            eventColor,
            useUserColors,
            defaultColor: "#06b6d4",
          }),
          integrationId: integration.id,
          integrationName: integration.name || "Unknown",
          sourceCalendars: mapSourceCalendars(
            integration,
            event,
            capabilities,
            eventColor,
            userColor,
          ),
        };
      });
    } catch (error) {
      consola.warn(
        `Use Calendar Integrations: Failed to process events for integration ${integrationId}:`,
        error,
      );
      return [];
    }
  };

  function getCalendarAccessRole(
    integrationId: string,
    calendarId: string,
  ): "read" | "write" | null {
    const integration = calendarIntegrations.value.find(
      (i) => i.id === integrationId,
    );
    if (!integration) return null;

    const settings = integration.settings as { calendars?: CalendarConfig[] };
    const calendar = settings?.calendars?.find((c) => c.id === calendarId);

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
    } catch (err) {
      consola.error(
        `Use Calendar Integrations: Error updating event ${eventId} in integration ${integrationId}:`,
        err,
      );
      throw err;
    }
  };

  const getCalendarEvent = async (
    integrationId: string,
    eventId: string,
    calendarId?: string,
  ): Promise<CalendarEvent> => {
    const service = calendarServices.value.get(integrationId);
    if (!service) {
      throw new Error(`Integration service not found for ${integrationId}`);
    }

    if (!service.getEvent) {
      throw new Error(
        `Integration service does not support fetching individual events`,
      );
    }

    try {
      const event = await service.getEvent(eventId, calendarId);
      return event;
    } catch (err) {
      consola.error(`Error fetching event ${eventId}:`, err);
      throw err;
    }
  };

  const deleteCalendarEvent = async (
    integrationId: string,
    eventId: string,
    calendarId?: string,
  ): Promise<void> => {
    const service = calendarServices.value.get(integrationId);
    if (!service) {
      throw new Error(`Integration service not found for ${integrationId}`);
    }

    if (!service.deleteEvent) {
      throw new Error(`Integration service does not support deleting events`);
    }

    try {
      await service.deleteEvent(eventId, calendarId);
    } catch (err) {
      consola.error(
        `Use Calendar Integrations: Error deleting event ${eventId} in integration ${integrationId}:`,
        err,
      );
      throw err;
    }
  };

  const addCalendarEvent = async (
    integrationId: string,
    calendarId: string,
    eventData: Partial<CalendarEvent>,
  ): Promise<CalendarEvent> => {
    const service = calendarServices.value.get(integrationId);
    if (!service) {
      throw new Error(`Integration service not found for ${integrationId}`);
    }

    if (!service.addEvent) {
      throw new Error(`Integration service does not support adding events`);
    }

    try {
      const event = await service.addEvent(calendarId, eventData);
      return event;
    } catch (err) {
      consola.error(
        `Use Calendar Integrations: Error adding event in integration ${integrationId}:`,
        err,
      );
      throw err;
    }
  };

  const getAvailableCalendars = async (
    integrationId: string,
  ): Promise<CalendarConfig[]> => {
    const service = calendarServices.value.get(integrationId);
    if (!service) {
      return [];
    }

    if (!service.getAvailableCalendars) {
      return [];
    }

    try {
      const calendars = await service.getAvailableCalendars();
      return calendars.filter((c) => c.accessRole === "write") || [];
    } catch (err) {
      consola.error(
        `Use Calendar Integrations: Error fetching calendars for integration ${integrationId}:`,
        err,
      );
      return [];
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
    getCalendarEvent,
    deleteCalendarEvent,
    addCalendarEvent,
    getAvailableCalendars,
  };
}
