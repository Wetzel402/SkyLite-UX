<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui";

import { addDays, endOfWeek, getISOWeek, isSameMonth, startOfWeek } from "date-fns";

import type { CalendarView } from "~/types/calendar";
import type { TodoSortMode } from "~/types/ui";

import { useStableDate } from "~/composables/useStableDate";
import { TODO_SORT_OPTIONS } from "~/types/ui";

const props = defineProps<{
  showNavigation?: boolean;
  showViewSelector?: boolean;
  showTodoSortSelector?: boolean;
  showWeekNumbers?: boolean;
  currentDate?: Date;
  view?: CalendarView;
  todoSortBy?: TodoSortMode;
  className?: string;
}>();

const emit = defineEmits<{
  (e: "previous"): void;
  (e: "next"): void;
  (e: "today"): void;
  (e: "viewChange", view: CalendarView): void;
  (e: "dateChange", date: Date): void;
  (e: "todoSortChange", mode: TodoSortMode): void;
}>();

const { getStableDate } = useStableDate();

const currentDate = computed(() => props.currentDate || getStableDate());
const view = computed(() => props.view || "week");

const now = ref(new Date());

onMounted(() => {
  const interval = setInterval(() => {
    now.value = new Date();
  }, 30000);

  onBeforeUnmount(() => {
    clearInterval(interval);
  });
});

const viewTitle = computed(() => {
  if (view.value === "month") {
    return "month";
  }
  else if (view.value === "week") {
    const start = startOfWeek(currentDate.value, { weekStartsOn: 0 });
    const end = endOfWeek(currentDate.value, { weekStartsOn: 0 });
    if (isSameMonth(start, end)) {
      return "week-same-month";
    }
    else {
      return "week-different-months";
    }
  }
  else if (view.value === "day") {
    return "day";
  }
  else if (view.value === "agenda") {
    const start = currentDate.value;
    const end = addDays(currentDate.value, 30 - 1);
    if (isSameMonth(start, end)) {
      return "agenda-same-month";
    }
    else {
      return "agenda-different-months";
    }
  }
  return "month";
});

const items: DropdownMenuItem[][] = [
  [
    {
      label: "Month",
      icon: "i-lucide-calendar-days",
      onSelect: () => emit("viewChange", "month"),
    },
    {
      label: "Week",
      icon: "i-lucide-calendar-range",
      onSelect: () => {
        emit("viewChange", "week");
        emit("dateChange", getStableDate());
      },
    },
    {
      label: "Day",
      icon: "i-lucide-calendar-1",
      onSelect: () => emit("viewChange", "day"),
    },
    {
      label: "Agenda",
      icon: "i-lucide-list",
      onSelect: () => emit("viewChange", "agenda"),
    },
  ],
];

const todoSortItems: DropdownMenuItem[][] = [
  TODO_SORT_OPTIONS.map(opt => ({
    label: opt.label,
    onSelect: () => emit("todoSortChange", opt.value),
  })),
];

const todoSortLabel = computed(() =>
  TODO_SORT_OPTIONS.find(o => o.value === (props.todoSortBy ?? "date"))?.label ?? "Date",
);

const isoWeekNumber = computed(() => {
  if (!props.showWeekNumbers || view.value !== "week")
    return null;
  return getISOWeek(currentDate.value);
});

function handlePrevious() {
  emit("previous");
}

function handleNext() {
  emit("next");
}

function handleToday() {
  emit("today");
}
</script>

