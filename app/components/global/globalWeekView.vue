<script setup lang="ts">
import type { CalendarEvent } from "~/types/calendar";

import { useCalendar } from "~/composables/useCalendar";
import { useStableDate } from "~/composables/useStableDate";

const props = defineProps<{
  events: CalendarEvent[];
  startDate?: Date;
  eventHeight?: number;
}>();

const emit = defineEmits<{
  (e: "eventCreate", date: Date): void;
  (e: "eventClick", event: CalendarEvent, mouseEvent: MouseEvent): void;
}>();

const { getStableDate } = useStableDate();

const {
  isToday,
  getAllEventsForDay,
  handleEventClick: _handleEventClick,
  getLocalWeekDays,
  getEventsForDateRange,
} = useCalendar();

const weekDays = computed(() => {
  const start = props.startDate || getStableDate();
  const sunday = new Date(start.getTime());
  const dayOfWeek = sunday.getDay();
  sunday.setDate(sunday.getDate() - dayOfWeek);

  const days = getLocalWeekDays(sunday);
  return days;
});

const nextWeekDays = computed(() => {
  const start = props.startDate || getStableDate();
  const sunday = new Date(start.getTime());
  const dayOfWeek = sunday.getDay();
  sunday.setDate(sunday.getDate() - dayOfWeek);
  const nextWeekSunday = new Date(sunday.getTime() + 7 * 24 * 60 * 60 * 1000);

  return getLocalWeekDays(nextWeekSunday);
});

const nextWeekEvents = computed(() => {
  const start = props.startDate || getStableDate();
  const sunday = new Date(start.getTime());
  const dayOfWeek = sunday.getDay();
  sunday.setDate(sunday.getDate() - dayOfWeek);
  const nextWeekSunday = new Date(sunday.getTime() + 7 * 24 * 60 * 60 * 1000);
  const nextWeekSaturday = new Date(
    nextWeekSunday.getTime() + 6 * 24 * 60 * 60 * 1000,
  );

  return getEventsForDateRange(nextWeekSunday, nextWeekSaturday);
});

const firstRow = computed(() => weekDays.value.slice(0, 4));
const secondRow = computed(() => {
  const currentWeekDays = weekDays.value.slice(4, 7);
  const nextWeekFirstDay = nextWeekDays.value[0];
  if (!nextWeekFirstDay) {
    return currentWeekDays;
  }
  return [...currentWeekDays, nextWeekFirstDay];
});

function handleEventClick(event: CalendarEvent, e: MouseEvent) {
  _handleEventClick(event, e, emit);
}

const nextWeekEventCount = computed(() => {
  const uniqueEvents = new Set<string>();

  nextWeekDays.value.forEach((day) => {
    const dayEvents = getAllEventsForDay(nextWeekEvents.value, day);
    dayEvents.forEach((event) => {
      const baseId = event.id.split("-")[0] || event.id;
      uniqueEvents.add(baseId);
    });
  });

  return uniqueEvents.size;
});

function isLastDay(day: Date) {
  return day.toISOString() === nextWeekDays.value[0]?.toISOString();
}
</script>

<template>
  <div class="w-full">
    <div class="grid grid-cols-4 grid-rows-2 border border-default">
      <div
        v-for="day in firstRow"
        :key="day.toISOString()"
        class="relative border-r border-b border-default last:border-r-0 flex flex-col"
        style="height: 300px"
        :class="{
          'bg-muted/25': !isToday(day),
          'bg-info/10': isToday(day),
        }"
      >
        <div
          class="flex items-center justify-between p-2 border-b border-default flex-shrink-0"
        >
          <div class="text-sm font-medium text-muted">
            <NuxtTime :datetime="day" weekday="short" />
          </div>
          <div
            class="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold"
            :class="{
              'bg-primary text-white': isToday(day),
              'text-muted': !isToday(day),
            }"
          >
            <NuxtTime :datetime="day" day="numeric" />
          </div>
        </div>
        <div
          class="overflow-y-auto px-2 py-1 space-y-1 relative z-10 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex flex-col"
          style="height: 240px"
        >
          <div
            v-for="event in getAllEventsForDay(events, day)"
            :key="event.id"
            class="rounded"
          >
            <CalendarEventItem
              :event="event"
              view="week"
              :current-day="day"
              class="rounded"
              @click="(e) => handleEventClick(event, e)"
            />
          </div>
          <div
            v-show="getAllEventsForDay(events, day).length === 0"
            class="flex flex-col items-center justify-center gap-1 text-muted flex-1"
          >
            <UIcon name="i-lucide-calendar-off" class="w-8 h-8" />
            <span class="text-lg text-muted">
              {{ isToday(day) ? "No events today" : "No events" }}
            </span>
          </div>
        </div>
      </div>
      <div
        v-for="day in secondRow"
        :key="day.toISOString()"
        class="relative border-r border-default last:border-r-0 flex flex-col"
        style="height: 300px"
        :class="{
          'bg-muted/25': day && !isToday(day) && !isLastDay(day),
          'bg-primary/10': day && isToday(day),
          'bg-muted/50': day && isLastDay(day),
        }"
      >
        <template v-if="day && !isLastDay(day)">
          <div
            class="flex items-center justify-between p-2 border-b border-default flex-shrink-0"
          >
            <div class="text-sm font-medium text-muted">
              <NuxtTime :datetime="day" weekday="short" />
            </div>
            <div
              class="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold"
              :class="{
                'bg-primary text-white': isToday(day),
                'text-muted': !isToday(day),
              }"
            >
              <NuxtTime :datetime="day" day="numeric" />
            </div>
          </div>
          <div
            class="overflow-y-auto px-2 py-1 space-y-1 relative z-10 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex flex-col"
            style="height: 240px"
          >
            <div
              v-for="event in getAllEventsForDay(events, day)"
              :key="event.id"
              class="rounded"
            >
              <CalendarEventItem
                :event="event"
                view="week"
                :current-day="day"
                class="rounded"
                @click="(e) => handleEventClick(event, e)"
              />
            </div>
            <div
              v-show="getAllEventsForDay(events, day).length === 0"
              class="flex flex-col items-center justify-center gap-1 text-muted flex-1"
            >
              <UIcon name="i-lucide-calendar-off" class="w-6 h-6" />
              <span class="text-md text-muted">
                {{ isToday(day) ? "No events today" : "No events" }}
              </span>
            </div>
          </div>
        </template>

        <template v-else-if="day && isLastDay(day)">
          <div
            class="flex items-center justify-between p-2 border-b border-default flex-shrink-0"
          >
            <div class="text-sm font-medium text-primary">
              Next Week
            </div>
            <div
              class="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold bg-primary/20 text-white"
            >
              <UIcon name="i-lucide-calendar-days" class="w-4 h-4" />
            </div>
          </div>
          <div
            class="overflow-y-auto px-2 py-1 space-y-1 relative z-10 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] flex flex-col"
            style="height: 240px"
          >
            <div
              class="flex flex-col items-center justify-center gap-2 text-primary flex-1"
            >
              <div class="text-center">
                <div class="text-lg font-semibold">
                  {{ nextWeekEventCount }}
                </div>
                <div class="text-xs opacity-75">
                  {{ nextWeekEventCount === 1 ? "event" : "events" }}
                </div>
              </div>
              <div class="text-xs text-center opacity-75">
                <div class="text-xs opacity-50 mt-2">
                  Coming up next week
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
