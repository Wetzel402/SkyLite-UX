<script setup lang="ts">
import type { DateValue } from "@internationalized/date";

import { CalendarDate, getLocalTimeZone, parseDate } from "@internationalized/date";
import { consola } from "consola";
import { isBefore } from "date-fns";
import ical from "ical.js";

import type { CalendarEvent } from "~/types/calendar";

import { useCalendar } from "~/composables/useCalendar";
import { useUsers } from "~/composables/useUsers";
import { getBrowserTimezone } from "~/types/global";

import type { ICalEvent } from "../../../server/integrations/iCal/types";

const props = defineProps<{
  event: CalendarEvent | null;
  isOpen: boolean;
  integrationCapabilities?: string[];
  integrationServiceName?: string;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", event: CalendarEvent): void;
  (e: "delete", eventId: string): void;
}>();

const { users, fetchUsers } = useUsers();

const { getEventStartTimeForInput, getEventEndTimeForInput, getLocalTimeFromUTC } = useCalendar();

const StartHour = 0;
const EndHour = 23;
const DefaultStartHour = 9;
const DefaultEndHour = 10;

const title = ref("");
const description = ref("");
const startDate = ref<DateValue>(new CalendarDate(2022, 2, 6));
const endDate = ref<DateValue>(new CalendarDate(2022, 2, 6));

const allDay = ref(false);
const location = ref("");
const selectedUsers = ref<string[]>([]);
const error = ref<string | null>(null);

// Track if form has unsaved changes
const showUnsavedWarning = ref(false);

// Prevent double-submission
const isSubmitting = ref(false);
const isDeleting = ref(false);

// Store initial values to compare for dirty state
const initialValues = ref({
  title: "",
  description: "",
  location: "",
  allDay: false,
  selectedUsers: [] as string[],
  isRecurring: false,
});

const isRecurring = ref(false);
const recurrenceType = ref<"daily" | "weekly" | "monthly" | "yearly">("weekly");
const recurrenceInterval = ref(1);
const recurrenceEndType = ref<"never" | "count" | "until">("never");
const recurrenceCount = ref(10);
const recurrenceUntil = ref<DateValue>(new CalendarDate(2025, 12, 31));
const recurrenceDays = ref<number[]>([]);
const recurrenceMonthlyType = ref<"day" | "weekday">("day");
const recurrenceMonthlyWeekday = ref<{ week: number; day: number }>({ week: 1, day: 1 });
const recurrenceYearlyType = ref<"day" | "weekday">("day");
const recurrenceYearlyWeekday = ref<{ week: number; day: number; month: number }>({ week: 1, day: 1, month: 0 });

const hourOptions = computed(() => {
  const options = [];
  for (let hour = 1; hour <= 12; hour++) {
    options.push({ value: hour, label: hour.toString() });
  }
  return options;
});

const minuteOptions = computed(() => {
  const options = [];
  for (let minute = 0; minute < 60; minute += 5) {
    const formattedMinute = minute.toString().padStart(2, "0");
    options.push({ value: minute, label: formattedMinute });
  }
  return options;
});

const amPmOptions = [
  { value: "AM", label: "AM" },
  { value: "PM", label: "PM" },
];

const recurrenceTypeOptions = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const recurrenceEndTypeOptions = [
  { value: "never", label: "Never" },
  { value: "count", label: "After" },
  { value: "until", label: "Until" },
];

const dayOptions = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const monthlyTypeOptions = [
  { value: "day", label: "On day" },
  { value: "weekday", label: "On weekday" },
];

const yearlyTypeOptions = [
  { value: "day", label: "On day" },
  { value: "weekday", label: "On weekday" },
];

const weekOptions = [
  { value: 1, label: "First" },
  { value: 2, label: "Second" },
  { value: 3, label: "Third" },
  { value: 4, label: "Fourth" },
  { value: -1, label: "Last" },
];

const monthOptions = [
  { value: 0, label: "January" },
  { value: 1, label: "February" },
  { value: 2, label: "March" },
  { value: 3, label: "April" },
  { value: 4, label: "May" },
  { value: 5, label: "June" },
  { value: 6, label: "July" },
  { value: 7, label: "August" },
  { value: 8, label: "September" },
  { value: 9, label: "October" },
  { value: 10, label: "November" },
  { value: 11, label: "December" },
];

const startHour = ref(DefaultStartHour);
const startMinute = ref(0);
const startAmPm = ref("AM");
const endHour = ref(DefaultEndHour);
const endMinute = ref(0);
const endAmPm = ref("AM");

const canEdit = computed(() => {
  if (!props.integrationCapabilities)
    return true;
  return props.integrationCapabilities.includes("edit_events");
});

const canDelete = computed(() => {
  if (!props.integrationCapabilities)
    return true;
  return props.integrationCapabilities.includes("delete_events");
});

const canAdd = computed(() => {
  if (!props.integrationCapabilities)
    return true;
  return props.integrationCapabilities.includes("add_events");
});

const isReadOnly = computed(() => {
  return Boolean(props.event && !canEdit.value);
});

// Check if form has unsaved changes
const hasUnsavedChanges = computed(() => {
  return (
    title.value !== initialValues.value.title
    || description.value !== initialValues.value.description
    || location.value !== initialValues.value.location
    || allDay.value !== initialValues.value.allDay
    || isRecurring.value !== initialValues.value.isRecurring
    || JSON.stringify([...selectedUsers.value].sort()) !== JSON.stringify([...initialValues.value.selectedUsers].sort())
  );
});

// Handle close with warning
function handleClose() {
  if (hasUnsavedChanges.value && !isReadOnly.value) {
    showUnsavedWarning.value = true;
  }
  else {
    emit("close");
  }
}

function confirmClose() {
  showUnsavedWarning.value = false;
  emit("close");
}

function cancelClose() {
  showUnsavedWarning.value = false;
}

