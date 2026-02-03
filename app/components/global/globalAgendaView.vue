<script setup lang="ts">
import { format } from "date-fns";

import type { CalendarEvent } from "~/types/calendar";

import { useCalendar } from "~/composables/useCalendar";
import { useStableDate } from "~/composables/useStableDate";

const props = defineProps<{
  days: Date[];
  events: CalendarEvent[];
}>();

const emit = defineEmits<{
  (e: "eventClick", event: CalendarEvent, mouseEvent: MouseEvent): void;
}>();

const {
  isToday,
  handleEventClick: _handleEventClick,
  scrollToDate,
  getAgendaEventsForDay,
} = useCalendar();

const { getStableDate } = useStableDate();

const hasEvents = computed(() => {
  return props.events.length > 0;
});

function handleEventClick(event: CalendarEvent, e: MouseEvent) {
  _handleEventClick(event, e, emit);
}

onMounted(() => {
  scrollToDate(getStableDate(), "agenda");
});

watch(
  () => props.days,
  () => {
    nextTick(() => {
      scrollToDate(getStableDate(), "agenda");
    });
  },
);
</script>

<template>
  <div class="flex h-full w-full flex-col">
    <div class="flex-1 overflow-y-auto">
      <div
        v-show="!hasEvents"
        class="flex min-h-[70svh] flex-col items-center justify-center py-16 text-center"
      >
        <UIcon name="i-lucide-calendar-off" class="size-8" />
        <h2 class="text-lg font-medium text-highlighted">
          No events found
        </h2>
        <p class="text-muted">
          There are no events scheduled for this time period.
        </p>
      </div>

      <div v-show="hasEvents" class="px-4">
        <div
          v-for="day in days"
          :key="day.toString()"
          :data-date="format(day, 'yyyy-MM-dd')"
          class="border-default relative my-12 border-t border-r"
        >
          <span
            class="bg-default absolute -top-3 left-0 flex h-6 items-center pe-4 text-[10px] uppercase sm:pe-4 sm:text-xs"
          >
            <span
              class="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold mr-2"
              :class="{
                'bg-primary text-white': isToday(day),
                'text-muted': !isToday(day),
              }"
            >
              <NuxtTime :datetime="day" day="numeric" />
            </span>
            <span
              :class="{
                'font-medium text-highlighted': isToday(day),
                'text-muted': !isToday(day),
              }"
            >
              <NuxtTime
                :datetime="day"
                month="short"
                weekday="long"
              />
            </span>
          </span>
          <div class="mt-6 space-y-2">
            <div
              v-show="getAgendaEventsForDay(events, day).length === 0"
              class="text-center py-8"
            >
              <div class="flex items-center justify-center gap-2 text-muted">
                <UIcon name="i-lucide-calendar-off" class="w-6 h-6" />
                <span class="text-md font-medium text-highlighted">
                  {{ isToday(day) ? "No events today" : "No events" }}
                </span>
              </div>
            </div>
            <CalendarEventItem
              v-for="event in getAgendaEventsForDay(events, day)"
              :key="event.id"
              :event="event"
              view="agenda"
              @click="(e) => handleEventClick(event, e)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
