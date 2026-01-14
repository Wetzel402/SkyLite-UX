<script setup lang="ts">
import type { CalendarEvent } from "~/types/calendar";

import { useCalendar } from "~/composables/useCalendar";
import { useStableDate } from "~/composables/useStableDate";

const props = defineProps<{
  events: CalendarEvent[];
  startDate?: Date;
}>();

const emit = defineEmits<{
  (e: "eventClick", event: CalendarEvent, mouseEvent: MouseEvent): void;
}>();

const { getStableDate } = useStableDate();
const { isToday, getAllEventsForDay, handleEventClick: _handleEventClick } = useCalendar();
const { getWeekDays } = useWeekDates();

// Get Monday-Sunday week days
const weekDays = computed(() => {
  const start = props.startDate || getStableDate();
  return getWeekDays(start);
});

// Transform meal titles: "BREAKFAST: ..." → "B: ..."
function formatEventTitle(event: CalendarEvent): string {
  if (event.integrationId === "meal-planner") {
    const title = event.title;
    if (title.startsWith("BREAKFAST: "))
      return `B: ${title.substring(11)}`;
    if (title.startsWith("LUNCH: "))
      return `L: ${title.substring(7)}`;
    if (title.startsWith("DINNER: "))
      return `D: ${title.substring(8)}`;
  }
  return event.title;
}

// Transform events for display
const displayEvents = computed(() => {
  return props.events.map(event => ({
    ...event,
    title: formatEventTitle(event),
  }));
});

function handleEventClick(event: CalendarEvent, e: MouseEvent) {
  // Find original event to preserve original title
  const originalEvent = props.events.find(ev => ev.id === event.id);
  _handleEventClick(originalEvent || event, e, emit);
}
</script>

<template>
  <div class="w-full h-full">
    <div class="grid grid-cols-7 border border-default h-full">
      <div
        v-for="day in weekDays"
        :key="day.toISOString()"
        class="flex flex-col border-r border-default last:border-r-0"
        :class="{
          'bg-muted/15': !isToday(day),
          'bg-info/5': isToday(day),
        }"
      >
        <!-- Day Header -->
        <div class="flex flex-col items-center justify-center p-3 border-b border-default flex-shrink-0 bg-muted/30">
          <div class="text-xs font-semibold uppercase tracking-wide text-muted">
            <NuxtTime :datetime="day" weekday="short" />
          </div>
          <div
            class="inline-flex h-9 w-9 items-center justify-center rounded-full text-base font-bold mt-1"
            :class="{
              'bg-primary text-white': isToday(day),
              'text-highlighted': !isToday(day),
            }"
          >
            <NuxtTime :datetime="day" day="numeric" />
          </div>
        </div>

        <!-- Events List -->
        <div
          class="flex-1 overflow-y-auto px-2 py-2 space-y-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] min-h-0"
        >
          <div
            v-for="event in getAllEventsForDay(displayEvents, day)"
            :key="event.id"
            class="rounded-sm cursor-pointer hover:bg-muted/20 transition-colors"
          >
            <CalendarEventItem
              :event="event"
              view="display"
              :current-day="day"
              @click="(e) => handleEventClick(event, e)"
            />
          </div>

          <!-- Empty state -->
          <div
            v-if="getAllEventsForDay(displayEvents, day).length === 0"
            class="flex flex-col items-center justify-center py-8 text-muted/40"
          >
            <UIcon name="i-lucide-calendar-off" class="w-5 h-5 mb-1" />
            <span class="text-xs">No events</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