<template>
  <div
    class="flex flex-col sm:flex-row sm:items-center justify-between gap-2"
    :class="className"
  >
    <div class="flex sm:flex-col max-sm:items-center justify-between gap-1.5">
      <div class="flex items-center gap-1.5">
        <h1 class="font-semibold text-xl text-highlighted">
          <NuxtTime
            :datetime="now"
            hour="numeric"
            minute="2-digit"
            :hour12="true"
          />
        </h1>
      </div>
      <div class="text-sm text-muted">
        <NuxtTime
          :datetime="now"
          weekday="long"
          month="long"
          day="numeric"
        />
      </div>
    </div>

    <div v-if="showNavigation" class="flex items-center justify-center flex-1">
      <h2 class="font-semibold text-lg text-highlighted">
        <template v-if="isoWeekNumber !== null">
          <NuxtTime
            v-if="viewTitle === 'week-same-month'"
            :datetime="startOfWeek(currentDate, { weekStartsOn: 0 })"
            month="long"
            year="numeric"
          />
          <span v-else-if="viewTitle === 'week-different-months'">
            <NuxtTime
              :datetime="startOfWeek(currentDate, { weekStartsOn: 0 })"
              month="short"
            />
            -
            <NuxtTime
              :datetime="endOfWeek(currentDate, { weekStartsOn: 0 })"
              month="short"
              year="numeric"
            />
          </span>
          <span class="text-muted font-normal ml-1">(Week {{ isoWeekNumber }})</span>
        </template>
        <template v-else>
          <NuxtTime
            v-if="viewTitle === 'month'"
            :datetime="currentDate"
            month="long"
            year="numeric"
          />
          <NuxtTime
            v-else-if="viewTitle === 'week-same-month'"
            :datetime="startOfWeek(currentDate, { weekStartsOn: 0 })"
            month="long"
            year="numeric"
          />
          <span v-else-if="viewTitle === 'week-different-months'">
            <NuxtTime
              :datetime="startOfWeek(currentDate, { weekStartsOn: 0 })"
              month="short"
            />
            -
            <NuxtTime
              :datetime="endOfWeek(currentDate, { weekStartsOn: 0 })"
              month="short"
              year="numeric"
            />
          </span>
          <NuxtTime
            v-else-if="viewTitle === 'day'"
            :datetime="currentDate"
            month="long"
            day="numeric"
            year="numeric"
          />
          <NuxtTime
            v-else-if="viewTitle === 'agenda-same-month'"
            :datetime="currentDate"
            month="long"
            year="numeric"
          />
          <span v-else-if="viewTitle === 'agenda-different-months'">
            <NuxtTime :datetime="currentDate" month="short" /> -
            <NuxtTime
              :datetime="addDays(currentDate, 30 - 1)"
              month="short"
              year="numeric"
            />
          </span>
          <NuxtTime
            v-else
            :datetime="currentDate"
            month="long"
            year="numeric"
          />
        </template>
      </h2>
    </div>

    <div
      v-if="showNavigation || showTodoSortSelector"
      class="flex items-center justify-between gap-2"
    >
      <div
        v-if="showNavigation"
        class="flex items-center justify-between gap-2"
      >
        <div class="flex items-center sm:gap-2 max-sm:order-1">
          <UButton
            icon="i-lucide-chevron-left"
            color="neutral"
            variant="ghost"
            size="xl"
            aria-label="Previous"
            @click="handlePrevious"
          />
          <UButton
            icon="i-lucide-chevron-right"
            color="neutral"
            variant="ghost"
            size="xl"
            aria-label="Next"
            @click="handleNext"
          />
        </div>
        <UButton
          color="primary"
          size="xl"
          @click="handleToday"
        >
          Today
        </UButton>
      </div>
      <div
        v-if="showViewSelector"
        class="flex items-center justify-between gap-2"
      >
        <UDropdownMenu :items="items">
          <UButton
            color="neutral"
            variant="outline"
            size="xl"
            trailing-icon="i-lucide-chevron-down"
          >
            <span class="capitalize">{{ view }}</span>
          </UButton>
        </UDropdownMenu>
      </div>
      <div
        v-if="showTodoSortSelector"
        class="flex items-center justify-between gap-2"
      >
        <UDropdownMenu :items="todoSortItems">
          <UButton
            color="neutral"
            variant="outline"
            size="xl"
            trailing-icon="i-lucide-chevron-down"
          >
            {{ todoSortLabel }}
          </UButton>
        </UDropdownMenu>
      </div>
    </div>
  </div>
</template>