// Store initial values when form opens or event changes
function storeInitialValues() {
  initialValues.value = {
    title: title.value,
    description: description.value,
    location: location.value,
    allDay: allDay.value,
    selectedUsers: [...selectedUsers.value],
    isRecurring: isRecurring.value,
  };
}

watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    await fetchUsers();
    // Store initial values after a short delay to let the form populate
    setTimeout(() => storeInitialValues(), 100);
  }
  else {
    showUnsavedWarning.value = false;
  }
});

watch(startDate, (newStartDate) => {
  if (newStartDate && endDate.value) {
    const startTime = newStartDate.toDate(getLocalTimeZone());
    const endTime = endDate.value.toDate(getLocalTimeZone());

    if (startTime.getTime() === endTime.getTime() && isStartTimeAfterEndTime()) {
      endDate.value = newStartDate;
    }

    if (isRecurring.value && recurrenceEndType.value === "until") {
      const untilDate = recurrenceUntil.value.toDate(getLocalTimeZone());
      if (isBefore(untilDate, startTime)) {
        recurrenceUntil.value = newStartDate;
      }
    }
  }
});

watch(endDate, (newEndDate) => {
  if (newEndDate && startDate.value) {
    const startTime = startDate.value.toDate(getLocalTimeZone());
    const endTime = newEndDate.toDate(getLocalTimeZone());

    if (startTime.getTime() === endTime.getTime() && isStartTimeAfterEndTime()) {
      startDate.value = newEndDate;
    }
  }
});

watch(startHour, () => updateEndTime());
watch(startMinute, () => updateEndTime());
watch(startAmPm, () => updateEndTime());

watch(endHour, () => updateStartTime());
watch(endMinute, () => updateStartTime());
watch(endAmPm, () => updateStartTime());

let isUpdatingUntil = false;
watch(recurrenceUntil, () => {
  if (!isUpdatingUntil && isRecurring.value && recurrenceEndType.value === "until") {
    isUpdatingUntil = true;
    const untilDate = recurrenceUntil.value.toDate(getLocalTimeZone());
    const startLocalDate = startDate.value.toDate(getLocalTimeZone());

    if (isBefore(untilDate, startLocalDate)) {
      recurrenceUntil.value = startDate.value;
    }
    isUpdatingUntil = false;
  }
});

function handleAllDayToggle() {
  if (!allDay.value) {
    const now = new Date();

    const currentMinutes = now.getMinutes();
    const roundedMinutes = Math.round(currentMinutes / 5) * 5;

    let currentHour = now.getHours();
    let adjustedMinutes = roundedMinutes;

    if (adjustedMinutes === 60) {
      adjustedMinutes = 0;
      currentHour += 1;
    }

    let startHourValue = currentHour;
    let startAmPmValue = "AM";

    if (startHourValue === 0) {
      startHourValue = 12;
    }
    else if (startHourValue > 12) {
      startHourValue -= 12;
      startAmPmValue = "PM";
    }
    else if (startHourValue === 12) {
      startAmPmValue = "PM";
    }

    startHour.value = startHourValue;
    startMinute.value = adjustedMinutes;
    startAmPm.value = startAmPmValue;

    let endHourValue = startHour.value;
    let endMinuteValue = startMinute.value + 30;
    let endAmPmValue = startAmPm.value;

    if (endMinuteValue >= 60) {
      endMinuteValue -= 60;
      endHourValue += 1;
    }

    if (endHourValue > 12) {
      endHourValue -= 12;
      endAmPmValue = endAmPmValue === "AM" ? "PM" : "AM";
    }

    if (endHourValue === 0) {
      endHourValue = 12;
    }

    endHour.value = endHourValue;
    endMinute.value = endMinuteValue;
    endAmPm.value = endAmPmValue;
  }
}

