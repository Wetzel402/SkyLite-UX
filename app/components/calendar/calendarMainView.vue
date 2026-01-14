<script setup lang="ts">
import { addDays, addMonths, addWeeks, isSameMonth, subMonths, subWeeks } from "date-fns";

import type { CalendarEvent, CalendarView } from "~/types/calendar";

import GlobalDateHeader from "~/components/global/globalDateHeader.vue";
import GlobalDisplayView from "~/components/global/globalDisplayView.vue";
import GlobalFloatingActionButton from "~/components/global/globalFloatingActionButton.vue";
import { useCalendar } from "~/composables/useCalendar";
import { useStableDate } from "~/composables/useStableDate";

const props = defineProps<{
  events?: CalendarEvent[];
  className?: string;
  initialView?: CalendarView;
  class?: string;
  getIntegrationCapabilities?: (event: CalendarEvent) => { capabilities: string[]; serviceName?: string } | undefined;
}>();

const _emit = defineEmits<{
  (e: "eventAdd", event: CalendarEvent): void;
  (e: "eventUpdate", event: CalendarEvent): void;
  (e: "eventDelete", eventId: string): void;
}>();

const { getStableDate, parseStableDate } = useStableDate();
const { scrollToDate } = useCalendar();
const currentDate = useState<Date>("calendar-current-date", () => getStableDate());
const view = useState<CalendarView>("calendar-current-view", () => props.initialView || "display");
const isEventDialogOpen = ref(false);
const selectedEvent = ref<CalendarEvent | null>(null);

onMounted(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (
      isEventDialogOpen.value
      || e.target instanceof HTMLInputElement
      || e.target instanceof HTMLTextAreaElement
      || (e.target instanceof HTMLElement && e.target.isContentEditable)
    ) {
      return;
    }

    switch (e.key.toLowerCase()) {
      case "m":
        view.value = "month";
        break;
      case "w":
        view.value = "week";
        break;
      case "d":
        view.value = "day";
        break;
      case "a":
        view.value = "agenda";
        break;
      case "v":
        view.value = "display";
        break;
    }
  };

  window.addEventListener("keydown", handleKeyDown, { passive: false });
  onUnmounted(() => {
    window.removeEventListener("keydown", handleKeyDown);
  });
});

function handlePrevious() {
  if (view.value === "month") {
    currentDate.value = subMonths(currentDate.value, 1);
  }
  else if (view.value === "week") {
    currentDate.value = subWeeks(currentDate.value, 1);
  }
  else if (view.value === "day") {
    currentDate.value = addDays(currentDate.value, -1);
  }
  else if (view.value === "agenda") {
    currentDate.value = addDays(currentDate.value, -30);
  }
  else if (view.value === "display") {
    currentDate.value = subWeeks(currentDate.value, 1);
  }
}

function handleNext() {
  if (view.value === "month") {
    currentDate.value = addMonths(currentDate.value, 1);
  }
  else if (view.value === "week") {
    currentDate.value = addWeeks(currentDate.value, 1);
  }
  else if (view.value === "day") {
    currentDate.value = addDays(currentDate.value, 1);
  }
  else if (view.value === "agenda") {
    currentDate.value = addDays(currentDate.value, 30);
  }
  else if (view.value === "display") {
    currentDate.value = addWeeks(currentDate.value, 1);
  }
}

function handleToday() {
  currentDate.value = getStableDate();

  nextTick(() => {
    scrollToDate(getStableDate(), view.value);
  });
}

function handleEventSelect(event: CalendarEvent) {
  selectedEvent.value = event;
  isEventDialogOpen.value = true;
}

function handleEventCreate(date: Date) {
  selectedEvent.value = {
    id: "",
    title: "",
    description: "",
    start: date,
    end: addDays(date, 1),
    allDay: false,
    color: "sky",
  };
  isEventDialogOpen.value = true;
}

function handleEventSave(event: CalendarEvent) {
  if (event.id) {
    _emit("eventUpdate", event);
  }
  else {
    _emit("eventAdd", event);
  }
  isEventDialogOpen.value = false;
  selectedEvent.value = null;
}

function handleEventDelete(eventId: string) {
  _emit("eventDelete", eventId);
  isEventDialogOpen.value = false;
  selectedEvent.value = null;
}

function handleCreateEvent() {
  handleEventCreate(getStableDate());
}

