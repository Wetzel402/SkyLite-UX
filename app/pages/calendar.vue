<script setup lang="ts">
import type {
  CalendarEvent,
  IntegrationTarget,
  SourceCalendar,
} from "~/types/calendar";
import type { Integration } from "~/types/database";

import { useAlertToast } from "~/composables/useAlertToast";
import { useCalendar } from "~/composables/useCalendar";
import { useCalendarEvents } from "~/composables/useCalendarEvents";
import { useCalendarIntegrations } from "~/composables/useCalendarIntegrations";
import { useIntegrations } from "~/composables/useIntegrations";
import { integrationRegistry } from "~/types/integrations";

const { allEvents, getEventUserColors } = useCalendar();
const { showError, showSuccess } = useAlertToast();
const { addCalendarEvent, updateCalendarEvent, getCalendarAccessRole } =
  useCalendarIntegrations();

const nuxtApp = useNuxtApp();
function updateIntegrationCache(integrationId: string, data: unknown) {
  nuxtApp.payload.data = {
    ...nuxtApp.payload.data,
    [`calendar-events-${integrationId}`]: data,
  };
}

function getWritableSourceTargets(event: CalendarEvent): IntegrationTarget[] {
  const writableSources = event.sourceCalendars?.filter(
    (source) => source.canEdit,
  );
  if (writableSources && writableSources.length > 0) {
    return writableSources.map((source) => ({
      integrationId: source.integrationId,
      calendarId: source.calendarId,
    }));
  }
  if (event.integrationId) {
    return [
      {
        integrationId: event.integrationId,
        calendarId: event.calendarId,
      },
    ];
  }
  return [];
}

function separateLocalAndIntegrationCalendars(event: {
  id: string;
  sourceCalendars?: readonly SourceCalendar[] | SourceCalendar[];
}): {
  localCalendar: { eventId: string } | null;
  integrationTargets: IntegrationTarget[];
} {
  const writableSources =
    (event.sourceCalendars as SourceCalendar[] | undefined)?.filter(
      (source) => source.canEdit,
    ) || [];

  const localCalendar =
    writableSources.find(
      (source) =>
        source.calendarId === "local" ||
        !source.integrationId ||
        source.integrationId === "",
    ) || null;

  const integrationTargets = writableSources
    .filter(
      (source) =>
        source.calendarId !== "local" &&
        source.integrationId &&
        source.integrationId !== "",
    )
    .map((source) => ({
      integrationId: source.integrationId!,
      calendarId: source.calendarId,
    }));

  return {
    localCalendar: localCalendar
      ? { eventId: localCalendar.eventId || event.id }
      : null,
    integrationTargets,
  };
}

async function createIntegrationEvent(
  event: CalendarEvent,
  target: IntegrationTarget,
): Promise<void> {
  if (!target.calendarId) {
    throw new Error("Missing calendarId for integration event");
  }

  const cacheKey = `calendar-events-${target.integrationId}`;
  const { data: cachedEvents } = useNuxtData<CalendarEvent[]>(cacheKey);
  const previousEvents = cachedEvents.value ? [...cachedEvents.value] : [];
  const prevPayload = Array.isArray(nuxtApp.payload.data[cacheKey])
    ? [...(nuxtApp.payload.data[cacheKey] as CalendarEvent[])]
    : [];

  const tempId = `temp-${target.integrationId}-${Date.now()}`;
  const tempEvent: CalendarEvent = {
    ...event,
    id: tempId,
    integrationId: target.integrationId,
    calendarId: target.calendarId || undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    color: getEventUserColors(event),
  } as CalendarEvent;

  if (cachedEvents.value && Array.isArray(cachedEvents.value)) {
    cachedEvents.value.push(tempEvent);
  }
  {
    const existing = Array.isArray(nuxtApp.payload.data[cacheKey])
      ? (nuxtApp.payload.data[cacheKey] as CalendarEvent[])
      : [];
    updateIntegrationCache(target.integrationId, [...existing, tempEvent]);
  }

  try {
    const created = await addCalendarEvent(
      target.integrationId,
      target.calendarId,
      {
        ...event,
        integrationId: target.integrationId,
        calendarId: target.calendarId,
      } as CalendarEvent,
    );

    if (cachedEvents.value && Array.isArray(cachedEvents.value)) {
      const idx = cachedEvents.value.findIndex((e) => e.id === tempId);
      if (idx !== -1) {
        cachedEvents.value[idx] = created as CalendarEvent;
      }
    }
    {
      const existing = Array.isArray(nuxtApp.payload.data[cacheKey])
        ? (nuxtApp.payload.data[cacheKey] as CalendarEvent[])
        : [];
      const idx = existing.findIndex((e) => e.id === tempId);
      if (idx !== -1) {
        const updated = [...existing];
        updated[idx] = created as CalendarEvent;
        updateIntegrationCache(target.integrationId, updated);
      }
    }

    await refreshNuxtData(cacheKey);
  } catch (error) {
    if (cachedEvents.value && previousEvents.length > 0) {
      cachedEvents.value.splice(
        0,
        cachedEvents.value.length,
        ...previousEvents,
      );
    }
    updateIntegrationCache(target.integrationId, prevPayload);
    throw error;
  }
}