watch(() => props.event, async (newEvent) => {
  if (newEvent) {
    // Handle new events (empty id) - set dates from the event but reset other fields
    if (newEvent.id === "") {
      title.value = "";
      description.value = "";
      location.value = "";
      selectedUsers.value = [];
      error.value = null;
      resetRecurrenceFields();

      // Use the start date from the event (set when clicking "+ Add Event" on a specific day)
      const start = newEvent.start instanceof Date ? newEvent.start : new Date(newEvent.start);
      const startDateStr = start.toISOString().split("T")[0];
      if (startDateStr) {
        startDate.value = parseDate(startDateStr);
        endDate.value = parseDate(startDateStr);
      }

      // Set default time to current time rounded to nearest 5 minutes
      const now = new Date();
      const currentMinutes = now.getMinutes();
      const roundedMinutes = Math.round(currentMinutes / 5) * 5;
      let currentHour = now.getHours();
      let adjustedMinutes = roundedMinutes;

      if (adjustedMinutes === 60) {
        adjustedMinutes = 0;
        currentHour += 1;
      }

      let startHourValue = currentHour;
      let startAmPmValue = "AM";

      if (startHourValue === 0) {
        startHourValue = 12;
      }
      else if (startHourValue > 12) {
        startHourValue -= 12;
        startAmPmValue = "PM";
      }
      else if (startHourValue === 12) {
        startAmPmValue = "PM";
      }

      startHour.value = startHourValue;
      startMinute.value = adjustedMinutes;
      startAmPm.value = startAmPmValue;

      // End time is 30 minutes after start
      let endHourValue = currentHour;
      let endMinuteValue = adjustedMinutes + 30;
      let endAmPmValue = startAmPmValue;

      if (endMinuteValue >= 60) {
        endMinuteValue -= 60;
        endHourValue += 1;
      }

      if (endHourValue >= 24) {
        endHourValue -= 24;
      }

      if (endHourValue === 0) {
        endHourValue = 12;
        endAmPmValue = "AM";
      }
      else if (endHourValue > 12) {
        endHourValue -= 12;
        endAmPmValue = "PM";
      }
      else if (endHourValue === 12) {
        endAmPmValue = "PM";
      }

      endHour.value = endHourValue;
      endMinute.value = endMinuteValue;
      endAmPm.value = endAmPmValue;

      allDay.value = newEvent.allDay || false;
      return;
    }

    // Handle existing events
    const isExpandedEvent = newEvent.id.includes("-");
    let originalEvent = newEvent;

    if (isExpandedEvent && !newEvent.integrationId) {
      const originalId = newEvent.id.split("-")[0];

      const fetchedEvent = await $fetch<CalendarEvent>(`/api/calendar-events/${originalId}`);
      if (fetchedEvent) {
        const fetchedCalendarEvent = fetchedEvent;
        originalEvent = {
          ...fetchedCalendarEvent,

          start: newEvent.start,
          end: newEvent.end,

          ical_event: newEvent.ical_event
            ? {
                ...fetchedCalendarEvent.ical_event,
                dtstart: newEvent.ical_event.dtstart,
                dtend: newEvent.ical_event.dtend,
              }
            : null,
        } as CalendarEvent;
      }
    }

    title.value = originalEvent.title || "";
    description.value = originalEvent.description || "";
    const start = originalEvent.start instanceof Date ? originalEvent.start : new Date(originalEvent.start);

    let startLocal, endLocal;

    if (newEvent.allDay) {
      startLocal = new Date(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
      const endDate = newEvent.end instanceof Date ? newEvent.end : new Date(newEvent.end);
      endLocal = new Date(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate() - 1);
    }
    else {
      startLocal = getLocalTimeFromUTC(start);
      endLocal = getLocalTimeFromUTC(newEvent.end instanceof Date ? newEvent.end : new Date(newEvent.end));
    }

    const startDateStr = startLocal.toLocaleDateString("en-CA");
    const endDateStr = endLocal.toLocaleDateString("en-CA");

    startDate.value = parseDate(startDateStr);
    endDate.value = parseDate(endDateStr);

    const startTimeStr = getEventStartTimeForInput(newEvent);
    const endTimeStr = getEventEndTimeForInput(newEvent);

    const startTimeParts = startTimeStr.split(":");
    if (startTimeParts.length >= 2) {
      const startTimeHour = Number.parseInt(startTimeParts[0]!);
      const startHourValue = startTimeHour === 0 ? 12 : startTimeHour > 12 ? startTimeHour - 12 : startTimeHour;
      startHour.value = startHourValue;
      startMinute.value = Number.parseInt(startTimeParts[1]!);
      startAmPm.value = startTimeHour >= 12 ? "PM" : "AM";
    }

    const endTimeParts = endTimeStr.split(":");
    if (endTimeParts.length >= 2) {
      const endTimeHour = Number.parseInt(endTimeParts[0]!);
      endHour.value = endTimeHour === 0 ? 12 : endTimeHour > 12 ? endTimeHour - 12 : endTimeHour;
      endMinute.value = Number.parseInt(endTimeParts[1]!);
      endAmPm.value = endTimeHour >= 12 ? "PM" : "AM";
    }
    allDay.value = newEvent.allDay || false;
    location.value = newEvent.location || "";
    selectedUsers.value = newEvent.users?.map(user => user.id) || [];
    error.value = null;

    if (newEvent.ical_event) {
      parseICalEvent(newEvent.ical_event);
    }
    else {
      resetRecurrenceFields();
    }
  }
  else {
    resetForm();
  }
}, { immediate: true });

function resetForm() {
  title.value = "";
  description.value = "";

  const now = new Date();

  const todayString = now.toISOString().split("T")[0];
  if (todayString) {
    const todayDate = parseDate(todayString);
    startDate.value = todayDate;
    endDate.value = todayDate;
  }

  const currentMinutes = now.getMinutes();
  const roundedMinutes = Math.round(currentMinutes / 5) * 5;

  let currentHour = now.getHours();
  let adjustedMinutes = roundedMinutes;

  if (adjustedMinutes === 60) {
    adjustedMinutes = 0;
    currentHour += 1;
  }

  let startHourValue = currentHour;
  let startAmPmValue = "AM";

  if (startHourValue === 0) {
    startHourValue = 12;
  }
  else if (startHourValue > 12) {
    startHourValue -= 12;
    startAmPmValue = "PM";
  }
  else if (startHourValue === 12) {
    startAmPmValue = "PM";
  }

  startHour.value = startHourValue;
  startMinute.value = adjustedMinutes;
  startAmPm.value = startAmPmValue;

  let endHourValue = startHour.value;
  let endMinuteValue = startMinute.value + 30;
  let endAmPmValue = startAmPm.value;

  if (endMinuteValue >= 60) {
    endMinuteValue -= 60;
    endHourValue += 1;
  }

  if (endHourValue > 12) {
    endHourValue -= 12;
    endAmPmValue = endAmPmValue === "AM" ? "PM" : "AM";
  }

  if (endHourValue === 0) {
    endHourValue = 12;
  }

  endHour.value = endHourValue;
  endMinute.value = endMinuteValue;
  endAmPm.value = endAmPmValue;

  allDay.value = false;
  location.value = "";
  selectedUsers.value = [];
  error.value = null;
  isSubmitting.value = false;
  isDeleting.value = false;

  isRecurring.value = false;
  recurrenceType.value = "weekly";
  recurrenceInterval.value = 1;
  recurrenceEndType.value = "never";
  recurrenceCount.value = 10;
  recurrenceUntil.value = new CalendarDate(2025, 12, 31);
  recurrenceDays.value = [];
  recurrenceMonthlyType.value = "day";
  recurrenceMonthlyWeekday.value = { week: 1, day: 1 };
  recurrenceYearlyType.value = "day";
  recurrenceYearlyWeekday.value = { week: 1, day: 1, month: 0 };
}

function updateEndTime() {
  if (allDay.value)
    return;

  if (startDate.value.toDate(getLocalTimeZone()).getTime() === endDate.value.toDate(getLocalTimeZone()).getTime() && isStartTimeAfterEndTime()) {
    let endHourValue = startHour.value;
    let endMinuteValue = startMinute.value + 30;
    let endAmPmValue = startAmPm.value;

    if (endMinuteValue >= 60) {
      endMinuteValue -= 60;
      endHourValue += 1;
    }

    if (endHourValue > 12) {
      endHourValue -= 12;
      endAmPmValue = endAmPmValue === "AM" ? "PM" : "AM";
    }

    if (endHourValue === 0) {
      endHourValue = 12;
    }

    endHour.value = endHourValue;
    endMinute.value = endMinuteValue;
    endAmPm.value = endAmPmValue;
  }
}

function updateStartTime() {
  if (allDay.value)
    return;

  if (startDate.value.toDate(getLocalTimeZone()).getTime() === endDate.value.toDate(getLocalTimeZone()).getTime() && isEndTimeBeforeStartTime()) {
    let startHourValue = endHour.value;
    let startMinuteValue = endMinute.value - 30;
    let startAmPmValue = endAmPm.value;

    if (startMinuteValue < 0) {
      startMinuteValue += 60;
      startHourValue -= 1;
    }

    if (startHourValue < 1) {
      startHourValue += 12;
      startAmPmValue = startAmPmValue === "AM" ? "PM" : "AM";
    }

    if (startHourValue === 0) {
      startHourValue = 12;
    }

    startHour.value = startHourValue;
    startMinute.value = startMinuteValue;
    startAmPm.value = startAmPmValue;
  }
}

function isStartTimeAfterEndTime(): boolean {
  const startTime24 = startAmPm.value === "PM" && startHour.value !== 12 ? startHour.value + 12 : startHour.value === 12 && startAmPm.value === "AM" ? 0 : startHour.value;
  const endTime24 = endAmPm.value === "PM" && endHour.value !== 12 ? endHour.value + 12 : endHour.value === 12 && endAmPm.value === "AM" ? 0 : endHour.value;

  const startMinutes = startTime24 * 60 + startMinute.value;
  const endMinutes = endTime24 * 60 + endMinute.value;

  if (startDate.value.toDate(getLocalTimeZone()).getTime() === endDate.value.toDate(getLocalTimeZone()).getTime()) {
    return startMinutes > endMinutes;
  }

  return false;
}

function isEndTimeBeforeStartTime(): boolean {
  return isStartTimeAfterEndTime();
}

function toggleRecurrenceDay(day: number) {
  if (isReadOnly.value)
    return;

  const index = recurrenceDays.value.indexOf(day);
  if (index > -1) {
    recurrenceDays.value.splice(index, 1);
  }
  else {
    recurrenceDays.value.push(day);
  }
}

function parseICalEvent(icalData: ICalEvent | null): void {
  if (!icalData || icalData.type !== "VEVENT") {
    resetRecurrenceFields();
    return;
  }

  try {
    const event = icalData;

    const rrule = event.rrule;
    if (rrule) {
      isRecurring.value = true;

      const freq = rrule.freq?.toLowerCase();
      if (freq && ["daily", "weekly", "monthly", "yearly"].includes(freq)) {
        recurrenceType.value = freq as "daily" | "weekly" | "monthly" | "yearly";
      }

      recurrenceInterval.value = rrule.interval || 1;

      const dayNames = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

      if (recurrenceType.value === "weekly" && rrule.byday) {
        recurrenceDays.value = rrule.byday.map((day: string) => dayNames.indexOf(day)).filter((day: number) => day !== -1);
      }

      if (recurrenceType.value === "monthly" && rrule.byday) {
        const bydayStr = Array.isArray(rrule.byday) ? rrule.byday[0] : rrule.byday;
        if (bydayStr) {
          const weekMatch = bydayStr.match(/^(-?\d+)([A-Z]{2})$/);
          if (weekMatch) {
            const week = Number.parseInt(weekMatch[1] || "1", 10);
            const dayCode = weekMatch[2] || "SU";
            const dayIndex = dayNames.indexOf(dayCode);

            if (dayIndex !== -1) {
              recurrenceMonthlyType.value = "weekday";
              recurrenceMonthlyWeekday.value = { week, day: dayIndex };
            }
          }
        }
      }

      if (recurrenceType.value === "yearly" && rrule.byday && rrule.bymonth) {
        const bydayStr = Array.isArray(rrule.byday) ? rrule.byday[0] : rrule.byday;
        if (bydayStr) {
          const weekMatch = bydayStr.match(/^(-?\d+)([A-Z]{2})$/);
          if (weekMatch) {
            const week = Number.parseInt(weekMatch[1] || "1", 10);
            const dayCode = weekMatch[2] || "SU";
            const dayIndex = dayNames.indexOf(dayCode);

            if (dayIndex !== -1) {
              recurrenceYearlyType.value = "weekday";
              const month = Array.isArray(rrule.bymonth) ? (rrule.bymonth[0] || 1) - 1 : (rrule.bymonth || 1) - 1;
              recurrenceYearlyWeekday.value = { week, day: dayIndex, month };
            }
          }
        }
      }

      if (rrule.count) {
        recurrenceEndType.value = "count";
        recurrenceCount.value = rrule.count;
      }
      else if (rrule.until) {
        recurrenceEndType.value = "until";
        const untilICal = ical.Time.fromString(rrule.until, "UTC");
        if (untilICal) {
          const untilDate = untilICal.toJSDate();
          recurrenceUntil.value = new CalendarDate(
            untilDate.getUTCFullYear(),
            untilDate.getUTCMonth() + 1,
            untilDate.getUTCDate(),
          );
        }
      }
      else {
        recurrenceEndType.value = "never";
      }
    }
    else {
      resetRecurrenceFields();
    }
  }
  catch (err) {
    consola.error("Error parsing iCal event:", err);
    resetRecurrenceFields();
  }
}

function resetRecurrenceFields(): void {
  isRecurring.value = false;
  recurrenceType.value = "weekly";
  recurrenceInterval.value = 1;
  recurrenceEndType.value = "never";
  recurrenceCount.value = 10;
  recurrenceUntil.value = new CalendarDate(2025, 12, 31);
  recurrenceDays.value = [];
  recurrenceMonthlyType.value = "day";
  recurrenceMonthlyWeekday.value = { week: 1, day: 1 };
  recurrenceYearlyType.value = "day";
  recurrenceYearlyWeekday.value = { week: 1, day: 1, month: 0 };
}

function generateICalEvent(start: Date, end: Date): ICalEvent {
  const startTime = ical.Time.fromJSDate(start, true);
  const endTime = ical.Time.fromJSDate(end, true);

  const event: ICalEvent = {
    type: "VEVENT",
    uid: props.event?.id || `skylite-${Date.now()}`,
    summary: title.value || "(no title)",
    description: description.value || undefined,
    location: location.value || undefined,
    dtstart: startTime.toString(),
    dtend: endTime.toString(),
    attendees: selectedUsers.value.length > 0
      ? users.value
          .filter(user => selectedUsers.value.includes(user.id))
          .map((user) => {
            const sanitizedName = user.name.toLowerCase().replace(/[^a-z0-9]/g, "");
            return {
              cn: user.name,
              mailto: user.email || `${sanitizedName}@skylite.local`,
              role: "REQ-PARTICIPANT",
            };
          })
      : undefined,
  };

  if (isRecurring.value) {
    const rruleObj: ICalEvent["rrule"] = {
      freq: recurrenceType.value.toUpperCase(),
      ...(recurrenceInterval.value > 1 && { interval: recurrenceInterval.value }),
    };

    const dayNames = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

    if (recurrenceDays.value.length > 0) {
      const startDay = start.getUTCDay();
      const sortedDays = [...recurrenceDays.value].sort((a, b) => {
        const relativeA = a >= startDay ? a - startDay : 7 - startDay + a;
        const relativeB = b >= startDay ? b - startDay : 7 - startDay + b;
        return relativeA - relativeB;
      });

      const firstDay = sortedDays[0] ?? startDay;
      if (startDay !== firstDay) {
        const daysToAdd = firstDay >= startDay
          ? firstDay - startDay
          : 7 - startDay + firstDay;

        start = new Date(start.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
        end = new Date(end.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

        event.dtstart = ical.Time.fromJSDate(start, true).toString();
        event.dtend = ical.Time.fromJSDate(end, true).toString();
      }
    }

    if (recurrenceType.value === "weekly" && recurrenceDays.value.length > 0) {
      rruleObj.byday = recurrenceDays.value
        .map(day => dayNames[day] || "SU")
        .filter((day): day is string => Boolean(day));
    }

    if (recurrenceType.value === "monthly" && recurrenceMonthlyType.value === "weekday") {
      const week = recurrenceMonthlyWeekday.value.week;
      const day = dayNames[recurrenceMonthlyWeekday.value.day];
      rruleObj.byday = [`${week}${day}`];
    }

    if (recurrenceType.value === "yearly" && recurrenceYearlyType.value === "weekday") {
      const week = recurrenceYearlyWeekday.value.week;
      const day = dayNames[recurrenceYearlyWeekday.value.day];
      const month = recurrenceYearlyWeekday.value.month + 1;
      rruleObj.byday = [`${week}${day}`];
      rruleObj.bymonth = [month];
    }

    if (recurrenceEndType.value === "count") {
      rruleObj.count = recurrenceCount.value;
    }
    else if (recurrenceEndType.value === "until" && recurrenceUntil.value) {
      const untilDate = recurrenceUntil.value.toDate(getLocalTimeZone());
      if (untilDate) {
        const endOfDay = new Date(untilDate);
        endOfDay.setHours(23, 59, 59, 999);
        const untilICal = ical.Time.fromJSDate(endOfDay, true);
        rruleObj.until = untilICal.toString();
      }
    }

    event.rrule = rruleObj;
  }

  return event;
}

function handleSave() {
  // Prevent double-submission
  if (isSubmitting.value) {
    return;
  }

  if (!canAdd.value && !props.event) {
    error.value = "This integration does not support creating new events";
    return;
  }

  if (!canEdit.value && props.event) {
    error.value = "This integration does not support editing events";
    return;
  }

  if (!title.value.trim()) {
    error.value = "Title is required";
    return;
  }

  if (!startDate.value || !endDate.value) {
    error.value = "Invalid date selection";
    return;
  }

  isSubmitting.value = true;

  let start: Date;
  let end: Date;

  try {
    if (allDay.value) {
      const startUTC = new Date(Date.UTC(
        startDate.value.year,
        startDate.value.month - 1,
        startDate.value.day,
        0,
        0,
        0,
        0,
      ));

      const endUTC = new Date(Date.UTC(
        endDate.value.year,
        endDate.value.month - 1,
        endDate.value.day + 1,
        0,
        0,
        0,
        0,
      ));

      start = startUTC;
      end = endUTC;
    }
    else {
      const startLocal = startDate.value.toDate(getLocalTimeZone());
      const endLocal = endDate.value.toDate(getLocalTimeZone());

      const startHours24 = startAmPm.value === "PM" && startHour.value !== 12 ? startHour.value + 12 : startHour.value === 12 && startAmPm.value === "AM" ? 0 : startHour.value;
      const endHours24 = endAmPm.value === "PM" && endHour.value !== 12 ? endHour.value + 12 : endHour.value === 12 && endAmPm.value === "AM" ? 0 : endHour.value;

      if (
        startHours24 < StartHour
        || startHours24 > EndHour
        || endHours24 < StartHour
        || endHours24 > EndHour
      ) {
        error.value = `Selected time must be between ${StartHour}:00 and ${EndHour}:00`;
        return;
      }

      startLocal.setHours(startHours24, startMinute.value, 0, 0);
      endLocal.setHours(endHours24, endMinute.value, 0, 0);

      const browserTimezone = getBrowserTimezone();
      const timezone = browserTimezone ? ical.TimezoneService.get(browserTimezone) : null;

      if (timezone) {
        const startICal = ical.Time.fromJSDate(startLocal, true);
        const endICal = ical.Time.fromJSDate(endLocal, true);

        const startLocalICal = startICal.convertToZone(timezone);
        const endLocalICal = endICal.convertToZone(timezone);

        const startUTC = startLocalICal.convertToZone(ical.TimezoneService.get("UTC"));
        const endUTC = endLocalICal.convertToZone(ical.TimezoneService.get("UTC"));

        start = startUTC.toJSDate();
        end = endUTC.toJSDate();
      }
      else {
        const startICal = ical.Time.fromJSDate(startLocal, false)
          .convertToZone(ical.TimezoneService.get("UTC"));
        const endICal = ical.Time.fromJSDate(endLocal, false)
          .convertToZone(ical.TimezoneService.get("UTC"));
        start = startICal.toJSDate();
        end = endICal.toJSDate();
      }
    }

    const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    if (isBefore(endDateOnly, startDateOnly)) {
      error.value = "End date cannot be before start date";
      return;
    }

    const eventTitle = title.value.trim();

    const selectedUserObjects = users.value
      .filter(user => selectedUsers.value.includes(user.id))
      .map(user => ({
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        color: user.color,
      }));

    const icalEvent = generateICalEvent(start, end);

    if (isRecurring.value && recurrenceDays.value.length > 0) {
      const startDay = start.getUTCDay();
      const sortedDays = [...recurrenceDays.value].sort((a, b) => {
        const relativeA = a >= startDay ? a - startDay : 7 - startDay + a;
        const relativeB = b >= startDay ? b - startDay : 7 - startDay + b;
        return relativeA - relativeB;
      });

      const firstDay = sortedDays[0] ?? startDay;
      if (startDay !== firstDay) {
        const daysToAdd = firstDay >= startDay
          ? firstDay - startDay
          : 7 - startDay + firstDay;

        start = new Date(start.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
        end = new Date(end.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
      }
    }

    const isExpandedEvent = props.event?.id?.includes("-");
    const eventId = isExpandedEvent ? props.event?.id.split("-")[0] : props.event?.id || "";

    const eventData: CalendarEvent = {
      id: eventId || "",
      title: eventTitle,
      description: description.value,
      start,
      end,
      allDay: allDay.value,
      location: location.value,
      color: props.event?.color || "sky",
      users: selectedUserObjects,
      ical_event: icalEvent,
    };

    emit("save", eventData);
    // Reset submitting state after a short delay to prevent rapid re-clicks
    setTimeout(() => {
      isSubmitting.value = false;
    }, 500);
  }
  catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    consola.error("Calendar Event Dialog: Error converting dates in handleSave:", errorMessage);
    error.value = "Failed to process event dates. Please try again.";
    isSubmitting.value = false;
  }
}

function handleDelete() {
  // Prevent double-delete
  if (isDeleting.value) {
    return;
  }

  if (!canDelete.value) {
    error.value = "This integration does not support deleting events";
    return;
  }

  if (props.event?.id) {
    isDeleting.value = true;
    emit("delete", props.event.id);
    // Reset after a short delay
    setTimeout(() => {
      isDeleting.value = false;
    }, 500);
  }
}
</script>

<template>
  <!-- Unsaved Changes Warning Modal -->
  <div
    v-if="showUnsavedWarning"
    class="fixed inset-0 z-[110] flex items-center justify-center bg-black/50"
    @click="cancelClose"
  >
    <div
      class="w-full max-w-sm mx-4 bg-default rounded-lg border border-default shadow-lg p-4"
      @click.stop
    >
      <h3 class="text-base font-semibold mb-2">
        Unsaved Changes
      </h3>
      <p class="text-sm text-muted mb-4">
        You have unsaved changes. Are you sure you want to close without saving?
      </p>
      <div class="flex gap-2 justify-end">
        <UButton
          color="neutral"
          variant="ghost"
          @click="cancelClose"
        >
          Keep Editing
        </UButton>
        <UButton
          color="error"
          variant="subtle"
          @click="confirmClose"
        >
          Discard Changes
        </UButton>
      </div>
    </div>
  </div>

  <div
    v-if="isOpen"
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
    @click="handleClose"
  >
    <div
      class="w-full max-w-[425px] mx-4 max-h-[90vh] overflow-y-auto bg-default rounded-lg border border-default shadow-lg"
      @click.stop
    >
      <div class="flex items-center justify-between p-4 border-b border-default">
        <h2 class="text-base font-semibold leading-6">
          {{ event?.id ? 'Edit Event' : 'Create Event' }}
        </h2>
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-x"
          class="-my-1"
          aria-label="Close dialog"
          @click="handleClose"
        />
      </div>
      <div class="p-4 space-y-6">
        <div
          v-if="error"
          role="alert"
          class="bg-error/10 text-error rounded-md px-3 py-2 text-sm"
        >
          {{ error }}
        </div>
        <div v-if="isReadOnly" class="bg-info/10 text-info rounded-md px-3 py-2 text-sm">
          This event cannot be edited. {{ integrationServiceName || 'This integration' }} does not support editing events.
        </div>
        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Title</label>
          <UInput
            v-model="title"
            placeholder="Event title"
            class="w-full"
            :ui="{ base: 'w-full' }"
            :disabled="isReadOnly"
          />
        </div>
        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Description</label>
          <UTextarea
            v-model="description"
            placeholder="Event description"
            :rows="3"
            class="w-full"
            :ui="{ base: 'w-full' }"
            :disabled="isReadOnly"
          />
        </div>
        <div class="flex gap-4">
          <div class="w-1/2 space-y-2">
            <label class="block text-sm font-medium text-highlighted">Start Date</label>
            <UPopover>
              <UButton
                color="neutral"
                variant="subtle"
                icon="i-lucide-calendar"
                class="w-full justify-between"
                :disabled="isReadOnly"
              >
                <NuxtTime
                  v-if="startDate"
                  :datetime="startDate.toDate(getLocalTimeZone())"
                  year="numeric"
                  month="short"
                  day="numeric"
                />
                <span v-else>Select a date</span>
              </UButton>
              <template #content>
                <UCalendar
                  :model-value="startDate as DateValue"
                  class="p-2"
                  :disabled="isReadOnly"
                  @update:model-value="(value) => { if (value) startDate = value as DateValue }"
                />
              </template>
            </UPopover>
          </div>
          <div v-if="!allDay" class="w-1/2 space-y-2">
            <label class="block text-sm font-medium text-highlighted">Start Time</label>
            <div class="flex gap-2">
              <USelect
                v-model="startHour"
                :items="hourOptions"
                option-attribute="label"
                value-attribute="value"
                class="flex-1"
                :ui="{ base: 'flex-1' }"
                :disabled="isReadOnly"
              />
              <USelect
                v-model="startMinute"
                :items="minuteOptions"
                option-attribute="label"
                value-attribute="value"
                class="flex-1"
                :ui="{ base: 'flex-1' }"
                :disabled="isReadOnly"
              />
              <USelect
                v-model="startAmPm"
                :items="amPmOptions"
                option-attribute="label"
                value-attribute="value"
                class="flex-1"
                :ui="{ base: 'flex-1' }"
                :disabled="isReadOnly"
              />
            </div>
          </div>
        </div>
        <div class="flex gap-4">
          <div class="w-1/2 space-y-2">
            <label class="block text-sm font-medium text-highlighted">End Date</label>
            <UPopover>
              <UButton
                color="neutral"
                variant="subtle"
                icon="i-lucide-calendar"
                class="w-full justify-between"
                :disabled="isReadOnly"
              >
                <NuxtTime
                  v-if="endDate"
                  :datetime="endDate.toDate(getLocalTimeZone())"
                  year="numeric"
                  month="short"
                  day="numeric"
                />
                <span v-else>Select a date</span>
              </UButton>
              <template #content>
                <UCalendar
                  :model-value="endDate as DateValue"
                  class="p-2"
                  :disabled="isReadOnly"
                  @update:model-value="(value) => { if (value) endDate = value as DateValue }"
                />
              </template>
            </UPopover>
          </div>
          <div v-if="!allDay" class="w-1/2 space-y-2">
            <label class="block text-sm font-medium text-highlighted">End Time</label>
            <div class="flex gap-2">
              <USelect
                v-model="endHour"
                :items="hourOptions"
                option-attribute="label"
                value-attribute="value"
                class="flex-1"
                :ui="{ base: 'flex-1' }"
                :disabled="isReadOnly"
              />
              <USelect
                v-model="endMinute"
                :items="minuteOptions"
                option-attribute="label"
                value-attribute="value"
                class="flex-1"
                :ui="{ base: 'flex-1' }"
                :disabled="isReadOnly"
              />
              <USelect
                v-model="endAmPm"
                :items="amPmOptions"
                option-attribute="label"
                value-attribute="value"
                class="flex-1"
                :ui="{ base: 'flex-1' }"
                :disabled="isReadOnly"
              />
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <UCheckbox
            v-model="allDay"
            label="All day"
            :disabled="isReadOnly"
            @change="handleAllDayToggle"
          />
        </div>
        <div class="flex items-center gap-2">
          <UCheckbox
            v-model="isRecurring"
            label="Repeat"
            :disabled="isReadOnly"
          />
        </div>
        <div v-if="isRecurring" class="space-y-4 p-4 bg-muted rounded-lg">
          <div class="flex gap-4">
            <div class="w-1/2 space-y-2">
              <label class="block text-sm font-medium text-highlighted">Repeat</label>
              <USelect
                v-model="recurrenceType"
                :items="recurrenceTypeOptions"
                option-attribute="label"
                value-attribute="value"
                class="w-full"
                :ui="{ base: 'w-full' }"
                :disabled="isReadOnly"
              />
            </div>
            <div class="w-1/2 space-y-2">
              <label class="block text-sm font-medium text-highlighted">Every</label>
              <UInput
                v-model.number="recurrenceInterval"
                type="number"
                min="1"
                max="99"
                class="w-full"
                :ui="{ base: 'w-full' }"
                :disabled="isReadOnly"
              />
            </div>
          </div>
          <div v-if="recurrenceType === 'weekly'" class="space-y-2">
            <label class="block text-sm font-medium text-highlighted">Repeat on</label>
            <div class="flex gap-1">
              <UButton
                v-for="day in dayOptions"
                :key="day.value"
                :variant="recurrenceDays.includes(day.value) ? 'solid' : 'outline'"
                size="sm"
                class="flex-1"
                :disabled="isReadOnly"
                @click="toggleRecurrenceDay(day.value)"
              >
                {{ day.label }}
              </UButton>
            </div>
            <div v-if="recurrenceDays.length > 0" class="text-sm text-warning">
              <div class="flex items-center justify-center gap-2">
                <span>
                  Dates will be adjusted based on selected days
                </span>
              </div>
            </div>
          </div>
          <div v-if="recurrenceType === 'monthly'" class="space-y-4">
            <div class="space-y-2">
              <label class="block text-sm font-medium text-highlighted">Repeat on</label>
              <USelect
                v-model="recurrenceMonthlyType"
                :items="monthlyTypeOptions"
                option-attribute="label"
                value-attribute="value"
                class="w-full"
                :ui="{ base: 'w-full' }"
                :disabled="isReadOnly"
              />
            </div>
            <div v-if="recurrenceMonthlyType === 'weekday'" class="space-y-2">
              <label class="block text-sm font-medium text-highlighted">Weekday</label>
              <div class="flex gap-2">
                <USelect
                  v-model="recurrenceMonthlyWeekday.week"
                  :items="weekOptions"
                  option-attribute="label"
                  value-attribute="value"
                  class="flex-1"
                  :ui="{ base: 'flex-1' }"
                  :disabled="isReadOnly"
                />
                <USelect
                  v-model="recurrenceMonthlyWeekday.day"
                  :items="dayOptions"
                  option-attribute="label"
                  value-attribute="value"
                  class="flex-1"
                  :ui="{ base: 'flex-1' }"
                  :disabled="isReadOnly"
                />
              </div>
            </div>
          </div>
          <div v-if="recurrenceType === 'yearly'" class="space-y-4">
            <div class="space-y-2">
              <label class="block text-sm font-medium text-highlighted">Repeat on</label>
              <USelect
                v-model="recurrenceYearlyType"
                :items="yearlyTypeOptions"
                option-attribute="label"
                value-attribute="value"
                class="w-full"
                :ui="{ base: 'w-full' }"
                :disabled="isReadOnly"
              />
            </div>
            <div v-if="recurrenceYearlyType === 'weekday'" class="space-y-2">
              <label class="block text-sm font-medium text-highlighted">Weekday</label>
              <div class="flex gap-2">
                <USelect
                  v-model="recurrenceYearlyWeekday.week"
                  :items="weekOptions"
                  option-attribute="label"
                  value-attribute="value"
                  class="flex-1"
                  :ui="{ base: 'flex-1' }"
                  :disabled="isReadOnly"
                />
                <USelect
                  v-model="recurrenceYearlyWeekday.day"
                  :items="dayOptions"
                  option-attribute="label"
                  value-attribute="value"
                  class="flex-1"
                  :ui="{ base: 'flex-1' }"
                  :disabled="isReadOnly"
                />
                <USelect
                  v-model="recurrenceYearlyWeekday.month"
                  :items="monthOptions"
                  option-attribute="label"
                  value-attribute="value"
                  class="flex-1"
                  :ui="{ base: 'flex-1' }"
                  :disabled="isReadOnly"
                />
              </div>
            </div>
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium text-highlighted">Ends</label>
            <div class="flex gap-4">
              <USelect
                v-model="recurrenceEndType"
                :items="recurrenceEndTypeOptions"
                option-attribute="label"
                value-attribute="value"
                class="flex-1"
                :ui="{ base: 'flex-1' }"
                :disabled="isReadOnly"
              />
              <UInput
                v-if="recurrenceEndType === 'count'"
                v-model.number="recurrenceCount"
                type="number"
                min="1"
                max="999"
                placeholder="10"
                class="w-20"
                :ui="{ base: 'w-20' }"
                :disabled="isReadOnly"
              />
              <UPopover v-if="recurrenceEndType === 'until'">
                <UButton
                  color="neutral"
                  variant="subtle"
                  icon="i-lucide-calendar"
                  class="flex-1 justify-between"
                  :disabled="isReadOnly"
                >
                  <NuxtTime
                    v-if="recurrenceUntil"
                    :datetime="recurrenceUntil.toDate(getLocalTimeZone())"
                    year="numeric"
                    month="short"
                    day="numeric"
                  />
                  <span v-else>Select date</span>
                </UButton>
                <template #content>
                  <UCalendar
                    :model-value="recurrenceUntil as DateValue"
                    class="p-2"
                    :disabled="isReadOnly"
                    @update:model-value="(value) => { if (value) recurrenceUntil = value as DateValue }"
                  />
                </template>
              </UPopover>
            </div>
          </div>
        </div>
        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Location</label>
          <UInput
            v-model="location"
            placeholder="Event location"
            class="w-full"
            :ui="{ base: 'w-full' }"
            :disabled="isReadOnly"
          />
        </div>
        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Users</label>
          <div class="space-y-2">
            <div class="text-sm text-muted mb-2">
              {{ event?.id ? 'Edit users for this event:' : 'Select users for this event:' }}
            </div>
            <div class="flex flex-wrap gap-2">
              <UButton
                v-for="user in users"
                :key="user.id"
                variant="ghost"
                size="sm"
                class="p-1"
                :class="selectedUsers.includes(user.id) ? 'ring-2 ring-primary-500' : ''"
                :disabled="isReadOnly"
                @click="selectedUsers.includes(user.id) ? selectedUsers = selectedUsers.filter(id => id !== user.id) : selectedUsers.push(user.id)"
              >
                <UAvatar
                  :src="user.avatar || undefined"
                  :alt="user.name"
                  size="xl"
                />
              </UButton>
            </div>
            <div v-if="!users.length" class="text-sm text-muted">
              No users found! Please add some users in the <NuxtLink to="/settings" class="text-primary">
                settings
              </NuxtLink> page.
            </div>
          </div>
        </div>
      </div>
      <div class="flex justify-between p-4 border-t border-default">
        <div class="flex gap-2">
          <UButton
            v-if="event?.id && canDelete"
            color="error"
            variant="ghost"
            icon="i-lucide-trash"
            :loading="isDeleting"
            :disabled="isDeleting"
            @click="handleDelete"
          >
            Delete
          </UButton>
          <UButton
            v-if="!isReadOnly && !event?.id"
            color="neutral"
            variant="ghost"
            icon="i-lucide-rotate-ccw"
            @click="resetForm"
          >
            Reset
          </UButton>
        </div>
        <div class="flex gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            @click="handleClose"
          >
            Cancel
          </UButton>
          <UButton
            v-if="!isReadOnly"
            color="primary"
            :loading="isSubmitting"
            :disabled="isSubmitting"
            @click="handleSave"
          >
            Save
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
