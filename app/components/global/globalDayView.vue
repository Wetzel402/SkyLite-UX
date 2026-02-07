<script setup lang="ts">
import { isSameMonth } from "date-fns";

import type { CalendarEvent } from "~/types/calendar";

import { useCalendar } from "~/composables/useCalendar";

const props = defineProps<{
  currentDate: Date;
  events: CalendarEvent[];
  eventHeight?: number;
}>();

const emit = defineEmits<{
  (e: "eventCreate", date: Date): void;
  (e: "eventClick", event: CalendarEvent, mouseEvent: MouseEvent): void;
  (e: "dateSelect", date: Date): void;
}>();

const {
  isToday,
  isSelectedDate: _isSelectedDate,
  handleDateSelect: _handleDateSelect,
  getMiniCalendarWeeks,
  getAllEventsForDay,
  getAgendaEventsForDay,
  getEventsForDateRange,
} = useCalendar();

const miniCalendarWeeks = computed(() =>
  getMiniCalendarWeeks(props.currentDate),
);

const monthEvents = computed(() => {
  const currentDate = props.currentDate;
  const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  start.setDate(start.getDate() - 7);
  const end = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0,
  );
  end.setDate(end.getDate() + 7);
  return getEventsForDateRange(start, end);
});

const todaysEvents = computed(() =>
  getAgendaEventsForDay(props.events, props.currentDate),
);

function getChipColor(
  day: Date,
):
  | "error"
  | "info"
  | "success"
  | "primary"
  | "secondary"
  | "warning"
  | "neutral"
  | undefined {
  return isSameMonth(day, props.currentDate) ? "primary" : "secondary";
}

function isSelectedDate(date: Date) {
  return _isSelectedDate(date, props.currentDate);
}

function handleDateSelect(date: Date) {
  _handleDateSelect(date, emit);
}

function handleEventClick(event: CalendarEvent, e: MouseEvent) {
  emit("eventClick", event, e);
}
</script>

<template>
  <div class="flex h-full w-full">
    <div class="w-[40%] flex-shrink-0 border-r border-default">
      <div class="p-4">
        <div class="flex items-center justify-center mb-4">
          <h2 class="text-lg font-semibold text-highlighted">
            <NuxtTime
              :datetime="currentDate"
              month="long"
              year="numeric"
            />
          </h2>
        </div>
        <div class="grid grid-cols-7 gap-1 mb-2">
          <div
            v-for="day in ['S', 'M', 'T', 'W', 'T', 'F', 'S']"
            :key="day"
            class="text-center text-xs font-medium text-muted py-2"
          >
            {{ day }}
          </div>
        </div>

        <div class="grid grid-cols-7 gap-1">
          <template
            v-for="day in miniCalendarWeeks.flat()"
            :key="day.toISOString()"
          >
            <div
              class="bg-muted rounded-lg shadow-sm border border-default aspect-square"
            >
              <UChip
                v-if="getAllEventsForDay(monthEvents, day).length > 0"
                inset
                size="3xl"
                :color="getChipColor(day)"
                position="bottom-left"
                class="w-full h-full flex items-center justify-center"
              >
                <button
                  type="button"
                  class="w-full h-full flex items-center justify-center text-sm transition-colors rounded-md hover:bg-accented"
                  :class="{
                    'text-dimmed': !isSameMonth(day, currentDate),
                    'text-highlighted':
                      isSameMonth(day, currentDate)
                      && !isToday(day)
                      && !isSelectedDate(day),
                    'bg-primary text-white font-semibold': isSelectedDate(day),
                    'bg-info/10 text-info font-medium':
                      isToday(day) && !isSelectedDate(day),
                  }"
                  @click="handleDateSelect(day)"
                >
                  <NuxtTime :datetime="day" day="numeric" />
                </button>
              </UChip>

              <button
                v-else
                type="button"
                class="w-full h-full flex items-center justify-center text-sm transition-colors rounded-md hover:bg-accented"
                :class="{
                  'text-dimmed': !isSameMonth(day, currentDate),
                  'text-highlighted':
                    isSameMonth(day, currentDate)
                    && !isToday(day)
                    && !isSelectedDate(day),
                  'bg-primary text-white font-semibold': isSelectedDate(day),
                  'bg-info/10 text-info font-medium':
                    isToday(day) && !isSelectedDate(day),
                }"
                @click="handleDateSelect(day)"
              >
                <NuxtTime :datetime="day" day="numeric" />
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>
    <div class="w-[60%] flex-1">
      <div class="h-full">
        <div class="flex items-center p-4 border-b border-default">
          <div class="flex items-center gap-3">
            <div
              class="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold"
              :class="{
                'bg-primary text-white': isToday(currentDate),
                'bg-muted text-muted': !isToday(currentDate),
              }"
            >
              <NuxtTime :datetime="currentDate" day="numeric" />
            </div>
            <div>
              <h3 class="text-base font-semibold text-highlighted">
                <NuxtTime :datetime="currentDate" weekday="long" />
              </h3>
            </div>
          </div>
        </div>
        <div class="p-4">
          <div v-show="todaysEvents.length === 0" class="text-center py-8">
            <UIcon
              name="i-lucide-calendar-off"
              class="w-8 h-8 text-muted mx-auto mb-2"
            />
            <h4 class="text-sm font-medium text-highlighted">
              No events today
            </h4>
          </div>
          <CalendarEventItem
            v-for="event in todaysEvents"
            :key="event.id"
            :event="event"
            view="agenda"
            class="mb-2"
            @click="(e) => handleEventClick(event, e)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
