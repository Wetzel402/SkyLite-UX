<script setup lang="ts">
import type { CalendarEvent } from "~/types/calendar";
import type { Integration } from "~/types/database";

import { useAlertToast } from "~/composables/useAlertToast";
import { useCalendar } from "~/composables/useCalendar";
import { useCalendarEvents } from "~/composables/useCalendarEvents";
import { useCalendarIntegrations } from "~/composables/useCalendarIntegrations";
import { useIntegrations } from "~/composables/useIntegrations";
import { integrationRegistry } from "~/types/integrations";

const { allEvents, getEventUserColors } = useCalendar();
const { showError, showSuccess } = useAlertToast();

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
          const tempIndex = cachedEvents.value.findIndex((e: CalendarEvent) => e.id === newEvent.id);
          if (tempIndex !== -1) {
            cachedEvents.value[tempIndex] = createdEvent;
          }
        }

        showSuccess("Event Created", "Local event created successfully");
      }
      catch (error) {
        if (cachedEvents.value && previousEvents.length > 0) {
          cachedEvents.value.splice(0, cachedEvents.value.length, ...previousEvents);
        }
        throw error;
      }
    }
    else {
      showError("Not Supported", "Adding events to this integration is not yet supported");
    }
  }
  catch {
    showError("Failed to Create Event", "Failed to create the event. Please try again.");
  }
}

async function handleEventUpdate(event: CalendarEvent) {
  try {
    if (!event.integrationId) {
      const { data: cachedEvents } = useNuxtData("calendar-events");
      const previousEvents = cachedEvents.value ? [...cachedEvents.value] : [];

      if (cachedEvents.value && Array.isArray(cachedEvents.value)) {
        const eventIndex = cachedEvents.value.findIndex((e: CalendarEvent) => e.id === event.id);
        if (eventIndex !== -1) {
          cachedEvents.value[eventIndex] = { ...cachedEvents.value[eventIndex], ...event };
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
      }
      catch (error) {
        if (cachedEvents.value && previousEvents.length > 0) {
          cachedEvents.value.splice(0, cachedEvents.value.length, ...previousEvents);
        }
        throw error;
      }
    }
    else {
      const nuxtApp = useNuxtApp();
      const { getCachedIntegrationData } = useSyncManager();

      function updateIntegrationCache(integrationId: string, data: unknown) {
        const cacheKey = `calendar-events-${integrationId}`;
        nuxtApp.payload.data = {
          ...nuxtApp.payload.data,
          [cacheKey]: data,
        };
      }

      const integrationEvents = getCachedIntegrationData("calendar", event.integrationId) as CalendarEvent[];
      const previousEvents = integrationEvents ? [...integrationEvents] : [];

      if (integrationEvents && Array.isArray(integrationEvents)) {
        const eventIndex = integrationEvents.findIndex((e: CalendarEvent) => e.id === event.id);
        if (eventIndex !== -1) {
          const updatedEvents = [...integrationEvents];
          updatedEvents[eventIndex] = { ...updatedEvents[eventIndex], ...event };
          updateIntegrationCache(event.integrationId, updatedEvents);
        }
      }

      try {
        const { updateCalendarEvent } = useCalendarIntegrations();
        await updateCalendarEvent(event.integrationId, event.id, event);

        showSuccess("Event Updated", "Calendar event updated successfully");
      }
      catch (error) {
        if (integrationEvents && previousEvents.length > 0) {
          updateIntegrationCache(event.integrationId, previousEvents);
        }
        throw error;
      }
    }
  }
  catch {
    showError("Failed to Update Event", "Failed to update the event. Please try again.");
  }
}

async function handleEventDelete(eventId: string) {
  try {
    const event = allEvents.value.find(e => e.id === eventId);

    if (!event) {
      showError("Event Not Found", "The event could not be found.");
      return;
    }

    if (!event.integrationId) {
      const { data: cachedEvents } = useNuxtData("calendar-events");
      const previousEvents = cachedEvents.value ? [...cachedEvents.value] : [];

      if (cachedEvents.value && Array.isArray(cachedEvents.value)) {
        cachedEvents.value.splice(0, cachedEvents.value.length, ...cachedEvents.value.filter((e: CalendarEvent) => e.id !== eventId));
      }

      try {
        const { deleteEvent } = useCalendarEvents();
        await deleteEvent(eventId);
        showSuccess("Event Deleted", "Local event deleted successfully");
      }
      catch (error) {
        if (cachedEvents.value && previousEvents.length > 0) {
          cachedEvents.value.splice(0, cachedEvents.value.length, ...previousEvents);
        }
        throw error;
      }
    }
    else {
      showError("Not Supported", "Deleting events from this integration is not yet supported");
    }
  }
  catch {
    showError("Failed to Delete Event", "Failed to delete the event. Please try again.");
  }
}

function getEventIntegrationCapabilities(event: CalendarEvent): { capabilities: string[]; serviceName?: string } | undefined {
  if (!event.integrationId)
    return undefined;

  const { integrations } = useIntegrations();
  const { getCalendarAccessRole } = useCalendarIntegrations();
  const integration = (integrations.value as readonly Integration[] || []).find(i => i.id === event.integrationId);
  if (!integration)
    return undefined;

  const config = integrationRegistry.get(`${integration.type}:${integration.service}`);
  let capabilities = config?.capabilities || [];

  if (event.calendarId && capabilities.includes("select_calendars")) {
    const calendarRole = getCalendarAccessRole(event.integrationId, event.calendarId);

    if (calendarRole === "read") {
      capabilities = capabilities.filter(cap =>
        !["edit_events", "add_events", "delete_events"].includes(cap),
      );
    }
  }

  return {
    capabilities,
    serviceName: integration.service,
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
