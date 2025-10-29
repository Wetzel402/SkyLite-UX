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

const nuxtApp = useNuxtApp();
function updateIntegrationCache(integrationId: string, data: unknown) {
  nuxtApp.payload.data = {
    ...nuxtApp.payload.data,
    [`calendar-events-${integrationId}`]: data,
  };
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
      if (!event.calendarId) {
        showError("Calendar Not Selected", "Please select a calendar for this event.");
        return;
      }

      const cacheKey = `calendar-events-${event.integrationId}`;
      const { data: cachedEvents } = useNuxtData(cacheKey);
      const previousEvents = cachedEvents.value ? [...cachedEvents.value] : [];

      const prevPayloadEventsAdd = Array.isArray(nuxtApp.payload.data[cacheKey]) ? [...(nuxtApp.payload.data[cacheKey] as CalendarEvent[])] : [];

      const tempId = `temp-${Date.now()}`;
      const tempEvent: CalendarEvent = {
        ...event,
        id: tempId,
        createdAt: new Date(),
        updatedAt: new Date(),
        color: getEventUserColors(event),
      } as CalendarEvent;

      if (cachedEvents.value && Array.isArray(cachedEvents.value)) {
        cachedEvents.value.push(tempEvent);
      }
      {
        const existing = Array.isArray(nuxtApp.payload.data[cacheKey]) ? (nuxtApp.payload.data[cacheKey] as CalendarEvent[]) : [];
        updateIntegrationCache(event.integrationId, [...existing, tempEvent]);
      }

      try {
        const { addCalendarEvent } = useCalendarIntegrations();
        const created = await addCalendarEvent(event.integrationId, event.calendarId, event);

        if (cachedEvents.value && Array.isArray(cachedEvents.value)) {
          const idx = cachedEvents.value.findIndex((e: CalendarEvent) => e.id === tempId);
          if (idx !== -1)
            cachedEvents.value[idx] = created as unknown as CalendarEvent;
        }
        {
          const existing = Array.isArray(nuxtApp.payload.data[cacheKey]) ? (nuxtApp.payload.data[cacheKey] as CalendarEvent[]) : [];
          const idx = existing.findIndex((e: CalendarEvent) => e.id === tempId);
          if (idx !== -1) {
            const updated = [...existing];
            updated[idx] = created as unknown as CalendarEvent;
            updateIntegrationCache(event.integrationId, updated);
          }
        }

        await refreshNuxtData(cacheKey);
        showSuccess("Event Created", "Calendar event created successfully");
      }
      catch (error) {
        if (cachedEvents.value && previousEvents.length > 0) {
          cachedEvents.value.splice(0, cachedEvents.value.length, ...previousEvents);
        }
        updateIntegrationCache(event.integrationId, prevPayloadEventsAdd);
        throw error;
      }
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
      const cacheKey = `calendar-events-${event.integrationId}`;
      const { data: cachedEvents } = useNuxtData(cacheKey);
      const previousEvents = cachedEvents.value ? [...cachedEvents.value] : [];
      const prevPayloadEventsUpdate = Array.isArray(nuxtApp.payload.data[cacheKey]) ? [...(nuxtApp.payload.data[cacheKey] as CalendarEvent[])] : [];

      const isExpanded = event.id.includes("-");
      const baseEventId = isExpanded ? (event.id.split("-")[0] || event.id) : event.id;

      if (cachedEvents.value && Array.isArray(cachedEvents.value)) {
        const idx = cachedEvents.value.findIndex((e: CalendarEvent) => e.id === baseEventId);
        if (idx !== -1) {
          cachedEvents.value[idx] = { ...cachedEvents.value[idx], ...event } as CalendarEvent;
        }
      }
      {
        const existing = Array.isArray(nuxtApp.payload.data[cacheKey]) ? (nuxtApp.payload.data[cacheKey] as CalendarEvent[]) : [];
        const idx = existing.findIndex((e: CalendarEvent) => e.id === baseEventId);
        if (idx !== -1) {
          const updated = [...existing];
          updated[idx] = { ...updated[idx], ...event } as CalendarEvent;
          updateIntegrationCache(event.integrationId, updated);
        }
      }

      try {
        const { updateCalendarEvent } = useCalendarIntegrations();
        await updateCalendarEvent(event.integrationId, baseEventId, event);

        await refreshNuxtData(cacheKey);
        showSuccess("Event Updated", "Calendar event updated successfully");
      }
      catch (error) {
        if (cachedEvents.value && previousEvents.length > 0) {
          cachedEvents.value.splice(0, cachedEvents.value.length, ...previousEvents);
        }
        updateIntegrationCache(event.integrationId, prevPayloadEventsUpdate);
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
      const cacheKey = `calendar-events-${event.integrationId}`;
      const { data: cachedEvents } = useNuxtData(cacheKey);
      const previousEvents = cachedEvents.value ? [...cachedEvents.value] : [];

      const isExpanded = event.id.includes("-");
      const baseEventId = isExpanded ? (event.id.split("-")[0] || event.id) : event.id;

      if (cachedEvents.value && Array.isArray(cachedEvents.value)) {
        cachedEvents.value = cachedEvents.value.filter((e: CalendarEvent) => e.id !== baseEventId) as unknown as CalendarEvent[];
      }
      {
        const existing = Array.isArray(nuxtApp.payload.data[cacheKey]) ? (nuxtApp.payload.data[cacheKey] as CalendarEvent[]) : [];
        const updated = existing.filter((e: CalendarEvent) => e.id !== baseEventId);
        updateIntegrationCache(event.integrationId, updated);
      }

      try {
        const { deleteCalendarEvent } = useCalendarIntegrations();
        await deleteCalendarEvent(event.integrationId, baseEventId, event.calendarId);

        await refreshNuxtData(cacheKey);
        showSuccess("Event Deleted", "Calendar event deleted successfully");
      }
      catch (error) {
        if (cachedEvents.value && previousEvents.length > 0) {
          cachedEvents.value.splice(0, cachedEvents.value.length, ...previousEvents);
        }
        await refreshNuxtData(cacheKey);
        throw error;
      }
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