const isCurrentMonth = computed(() => {
  return isSameMonth(currentDate.value, getStableDate());
});

const filteredEvents = computed(() => {
  if (!props.events)
    return [];

  const now = currentDate.value;
  let start: Date;
  let end: Date;

  switch (view.value) {
    case "month": {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      start.setDate(start.getDate() - 7);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      end.setDate(end.getDate() + 7);
      break;
    }
    case "week": {
      const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dayOfWeek = sunday.getDay();
      sunday.setDate(sunday.getDate() - dayOfWeek);
      const saturday = new Date(sunday.getTime());
      saturday.setDate(saturday.getDate() + 7);
      start = sunday;
      end = saturday;
      break;
    }
    case "day": {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      break;
    }
    case "agenda": {
      start = addDays(now, -15);
      end = addDays(now, 15);
      break;
    }
    case "display": {
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dayOfWeek = monday.getDay();
      // Adjust to Monday: if Sunday (0), go back 6; else go back (dayOfWeek - 1)
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      monday.setDate(monday.getDate() - daysToMonday);
      const sunday = new Date(monday.getTime());
      sunday.setDate(sunday.getDate() + 7);
      start = monday;
      end = sunday;
      break;
    }
    default:
      return props.events;
  }

  // Filter props.events by date range instead of calling getEventsForDateRange
  return props.events.filter((event) => {
    const eventStart = parseStableDate(event.start);
    const eventEnd = parseStableDate(event.end);
    return eventStart <= end && eventEnd >= start;
  });
});

function getWeeksForMonth(date: Date) {
  const { getLocalMonthWeeks } = useCalendar();
  return getLocalMonthWeeks(date);
}

function getDaysForAgenda(date: Date) {
  const { getLocalAgendaDays } = useCalendar();
  return getLocalAgendaDays(date);
}
</script>

<template>
  <div class="flex h-[calc(100vh-2rem)] w-full flex-col rounded-lg">
    <div class="py-5 sm:px-4 sticky top-0 z-40 bg-default border-b border-default">
      <GlobalDateHeader
        :show-navigation="true"
        :show-view-selector="true"
        :current-date="currentDate"
        :view="view"
        @previous="handlePrevious"
        @next="handleNext"
        @today="handleToday"
        @view-change="(newView) => view = newView"
        @date-change="(newDate) => currentDate = newDate"
      />
    </div>
    <div class="flex flex-1 flex-col min-h-0">
      <GlobalMonthView
        v-if="view === 'month'"
        :weeks="getWeeksForMonth(currentDate)"
        :events="filteredEvents"
        :is-current-month="isCurrentMonth"
        cell-id="month-cell"
        @event-click="handleEventSelect"
        @event-create="handleEventCreate"
      />
      <GlobalWeekView
        v-if="view === 'week'"
        :start-date="currentDate"
        :events="filteredEvents"
        @event-click="handleEventSelect"
        @event-create="handleEventCreate"
      />
      <GlobalDayView
        v-if="view === 'day'"
        :current-date="currentDate"
        :events="filteredEvents"
        :show-all-day-section="true"
        @event-click="handleEventSelect"
        @event-create="handleEventCreate"
        @date-select="(date) => currentDate = date"
      />
      <GlobalAgendaView
        v-if="view === 'agenda'"
        :days="getDaysForAgenda(currentDate)"
        :events="filteredEvents"
        @event-click="handleEventSelect"
      />
      <GlobalDisplayView
        v-if="view === 'display'"
        :start-date="currentDate"
        :events="filteredEvents"
        @event-click="handleEventSelect"
      />
    </div>
  </div>
  <GlobalFloatingActionButton
    v-if="view !== 'display'"
    icon="i-lucide-plus"
    label="Add new event"
    color="primary"
    size="lg"
    position="bottom-right"
    @click="handleCreateEvent"
  />
  <CalendarEventDialog
    :event="selectedEvent"
    :is-open="isEventDialogOpen"
    :integration-capabilities="selectedEvent && props.getIntegrationCapabilities ? props.getIntegrationCapabilities(selectedEvent)?.capabilities : undefined"
    :integration-service-name="selectedEvent && props.getIntegrationCapabilities ? props.getIntegrationCapabilities(selectedEvent)?.serviceName : undefined"
    @close="isEventDialogOpen = false"
    @save="handleEventSave"
    @delete="handleEventDelete"
  />
</template>