async function updateIntegrationEvent(
  event: CalendarEvent,
  target: IntegrationTarget,
  baseEventId: string,
): Promise<void> {
  const cacheKey = `calendar-events-${target.integrationId}`;
  const { data: cachedEvents } = useNuxtData<CalendarEvent[]>(cacheKey);
  const previousEvents = cachedEvents.value ? [...cachedEvents.value] : [];
  const prevPayload = Array.isArray(nuxtApp.payload.data[cacheKey])
    ? [...(nuxtApp.payload.data[cacheKey] as CalendarEvent[])]
    : [];

  if (cachedEvents.value && Array.isArray(cachedEvents.value)) {
    const idx = cachedEvents.value.findIndex(
      (e: CalendarEvent) => e.id === baseEventId,
    );
    if (idx !== -1 && cachedEvents.value[idx]) {
      cachedEvents.value[idx] = {
        ...cachedEvents.value[idx],
        ...event,
        integrationId: target.integrationId,
        calendarId: target.calendarId || cachedEvents.value[idx]!.calendarId,
      } as CalendarEvent;
    }
  }
  {
    const existing = Array.isArray(nuxtApp.payload.data[cacheKey])
      ? (nuxtApp.payload.data[cacheKey] as CalendarEvent[])
      : [];
    const idx = existing.findIndex((e: CalendarEvent) => e.id === baseEventId);
    if (idx !== -1 && existing[idx]) {
      const updated = [...existing];
      updated[idx] = {
        ...updated[idx],
        ...event,
        integrationId: target.integrationId,
        calendarId: target.calendarId || existing[idx]!.calendarId,
      } as CalendarEvent;
      updateIntegrationCache(target.integrationId, updated);
    }
  }

  try {
    await updateCalendarEvent(target.integrationId, baseEventId, {
      ...event,
      integrationId: target.integrationId,
      calendarId: target.calendarId,
    } as CalendarEvent);
    await refreshNuxtData(cacheKey);
  } catch (error) {
    if (cachedEvents.value && previousEvents.length > 0) {
      cachedEvents.value.splice(
        0,
        cachedEvents.value.length,
        ...previousEvents,
      );
    }
    updateIntegrationCache(target.integrationId, prevPayload);
    throw error;
  }
}

