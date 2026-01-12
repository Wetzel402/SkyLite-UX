<script setup lang="ts">
import { addDays, addMonths, subWeeks } from "date-fns";

import type { CalendarEvent } from "~/types/calendar";
import type { Integration, MealType, MealWithDate } from "~/types/database";

import { useAlertToast } from "~/composables/useAlertToast";
import { useCalendar } from "~/composables/useCalendar";
import { useCalendarEvents } from "~/composables/useCalendarEvents";
import { useIntegrations } from "~/composables/useIntegrations";
import { useMealPlans } from "~/composables/useMealPlans";
import { integrationRegistry } from "~/types/integrations";

const { allEvents, getEventUserColors, showMealsOnCalendar } = useCalendar();
const { showError, showSuccess } = useAlertToast();
const { getMealsForDateRange } = useMealPlans();
const router = useRouter();

// Get current calendar date and view state (shared with CalendarMainView)
const currentDate = useState<Date>("calendar-current-date", () => new Date());
const currentView = useState<"month" | "week" | "day" | "agenda">("calendar-current-view", () => "week");

// Meal events state
const mealEvents = ref<CalendarEvent[]>([]);

// Convert meal to calendar event
function mealToCalendarEvent(meal: MealWithDate): CalendarEvent {
  const mealDate = new Date(meal.calculatedDate);
  const timeMap: Record<MealType, { hour: number; minute: number }> = {
    BREAKFAST: { hour: 8, minute: 0 },
    LUNCH: { hour: 12, minute: 0 },
    DINNER: { hour: 18, minute: 0 },
  };
  const time = timeMap[meal.mealType];

  const start = new Date(mealDate);
  start.setHours(time.hour, time.minute, 0, 0);

  const end = new Date(start);
  end.setHours(start.getHours() + 1);

  return {
    id: `meal-${meal.id}`,
    title: `${meal.mealType}: ${meal.name}`,
    description: meal.description || "",
    start,
    end,
    allDay: false,
    color: "amber",
    integrationId: "meal-planner",
  };
}

// Get date range for current view
function getDateRangeForView(date: Date, currentView: "month" | "week" | "day" | "agenda"): { start: Date; end: Date } {
  switch (currentView) {
    case "month": {
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      start.setDate(start.getDate() - 7);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      end.setDate(end.getDate() + 7);
      return { start, end };
    }
    case "week": {
      const sunday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayOfWeek = sunday.getDay();
      sunday.setDate(sunday.getDate() - dayOfWeek);
      const saturday = new Date(sunday.getTime());
      saturday.setDate(saturday.getDate() + 7);
      return { start: sunday, end: saturday };
    }
    case "day": {
      const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
      return { start, end };
    }
    case "agenda": {
      const start = addDays(date, -15);
      const end = addDays(date, 15);
      return { start, end };
    }
    default:
      return { start: date, end: date };
  }
}

// Fetch meals when date range or toggle changes
watch([currentDate, currentView, showMealsOnCalendar], async () => {
  if (!showMealsOnCalendar.value) {
    mealEvents.value = [];
    return;
  }

  try {
    const { start, end } = getDateRangeForView(currentDate.value, currentView.value);
    const meals = await getMealsForDateRange(start, end);
    mealEvents.value = meals.map(mealToCalendarEvent);
  }
  catch (error) {
    // Silently fail - meal display is optional
    mealEvents.value = [];
  }
}, { immediate: true });

// Combine calendar events with meal events
const combinedEvents = computed(() => {
  return [...allEvents.value, ...mealEvents.value];
});

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
  // If it's a meal event, redirect to meal planner
  if (event.integrationId === "meal-planner") {
    router.push("/mealPlanner");
    return;
  }

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
      showError("Not Supported", "Updating events in this integration is not yet supported");
    }
  }
  catch {
    showError("Failed to Update Event", "Failed to update the event. Please try again.");
  }
}

async function handleEventDelete(eventId: string) {
  try {
    const event = combinedEvents.value.find(e => e.id === eventId);

    if (!event) {
      showError("Event Not Found", "The event could not be found.");
      return;
    }

    // If it's a meal event, redirect to meal planner
    if (event.integrationId === "meal-planner") {
      router.push("/mealPlanner");
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
  const integration = (integrations.value as readonly Integration[] || []).find(i => i.id === event.integrationId);
  if (!integration)
    return undefined;

  const config = integrationRegistry.get(`${integration.type}:${integration.service}`);
  return {
    capabilities: config?.capabilities || [],
    serviceName: integration.service,
  };
}
</script>

<!-- TODO: allow user to choose initial view -->
<template>
  <div>
    <CalendarMainView
      :events="combinedEvents as CalendarEvent[]"
      initial-view="week"
      class="h-[calc(100vh-2rem)]"
      :get-integration-capabilities="getEventIntegrationCapabilities"
      @event-add="handleEventAdd"
      @event-update="handleEventUpdate"
      @event-delete="handleEventDelete"
    />
  </div>
</template>
