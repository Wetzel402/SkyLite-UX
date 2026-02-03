import { consola } from "consola";

import type { CalendarEvent } from "~/types/calendar";

export function useCalendarEvents() {
  const loading = ref(false);
  const error = ref<string | null>(null);

  const { data: events } = useNuxtData<CalendarEvent[]>("calendar-events");

  const currentEvents = computed(() => events.value || []);

  const fetchEvents = async () => {
    loading.value = true;
    error.value = null;
    try {
      await refreshNuxtData("calendar-events");
      consola.debug(
        "Use Calendar Events: Calendar events refreshed successfully",
      );
      return currentEvents.value;
    } catch (err) {
      error.value = "Failed to fetch calendar events";
      consola.error(
        "Use Calendar Events: Error fetching calendar events:",
        err,
      );
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const createEvent = async (eventData: Omit<CalendarEvent, "id">) => {
    try {
      const newEvent = await $fetch<CalendarEvent>("/api/calendar-events", {
        method: "POST",
        body: eventData,
      });

      await refreshNuxtData("calendar-events");

      return newEvent;
    } catch (err) {
      error.value = "Failed to create calendar event";
      consola.error("Use Calendar Events: Error creating calendar event:", err);
      throw err;
    }
  };

  const updateEvent = async (id: string, updates: Partial<CalendarEvent>) => {
    try {
      const updatedEvent = await $fetch<CalendarEvent>(
        `/api/calendar-events/${id}`,
        {
          method: "PUT",
          body: updates,
        },
      );

      await refreshNuxtData("calendar-events");

      return updatedEvent;
    } catch (err) {
      error.value = "Failed to update calendar event";
      consola.error("Use Calendar Events: Error updating calendar event:", err);
      throw err;
    }
  };

  const deleteEvent = async (id: string) => {
    try {
      await $fetch(`/api/calendar-events/${id}`, {
        method: "DELETE",
      });

      await refreshNuxtData("calendar-events");

      return true;
    } catch (err) {
      error.value = "Failed to delete calendar event";
      consola.error("Use Calendar Events: Error deleting calendar event:", err);
      throw err;
    }
  };

  return {
    events: readonly(currentEvents),
    loading: readonly(loading),
    error: readonly(error),
    fetchEvents,
    createEvent,
    updateEvent,
    deleteEvent,
  };
}