async function handleEventAdd(event: CalendarEvent) {
  try {
    if (!event.integrationId) {
      const { data: cachedEvents } = useNuxtData("calendar-events");
      const previousEvents = cachedEvents.value ? [...cachedEvents.value] : [];

      const newEvent = {
        ...event,
        id: `temp-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (cachedEvents.value && Array.isArray(cachedEvents.value)) {
        cachedEvents.value.push(newEvent);
      }

      try {
        const eventColor = getEventUserColors(event);
        const { createEvent } = useCalendarEvents();
        const createdEvent = await createEvent({
          title: event.title,
          description: event.description,
          start: event.start,
          end: event.end,
          allDay: event.allDay,
          color: eventColor,
          location: event.location,
          ical_event: event.ical_event,
          users: event.users,
        });

        if (cachedEvents.value && Array.isArray(cachedEvents.value)) {
          const tempIndex = cachedEvents.value.findIndex(
            (e: CalendarEvent) => e.id === newEvent.id,
          );
          if (tempIndex !== -1) {
            cachedEvents.value[tempIndex] = createdEvent;
          }
        }

        showSuccess("Event Created", "Local event created successfully");
      } catch (error) {
        if (cachedEvents.value && previousEvents.length > 0) {
          cachedEvents.value.splice(
            0,
            cachedEvents.value.length,
            ...previousEvents,
          );
        }
        throw error;
      }
    } else {
      const targets = getWritableSourceTargets(event);
      if (targets.length === 0) {
        showError(
          "Calendar Not Selected",
          "Please select a writable calendar for this event.",
        );
        return;
      }

      for (const target of targets) {
        if (!target.calendarId) {
          showError(
            "Calendar Not Selected",
            "Please select a calendar for this event.",
          );
          return;
        }
        await createIntegrationEvent(event, target);
      }
      showSuccess("Event Created", "Calendar event created successfully");
    }
  } catch {
    showError(
      "Failed to Create Event",
      "Failed to create the event. Please try again.",
    );
  }
}

async function handleEventUpdate(event: CalendarEvent) {
  try {
    const writableSources =
      event.sourceCalendars?.filter((source) => source.canEdit) || [];

    if (writableSources.length > 0) {
      const { localCalendar, integrationTargets } =
        separateLocalAndIntegrationCalendars(event);

      const updatePromises: Promise<void>[] = [];
      const errors: Error[] = [];

      if (localCalendar) {
        const localUpdatePromise = (async () => {
          const { data: cachedEvents } = useNuxtData("calendar-events");
          const previousEvents = cachedEvents.value
            ? [...cachedEvents.value]
            : [];

          try {
            if (cachedEvents.value && Array.isArray(cachedEvents.value)) {
              const eventIndex = cachedEvents.value.findIndex(
                (e: CalendarEvent) => e.id === localCalendar.eventId,
              );
              if (eventIndex !== -1) {
                cachedEvents.value[eventIndex] = {
                  ...cachedEvents.value[eventIndex],
                  ...event,
                };
              }
            }

            const eventColor = getEventUserColors(event);
            const { updateEvent } = useCalendarEvents();
            await updateEvent(localCalendar.eventId, {
              title: event.title,
              description: event.description,
              start: event.start,
              end: event.end,
              allDay: event.allDay,
              color: eventColor,
              location: event.location,
              ical_event: event.ical_event,
              users: event.users,
            });
          } catch (error) {
            if (cachedEvents.value && previousEvents.length > 0) {
              const eventIndex = previousEvents.findIndex(
                (e: CalendarEvent) => e.id === localCalendar.eventId,
              );
              if (
                eventIndex !== -1 &&
                cachedEvents.value &&
                Array.isArray(cachedEvents.value)
              ) {
                cachedEvents.value[eventIndex] = previousEvents[eventIndex]!;
              }
            }
            errors.push(error as Error);
            throw error;
          }
        })();
        updatePromises.push(localUpdatePromise);
      }

      for (const target of integrationTargets) {
        const integrationUpdatePromise = (async () => {
          try {
            const sourceCalendar = event.sourceCalendars?.find(
              (sc) =>
                sc.integrationId === target.integrationId &&
                sc.calendarId === target.calendarId,
            );
            const eventId =
              sourceCalendar?.eventId ||
              (event.id.includes("-") ? event.id.split("-")[0] : event.id);
            await updateIntegrationEvent(event, target, eventId as string);
          } catch (error) {
            errors.push(error as Error);
            throw error;
          }
        })();
        updatePromises.push(integrationUpdatePromise);
      }

      const results = await Promise.allSettled(updatePromises);
      const failed = results.filter((r) => r.status === "rejected");

      if (failed.length > 0) {
        const errorMessages = failed
          .map((r) => {
            if (r.status === "rejected") {
              return r.reason?.message || "Unknown error";
            }
            return "";
          })
          .filter(Boolean);
        showError(
          "Partial Update Failure",
          `Some calendars failed to update: ${errorMessages.join(", ")}`,
        );
      } else {
        const updatedCount = localCalendar
          ? integrationTargets.length + 1
          : integrationTargets.length;
        showSuccess(
          "Event Updated",
          `Calendar event updated successfully in ${updatedCount} calendar${updatedCount > 1 ? "s" : ""}`,
        );
      }
    } else if (!event.integrationId) {
      const { data: cachedEvents } = useNuxtData("calendar-events");
      const previousEvents = cachedEvents.value ? [...cachedEvents.value] : [];

      if (cachedEvents.value && Array.isArray(cachedEvents.value)) {
        const eventIndex = cachedEvents.value.findIndex(
          (e: CalendarEvent) => e.id === event.id,
        );
        if (eventIndex !== -1) {
          cachedEvents.value[eventIndex] = {
            ...cachedEvents.value[eventIndex],
            ...event,
          };
        }
      }

      try {
        const eventColor = getEventUserColors(event);
        const { updateEvent } = useCalendarEvents();
        await updateEvent(event.id, {
          title: event.title,
          description: event.description,
          start: event.start,
          end: event.end,
          allDay: event.allDay,
          color: eventColor,
          location: event.location,
          ical_event: event.ical_event,
          users: event.users,
        });

        showSuccess("Event Updated", "Local event updated successfully");
      } catch (error) {
        if (cachedEvents.value && previousEvents.length > 0) {
          cachedEvents.value.splice(
            0,
            cachedEvents.value.length,
            ...previousEvents,
          );
        }
        throw error;
      }
    } else {
      const targets = getWritableSourceTargets(event);
      if (targets.length === 0) {
        showError(
          "Read Only Event",
          "No connected calendars allow edits for this event.",
        );
        return;
      }

      for (const target of targets) {
        const sourceCalendar = event.sourceCalendars?.find(
          (sc) =>
            sc.integrationId === target.integrationId &&
            sc.calendarId === target.calendarId,
        );
        const eventId =
          sourceCalendar?.eventId ||
          (event.id.includes("-") ? event.id.split("-")[0] : event.id);
        await updateIntegrationEvent(event, target, eventId as string);
      }

      showSuccess("Event Updated", "Calendar event updated successfully");
    }
  } catch {
    showError(
      "Failed to Update Event",
      "Failed to update the event. Please try again.",
    );
  }
}

async function handleEventDelete(eventId: string) {
  try {
    const event = allEvents.value.find((e) => e.id === eventId);

    if (!event) {
      showError("Event Not Found", "The event could not be found.");
      return;
    }

    const writableSources =
      event.sourceCalendars?.filter((source) => source.canEdit) || [];

    if (writableSources.length > 0) {
      const { localCalendar, integrationTargets } =
        separateLocalAndIntegrationCalendars({
          id: event.id,
          sourceCalendars: event.sourceCalendars as
            | SourceCalendar[]
            | undefined,
        } as { id: string; sourceCalendars?: SourceCalendar[] });

      const deletePromises: Promise<void>[] = [];
      const errors: Error[] = [];

      if (localCalendar) {
        const localDeletePromise = (async () => {
          const { data: cachedEvents } = useNuxtData("calendar-events");
          const previousEvents = cachedEvents.value
            ? [...cachedEvents.value]
            : [];

          try {
            if (cachedEvents.value && Array.isArray(cachedEvents.value)) {
              cachedEvents.value = cachedEvents.value.filter(
                (e: CalendarEvent) => e.id !== localCalendar.eventId,
              );
            }

            const { deleteEvent } = useCalendarEvents();
            await deleteEvent(localCalendar.eventId);
          } catch (error) {
            if (cachedEvents.value && previousEvents.length > 0) {
              cachedEvents.value.splice(
                0,
                cachedEvents.value.length,
                ...previousEvents,
              );
            }
            errors.push(error as Error);
            throw error;
          }
        })();
        deletePromises.push(localDeletePromise);
      }

      for (const target of integrationTargets) {
        const integrationDeletePromise = (async () => {
          const cacheKey = `calendar-events-${target.integrationId}`;
          const { data: cachedEvents } = useNuxtData(cacheKey);
          const previousEvents = cachedEvents.value
            ? [...cachedEvents.value]
            : [];

          const sourceCalendar = event.sourceCalendars?.find(
            (sc) =>
              sc.integrationId === target.integrationId &&
              sc.calendarId === target.calendarId,
          );
          const baseEventId =
            sourceCalendar?.eventId ||
            (event.id.includes("-") ? event.id.split("-")[0] : event.id) ||
            event.id;

          try {
            if (cachedEvents.value && Array.isArray(cachedEvents.value)) {
              cachedEvents.value = cachedEvents.value.filter(
                (e: CalendarEvent) => e.id !== baseEventId,
              ) as unknown as CalendarEvent[];
            }
            {
              const existing = Array.isArray(nuxtApp.payload.data[cacheKey])
                ? (nuxtApp.payload.data[cacheKey] as CalendarEvent[])
                : [];
              const updated = existing.filter(
                (e: CalendarEvent) => e.id !== baseEventId,
              );
              updateIntegrationCache(target.integrationId, updated);
            }

            const { deleteCalendarEvent } = useCalendarIntegrations();
            if (target.calendarId && typeof target.calendarId === "string") {
              await deleteCalendarEvent(
                target.integrationId,
                baseEventId,
                target.calendarId,
              );
            } else {
              await deleteCalendarEvent(target.integrationId, baseEventId);
            }

            await refreshNuxtData(cacheKey);
          } catch (error) {
            if (cachedEvents.value && previousEvents.length > 0) {
              cachedEvents.value.splice(
                0,
                cachedEvents.value.length,
                ...previousEvents,
              );
            }
            await refreshNuxtData(cacheKey);
            errors.push(error as Error);
            throw error;
          }
        })();
        deletePromises.push(integrationDeletePromise);
      }

      const results = await Promise.allSettled(deletePromises);
      const failed = results.filter((r) => r.status === "rejected");

      if (failed.length > 0) {
        const errorMessages = failed
          .map((r) => {
            if (r.status === "rejected") {
              return r.reason?.message || "Unknown error";
            }
            return "";
          })
          .filter(Boolean);
        showError(
          "Partial Delete Failure",
          `Some calendars failed to delete: ${errorMessages.join(", ")}`,
        );
      } else {
        const deletedCount = localCalendar
          ? integrationTargets.length + 1
          : integrationTargets.length;
        showSuccess(
          "Event Deleted",
          `Calendar event deleted successfully from ${deletedCount} calendar${deletedCount > 1 ? "s" : ""}`,
        );
      }
    } else if (!event.integrationId) {
      const { data: cachedEvents } = useNuxtData("calendar-events");
      const previousEvents = cachedEvents.value ? [...cachedEvents.value] : [];

      if (cachedEvents.value && Array.isArray(cachedEvents.value)) {
        cachedEvents.value.splice(
          0,
          cachedEvents.value.length,
          ...cachedEvents.value.filter((e: CalendarEvent) => e.id !== eventId),
        );
      }

      try {
        const { deleteEvent } = useCalendarEvents();
        await deleteEvent(eventId);
        showSuccess("Event Deleted", "Local event deleted successfully");
      } catch (error) {
        if (cachedEvents.value && previousEvents.length > 0) {
          cachedEvents.value.splice(
            0,
            cachedEvents.value.length,
            ...previousEvents,
          );
        }
        throw error;
      }
    } else {
      const cacheKey = `calendar-events-${event.integrationId}`;
      const { data: cachedEvents } = useNuxtData(cacheKey);
      const previousEvents = cachedEvents.value ? [...cachedEvents.value] : [];

      const isExpanded = event.id.includes("-");
      const baseEventId = isExpanded
        ? event.id.split("-")[0] || event.id
        : event.id;

      if (cachedEvents.value && Array.isArray(cachedEvents.value)) {
        cachedEvents.value = cachedEvents.value.filter(
          (e: CalendarEvent) => e.id !== baseEventId,
        ) as unknown as CalendarEvent[];
      }
      {
        const existing = Array.isArray(nuxtApp.payload.data[cacheKey])
          ? (nuxtApp.payload.data[cacheKey] as CalendarEvent[])
          : [];
        const updated = existing.filter(
          (e: CalendarEvent) => e.id !== baseEventId,
        );
        updateIntegrationCache(event.integrationId, updated);
      }

      try {
        const { deleteCalendarEvent } = useCalendarIntegrations();
        await deleteCalendarEvent(
          event.integrationId,
          baseEventId,
          event.calendarId,
        );

        await refreshNuxtData(cacheKey);
        showSuccess("Event Deleted", "Calendar event deleted successfully");
      } catch (error) {
        if (cachedEvents.value && previousEvents.length > 0) {
          cachedEvents.value.splice(
            0,
            cachedEvents.value.length,
            ...previousEvents,
          );
        }
        await refreshNuxtData(cacheKey);
        throw error;
      }
    }
  } catch {
    showError(
      "Failed to Delete Event",
      "Failed to delete the event. Please try again.",
    );
  }
}

function getEventIntegrationCapabilities(
  event: CalendarEvent,
): { capabilities: string[]; serviceName?: string } | undefined {
  const { integrations } = useIntegrations();

  if (event.sourceCalendars && event.sourceCalendars.length > 0) {
    const capabilitySet = new Set<string>();
    const serviceNames = new Set<string>();

    event.sourceCalendars.forEach((source) => {
      const integration = (
        (integrations.value as readonly Integration[]) || []
      ).find((i) => i.id === source.integrationId);
      if (!integration) return;

      const config = integrationRegistry.get(
        `${integration.type}:${integration.service}`,
      );
      if (!config) return;

      let capabilities = [...config.capabilities];
      serviceNames.add(integration.service);

      if (!source.canEdit) {
        capabilities = capabilities.filter(
          (cap) =>
            !["edit_events", "add_events", "delete_events"].includes(cap),
        );
      }

      capabilities.forEach((capability) => capabilitySet.add(capability));
    });

    if (capabilitySet.size === 0) return undefined;

    const serviceName =
      serviceNames.size === 1 ? Array.from(serviceNames)[0] : undefined;

    return {
      capabilities: Array.from(capabilitySet),
      serviceName,
    };
  }

  const targets = getWritableSourceTargets(event);
  if (targets.length === 0) return undefined;

  const capabilitySet = new Set<string>();
  const serviceNames = new Set<string>();

  targets.forEach((target) => {
    const integration = (
      (integrations.value as readonly Integration[]) || []
    ).find((i) => i.id === target.integrationId);
    if (!integration) return;

    const config = integrationRegistry.get(
      `${integration.type}:${integration.service}`,
    );
    if (!config) return;

    let capabilities = [...config.capabilities];
    serviceNames.add(integration.service);

    if (target.calendarId && capabilities.includes("select_calendars")) {
      const calendarRole = getCalendarAccessRole(
        target.integrationId,
        target.calendarId,
      );

      if (calendarRole === "read") {
        capabilities = capabilities.filter(
          (cap) =>
            !["edit_events", "add_events", "delete_events"].includes(cap),
        );
      }
    }

    capabilities.forEach((capability) => capabilitySet.add(capability));
  });

  if (capabilitySet.size === 0) return undefined;

  const serviceName =
    serviceNames.size === 1 ? Array.from(serviceNames)[0] : undefined;

  return {
    capabilities: Array.from(capabilitySet),
    serviceName,
  };
}
</script>

<!-- TODO: allow user to choose initial view -->
<template>
  <div>
    <CalendarMainView
      :events="allEvents as CalendarEvent[]"
      initial-view="week"
      class="h-[calc(100vh-2rem)]"
      :get-integration-capabilities="getEventIntegrationCapabilities"
      @event-add="handleEventAdd"
      @event-update="handleEventUpdate"
      @event-delete="handleEventDelete"
    />
  </div>
</template>
