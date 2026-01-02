<script setup lang="ts">
import type { DateValue } from "@internationalized/date";

import { CalendarDate, getLocalTimeZone, parseDate } from "@internationalized/date";
import { consola } from "consola";
import { isBefore } from "date-fns";
import ical from "ical.js";

import type { RecurrenceState } from "~/composables/useRecurrence";
import type { CalendarEvent, SourceCalendar } from "~/types/calendar";
import type { Integration } from "~/types/database";
import type { CalendarConfig } from "~/types/integrations";

import { useCalendar } from "~/composables/useCalendar";
import { useCalendarIntegrations } from "~/composables/useCalendarIntegrations";
import { useRecurrence } from "~/composables/useRecurrence";
import { useTimePicker } from "~/composables/useTimePicker";
import { useUsers } from "~/composables/useUsers";
import { DEFAULT_LOCAL_EVENT_COLOR, getBrowserTimezone } from "~/types/global";
import { integrationRegistry } from "~/types/integrations";

import type { ICalEvent } from "../../../server/integrations/iCal/types";

const props = defineProps<{
  event: CalendarEvent | null;
  isOpen: boolean;
  integrationCapabilities?: string[];
  integrationServiceName?: string;
  integrations?: Integration[];
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", event: CalendarEvent): void;
  (e: "delete", eventId: string): void;
}>();

const { users, fetchUsers } = useUsers();

const { getEventStartTimeForInput, getEventEndTimeForInput, getLocalTimeFromUTC } = useCalendar();
const {
  convert12To24,
  convert24To12,
  addMinutes,
  subtractMinutes,
  isTimeAfter,
  getCurrentTime12Hour,
} = useTimePicker();
const {
  parseRecurrenceFromICal,
  generateRecurrenceRule,
  resetRecurrenceFields: resetRecurrenceFieldsComposable,
  adjustStartDateForRecurrenceDays,
} = useRecurrence();

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

const selectedIntegrationId = ref<string | null>("local");
const selectedCalendarId = ref<string | null>(null);
const availableIntegrations = ref<Array<{ id: string; name: string; calendars: CalendarConfig[]; supportsSelectCalendars: boolean }>>([]);
const selectedEditableCalendars = ref<Set<string>>(new Set());
const calendarEventUsers = ref<Map<string, Array<{ id: string; name: string; avatar?: string | null; color?: string | null }>>>(new Map());

const eventSourceCalendars = computed(() => props.event?.sourceCalendars || []);
const editableSourceCalendars = computed(() => eventSourceCalendars.value.filter(calendar => calendar.canEdit));
const hasEditableSourceCalendars = computed(() => editableSourceCalendars.value.length > 0);

const enrichedSourceCalendars = computed(() => {
  return eventSourceCalendars.value.map((calendar) => {
    const user = getCalendarUsers(calendar);
    const displayColor = calendar.userColor || calendar.eventColor || "#06b6d4";
    const calendarKey = `${calendar.integrationId}-${calendar.calendarId}`;
    const eventUsers = calendarEventUsers.value.get(calendarKey) || [];

    let displayName: string;
    if (props.integrations) {
      const integration = props.integrations.find(i => i.id === calendar.integrationId);
      if (integration) {
        const hasSelectCalendars = hasCapability(integration, "select_calendars");

        if (hasSelectCalendars) {
          const calendarName = calendar.calendarName || calendar.calendarId;
          displayName = calendar.integrationName ? `${calendar.integrationName} · ${calendarName}` : calendarName;
        }
        else {
          displayName = calendar.integrationName || integration.name || integration.service;
        }
      }
      else {
        displayName = calendar.calendarName || calendar.integrationName || calendar.calendarId;
      }
    }
    else {
      displayName = calendar.calendarName || calendar.integrationName || calendar.calendarId;
    }

    return {
      ...calendar,
      user,
      displayColor,
      calendarName: displayName,
      eventUsers,
    };
  });
});

const calendarAccordionItems = computed(() => {
  if (enrichedSourceCalendars.value.length === 0)
    return [];

  return [{
    value: "calendars",
    label: "Calendars",
    content: "",
  }];
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

const recurrenceState: RecurrenceState = {
  isRecurring,
  recurrenceType,
  recurrenceInterval,
  recurrenceEndType,
  recurrenceCount,
  recurrenceUntil: recurrenceUntil as Ref<DateValue>,
  recurrenceDays,
  recurrenceMonthlyType,
  recurrenceMonthlyWeekday,
  recurrenceYearlyType,
  recurrenceYearlyWeekday,
};

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
  if (eventSourceCalendars.value.length > 0)
    return hasEditableSourceCalendars.value;
  if (!props.integrationCapabilities)
    return true;
  return props.integrationCapabilities.includes("edit_events");
});

const canDelete = computed(() => {
  if (eventSourceCalendars.value.length > 0)
    return hasEditableSourceCalendars.value;
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
  if (!props.event)
    return false;

  if (hasEditableSourceCalendars.value) {
    return selectedEditableCalendars.value.size === 0;
  }

  return !canEdit.value;
});

const currentIntegration = computed(() => {
  const integrationId = props.event?.integrationId || selectedIntegrationId.value;
  if (!integrationId || integrationId === "local" || !props.integrations)
    return null;
  return props.integrations.find(i => i.id === integrationId);
});

const selectedIntegrationConfig = computed(() => {
  return availableIntegrations.value.find(i => i.id === selectedIntegrationId.value);
});

function getCalendarUserIds(calendar: SourceCalendar, integration: Integration): string[] {
  if (!integration?.settings)
    return [];

  const hasSelectCalendars = hasCapability(integration, "select_calendars");

  if (hasSelectCalendars) {
    const calendars = integration.settings.calendars;
    if (Array.isArray(calendars)) {
      const calendarConfig = calendars.find((c): c is CalendarConfig => {
        return typeof c === "object" && c !== null && "id" in c && c.id === calendar.calendarId;
      });
      if (calendarConfig?.user) {
        return Array.isArray(calendarConfig.user) ? calendarConfig.user.filter((id): id is string => typeof id === "string") : [];
      }
    }
    return [];
  }

  const integrationUserIds = integration.settings.user;
  return Array.isArray(integrationUserIds) ? integrationUserIds.filter((id): id is string => typeof id === "string") : [];
}

function getUsersFromIds(userIds: string[]): Array<{ id: string; name: string; avatar?: string | null; color?: string | null }> {
  if (!users.value || userIds.length === 0)
    return [];

  const result: Array<{ id: string; name: string; avatar?: string | null; color?: string | null }> = [];
  for (const userId of userIds) {
    const user = users.value.find(u => u.id === userId);
    if (user) {
      result.push({
        id: user.id,
        name: user.name,
        avatar: user.avatar ?? undefined,
        color: user.color ?? undefined,
      });
    }
  }
  return result;
}

const integrationAssignedUserIds = computed(() => {
  const integration = currentIntegration.value;
  if (!integration)
    return [];

  const calendarId = props.event?.calendarId || selectedCalendarId.value;
  if (calendarId) {
    const calendar: SourceCalendar = {
      integrationId: integration.id,
      calendarId,
      integrationName: integration.name || integration.service,
      calendarName: calendarId,
      accessRole: "read",
      canEdit: false,
    };
    return getCalendarUserIds(calendar, integration);
  }

  return getCalendarUserIds({ integrationId: integration.id, calendarId: "", integrationName: "", calendarName: "", accessRole: "read", canEdit: false }, integration);
});

function getCalendarUsers(calendar: SourceCalendar) {
  if (!props.integrations)
    return null;

  const integration = props.integrations.find(i => i.id === calendar.integrationId);
  if (!integration)
    return null;

  const userIds = getCalendarUserIds(calendar, integration);
  if (userIds.length === 0)
    return null;

  const user = users.value?.find(u => userIds.includes(u.id));
  return user || null;
}

async function getCalendarEventUsers(calendar: SourceCalendar): Promise<Array<{ id: string; name: string; avatar?: string | null; color?: string | null }>> {
  if (calendar.integrationId === "" || calendar.calendarId === "local") {
    if (!calendar.eventId)
      return [];

    try {
      const event = await $fetch<CalendarEvent>(`/api/calendar-events/${calendar.eventId}`);
      return event.users || [];
    }
    catch (error) {
      consola.warn("CalendarEventDialog: Failed to fetch local event users:", error);
      return [];
    }
  }

  if (!props.integrations)
    return [];

  const integration = props.integrations.find(i => i.id === calendar.integrationId);
  if (!integration)
    return [];

  const userIds = getCalendarUserIds(calendar, integration);
  return getUsersFromIds(userIds);
}

function supportsUserSelection(calendar: SourceCalendar): boolean {
  if (calendar.integrationId === "" || calendar.calendarId === "local")
    return true;

  if (!props.integrations)
    return false;

  const integration = props.integrations.find(i => i.id === calendar.integrationId);
  return hasCapability(integration, "select_users");
}

const allowsUserSelection = computed(() => {
  if (eventSourceCalendars.value.length > 0) {
    if (selectedEditableCalendars.value.size === 0)
      return false;

    for (const calendarKey of selectedEditableCalendars.value) {
      const [integrationId, calendarId] = calendarKey.split("-");
      const calendar = eventSourceCalendars.value.find(
        cal => cal.integrationId === integrationId && cal.calendarId === calendarId,
      );
      if (calendar && supportsUserSelection(calendar))
        return true;
    }
    return false;
  }

  if (selectedIntegrationId.value === "local" || !selectedIntegrationId.value)
    return true;

  if (!props.integrations)
    return false;

  const integration = props.integrations.find(i => i.id === selectedIntegrationId.value);
  return hasCapability(integration, "select_users");
});

const userSelectionState = computed(() => {
  const support = eventSourceCalendars.value.length > 0
    ? (() => {
        const supports = eventSourceCalendars.value.map(calendar => supportsUserSelection(calendar));
        const allSupport = supports.every(s => s === true);
        const noneSupport = supports.every(s => s === false);
        if (allSupport)
          return "all" as const;
        if (noneSupport)
          return "none" as const;
        return "mixed" as const;
      })()
    : "none" as const;

  const selectedIntegrationSupports = selectedIntegrationId.value === "local" || !selectedIntegrationId.value
    ? true
    : hasCapability(currentIntegration.value, "select_users");

  const showLocked = eventSourceCalendars.value.length > 0
    ? support === "none" && canEdit.value
    : (!props.event || !props.event.id) && availableIntegrations.value.length > 0
        ? !selectedIntegrationSupports && canEdit.value
        : false;

  const showMixed = support === "mixed" && canEdit.value;

  return {
    support,
    selectedIntegrationSupports,
    showLocked,
    showMixed,
  };
});

const showLockedUserMessage = computed(() => userSelectionState.value.showLocked);
const showMixedUserMessage = computed(() => userSelectionState.value.showMixed);

const showCalendarPicker = computed(() => {
  if (props.event && props.event.id) {
    return false;
  }
  const shouldShow = availableIntegrations.value.length > 0;
  consola.debug("CalendarEventDialog: showCalendarPicker computed", {
    hasEvent: !!props.event,
    eventId: props.event?.id,
    availableIntegrationsCount: availableIntegrations.value.length,
    shouldShow,
  });
  return shouldShow;
});

const calendarPickerOptions = computed(() => {
  const options = [{ value: "local", label: "Local Calendar" }];

  availableIntegrations.value.forEach((integration) => {
    options.push({ value: integration.id, label: integration.name });
  });

  return options;
});

const integrationCalendarOptions = computed(() => {
  const integration = selectedIntegrationConfig.value;
  if (!integration || !integration.supportsSelectCalendars)
    return [];

  return integration.calendars
    .filter(c => c.accessRole === "write" && c.enabled)
    .map(c => ({ value: c.id, label: c.name }));
});

async function loadCalendarEventUsers() {
  calendarEventUsers.value.clear();
  if (eventSourceCalendars.value.length > 0) {
    await Promise.all(eventSourceCalendars.value.map(async (calendar) => {
      const calendarKey = `${calendar.integrationId}-${calendar.calendarId}`;
      const users = await getCalendarEventUsers(calendar);
      calendarEventUsers.value.set(calendarKey, users);
    }));
  }
}

function processIntegrationForPicker(integration: Integration): { id: string; name: string; calendars: CalendarConfig[]; supportsSelectCalendars: boolean } | null {
  const config = integrationRegistry.get(`calendar:${integration.service}`);
  if (!config)
    return null;

  const hasAddEvents = config.capabilities.includes("add_events");
  const hasSelectCalendars = config.capabilities.includes("select_calendars");

  if (!hasAddEvents)
    return null;

  const settingsCalendars = Array.isArray(integration.settings?.calendars)
    ? integration.settings.calendars as CalendarConfig[]
    : [];
  const integrationEnabled = integration.enabled ?? false;

  const calendars = settingsCalendars.map(cal => ({
    ...cal,
    enabled: integrationEnabled && (cal.enabled ?? false),
  }));

  const hasEnabledCalendars = calendars.some(
    cal => cal.accessRole === "write" && cal.enabled,
  );

  if (!hasSelectCalendars || hasEnabledCalendars) {
    return {
      id: integration.id,
      name: integration.name || `${integration.service} Calendar`,
      calendars,
      supportsSelectCalendars: hasSelectCalendars,
    };
  }

  return null;
}

async function setupEventDialog() {
  if (eventSourceCalendars.value.length > 0) {
    await loadCalendarEventUsers();
  }

  if ((!props.event || !props.event.id) && props.integrations) {
    availableIntegrations.value = [];
    const integrations = props.integrations as Integration[];

    const processedIntegrations = await Promise.all(
      integrations.map(integration => processIntegrationForPicker(integration)),
    );

    availableIntegrations.value = processedIntegrations.filter((integration): integration is { id: string; name: string; calendars: CalendarConfig[]; supportsSelectCalendars: boolean } => integration !== null);

    selectedIntegrationId.value = "local";
    selectedCalendarId.value = null;
  }

  await fetchUsers();
}

watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    await setupEventDialog();
  }
}, { immediate: true });

watch(selectedIntegrationId, (newIntegrationId) => {
  consola.debug("CalendarEventDialog: Integration selected", {
    integrationId: newIntegrationId,
    selectedIntegrationConfig: selectedIntegrationConfig.value,
  });

  selectedCalendarId.value = null;

  if (props.event?.id) {
    return;
  }

  if (newIntegrationId && newIntegrationId !== "local" && !allowsUserSelection.value) {
    selectedUsers.value = integrationAssignedUserIds.value || [];
  }

  if (!newIntegrationId || newIntegrationId === "local") {
    selectedUsers.value = [];
  }

  nextTick(() => {
    if (selectedIntegrationConfig.value?.supportsSelectCalendars && integrationCalendarOptions.value.length > 0 && !selectedCalendarId.value) {
      const firstCalendar = integrationCalendarOptions.value[0];
      if (firstCalendar) {
        selectedCalendarId.value = firstCalendar.value as string;
        consola.debug("CalendarEventDialog: Auto-selected first calendar", {
          calendarId: firstCalendar.value,
          calendarName: firstCalendar.label,
        });
        if (!allowsUserSelection.value) {
          selectedUsers.value = integrationAssignedUserIds.value || [];
        }
      }
    }
  });
});

watch(integrationCalendarOptions, (options) => {
  if (selectedIntegrationConfig.value?.supportsSelectCalendars && options.length > 0 && !selectedCalendarId.value) {
    const firstCalendar = options[0];
    if (firstCalendar) {
      selectedCalendarId.value = firstCalendar.value as string;
      consola.debug("CalendarEventDialog: Auto-selected first calendar from options watch", {
        calendarId: firstCalendar.value,
        calendarName: firstCalendar.label,
      });
    }
  }
});

watch(selectedCalendarId, () => {
  if (props.event?.id) {
    return;
  }

  if (selectedIntegrationConfig.value?.supportsSelectCalendars && !allowsUserSelection.value) {
    selectedUsers.value = integrationAssignedUserIds.value || [];
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
    const currentTime = getCurrentTime12Hour();
    startHour.value = currentTime.hour;
    startMinute.value = currentTime.minute;
    startAmPm.value = currentTime.amPm;

    const endTime = addMinutes(startHour.value, startMinute.value, startAmPm.value, 30);
    endHour.value = endTime.hour;
    endMinute.value = endTime.minute;
    endAmPm.value = endTime.amPm;
  }
}

watch(() => props.event, async (newEvent) => {
  if (newEvent && newEvent.id) {
    selectedEditableCalendars.value.clear();
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

    if (isExpandedEvent && newEvent.integrationId) {
      const originalId = newEvent.id.split("-")[0];
      try {
        if (currentIntegration.value?.service === "google") {
          const { getCalendarEvent } = useCalendarIntegrations();
          const fetchedEvent = await getCalendarEvent(
            newEvent.integrationId,
            originalId || "",
            newEvent.calendarId,
          );

          if (fetchedEvent) {
            originalEvent = {
              ...fetchedEvent,
              start: newEvent.start,
              end: newEvent.end,
              ical_event: newEvent.ical_event
                ? {
                    ...fetchedEvent.ical_event,
                    dtstart: newEvent.ical_event.dtstart,
                    dtend: newEvent.ical_event.dtend,
                  }
                : null,
            } as CalendarEvent;
          }
        }
      }
      catch {
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
      const startTime12 = convert24To12(startTimeHour);
      startHour.value = startTime12.hour;
      startMinute.value = Number.parseInt(startTimeParts[1]!);
      startAmPm.value = startTime12.amPm;
    }

    const endTimeParts = endTimeStr.split(":");
    if (endTimeParts.length >= 2) {
      const endTimeHour = Number.parseInt(endTimeParts[0]!);
      const endTime12 = convert24To12(endTimeHour);
      endHour.value = endTime12.hour;
      endMinute.value = Number.parseInt(endTimeParts[1]!);
      endAmPm.value = endTime12.amPm;
    }
    allDay.value = newEvent.allDay || false;
    location.value = newEvent.location || "";
    const eventToUse = originalEvent.users ? originalEvent : newEvent;
    selectedUsers.value = eventToUse.users?.map(user => user.id) || [];
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

  const currentTime = getCurrentTime12Hour();
  startHour.value = currentTime.hour;
  startMinute.value = currentTime.minute;
  startAmPm.value = currentTime.amPm;

  const endTime = addMinutes(startHour.value, startMinute.value, startAmPm.value, 30);
  endHour.value = endTime.hour;
  endMinute.value = endTime.minute;
  endAmPm.value = endTime.amPm;

  allDay.value = false;
  location.value = "";
  selectedUsers.value = [];
  error.value = null;

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
    const endTime = addMinutes(startHour.value, startMinute.value, startAmPm.value, 30);
    endHour.value = endTime.hour;
    endMinute.value = endTime.minute;
    endAmPm.value = endTime.amPm;
  }
}

function updateStartTime() {
  if (allDay.value)
    return;

  if (startDate.value.toDate(getLocalTimeZone()).getTime() === endDate.value.toDate(getLocalTimeZone()).getTime() && isEndTimeBeforeStartTime()) {
    const startTime = subtractMinutes(endHour.value, endMinute.value, endAmPm.value, 30);
    startHour.value = startTime.hour;
    startMinute.value = startTime.minute;
    startAmPm.value = startTime.amPm;
  }
}

function isStartTimeAfterEndTime(): boolean {
  if (startDate.value.toDate(getLocalTimeZone()).getTime() === endDate.value.toDate(getLocalTimeZone()).getTime()) {
    return isTimeAfter(
      startHour.value,
      startMinute.value,
      startAmPm.value,
      endHour.value,
      endMinute.value,
      endAmPm.value,
    );
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
  parseRecurrenceFromICal(icalData, recurrenceState);
}

function resetRecurrenceFields(): void {
  resetRecurrenceFieldsComposable(recurrenceState);
}

function generateICalEvent(start: Date, end: Date): ICalEvent {
  const adjustedStart = adjustStartDateForRecurrenceDays(start, recurrenceDays.value);
  let adjustedEnd = end;
  if (adjustedStart.getTime() !== start.getTime()) {
    const daysDiff = Math.round((adjustedStart.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    adjustedEnd = new Date(end.getTime() + daysDiff * 24 * 60 * 60 * 1000);
  }

  const startTime = ical.Time.fromJSDate(adjustedStart, true);
  const endTime = ical.Time.fromJSDate(adjustedEnd, true);

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

  const rrule = generateRecurrenceRule(recurrenceState, adjustedStart);
  if (rrule) {
    event.rrule = rrule;
  }

  return event;
}

function getIntegrationCapabilities(integration: Integration | null | undefined): string[] {
  if (!integration)
    return [];
  const config = integrationRegistry.get(`${integration.type}:${integration.service}`);
  return config?.capabilities || [];
}

function hasCapability(integration: Integration | null | undefined, capability: string): boolean {
  const capabilities = getIntegrationCapabilities(integration);
  return capabilities.includes(capability);
}

function getIntegrationCapabilitiesById(integrationId: string | null): string[] {
  if (!integrationId || !props.integrations)
    return [];
  const integration = props.integrations.find(i => i.id === integrationId);
  return getIntegrationCapabilities(integration);
}

function getSelectedSourceCalendars(): SourceCalendar[] | undefined {
  if (props.event?.sourceCalendars?.length) {
    if (hasEditableSourceCalendars.value) {
      return props.event.sourceCalendars.filter((cal) => {
        const key = `${cal.integrationId}-${cal.calendarId}`;
        return cal.canEdit ? selectedEditableCalendars.value.has(key) : true;
      });
    }
    return props.event.sourceCalendars;
  }

  if (!selectedIntegrationId.value || selectedIntegrationId.value === "local" || !props.integrations)
    return undefined;

  const integration = props.integrations.find(i => i.id === selectedIntegrationId.value);
  if (!integration)
    return undefined;

  const capabilities = getIntegrationCapabilitiesById(integration.id);
  const hasEditEvents = capabilities.includes("edit_events");

  if (selectedIntegrationConfig.value?.supportsSelectCalendars && selectedCalendarId.value) {
    const calendar = selectedIntegrationConfig.value.calendars.find(c => c.id === selectedCalendarId.value);
    if (!calendar)
      return undefined;
    const accessRole = hasEditEvents && calendar.accessRole === "write" ? "write" : "read";
    return [{
      integrationId: integration.id,
      integrationName: integration.name || integration.service,
      calendarId: calendar.id,
      calendarName: calendar.name,
      accessRole,
      canEdit: accessRole === "write",
    }];
  }

  const accessRole = hasEditEvents ? "write" : "read";
  return [{
    integrationId: integration.id,
    integrationName: integration.name || integration.service,
    calendarId: selectedCalendarId.value || integration.id,
    calendarName: selectedCalendarId.value || integration.name,
    accessRole,
    canEdit: accessRole === "write",
  }];
}

function toggleCalendarSelection(calendar: SourceCalendar) {
  const key = `${calendar.integrationId}-${calendar.calendarId}`;
  if (selectedEditableCalendars.value.has(key)) {
    selectedEditableCalendars.value.delete(key);
  }
  else {
    selectedEditableCalendars.value.add(key);
  }
}

function validateEventData(): string | null {
  if (!canAdd.value && !props.event) {
    return "This integration does not support creating new events";
  }

  if (!canEdit.value && props.event) {
    return "This integration does not support editing events";
  }

  if (!startDate.value || !endDate.value) {
    return "Invalid date selection";
  }

  return null;
}

function convertFormToEventDates(): { start: Date; end: Date } | null {
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

      return { start: startUTC, end: endUTC };
    }

    const startLocal = startDate.value.toDate(getLocalTimeZone());
    const endLocal = endDate.value.toDate(getLocalTimeZone());

    const startHours24 = convert12To24(startHour.value, startAmPm.value);
    const endHours24 = convert12To24(endHour.value, endAmPm.value);

    if (
      startHours24 < StartHour
      || startHours24 > EndHour
      || endHours24 < StartHour
      || endHours24 > EndHour
    ) {
      error.value = `Selected time must be between ${StartHour}:00 and ${EndHour}:00`;
      return null;
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

      return { start: startUTC.toJSDate(), end: endUTC.toJSDate() };
    }

    const startICal = ical.Time.fromJSDate(startLocal, false)
      .convertToZone(ical.TimezoneService.get("UTC"));
    const endICal = ical.Time.fromJSDate(endLocal, false)
      .convertToZone(ical.TimezoneService.get("UTC"));
    return { start: startICal.toJSDate(), end: endICal.toJSDate() };
  }
  catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    consola.error("Calendar Event Dialog: Error converting dates:", errorMessage);
    error.value = "Failed to process event dates. Please try again.";
    return null;
  }
}

function adjustRecurrenceDates(start: Date, end: Date): { start: Date; end: Date } {
  if (!isRecurring.value || recurrenceDays.value.length === 0) {
    return { start, end };
  }

  const adjustedStart = adjustStartDateForRecurrenceDays(start, recurrenceDays.value);
  if (adjustedStart.getTime() !== start.getTime()) {
    const daysDiff = Math.round((adjustedStart.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    return {
      start: adjustedStart,
      end: new Date(end.getTime() + daysDiff * 24 * 60 * 60 * 1000),
    };
  }

  return { start, end };
}

function buildEventData(start: Date, end: Date): CalendarEvent {
  const eventTitle = title.value.trim() ? title.value : "(no title)";

  const selectedUserObjects = users.value
    .filter(user => selectedUsers.value.includes(user.id))
    .map(user => ({
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      color: user.color,
    }));

  const icalEvent = generateICalEvent(start, end);
  const sourceCalendars = getSelectedSourceCalendars();

  const isExpandedEvent = props.event?.id?.includes("-");
  const eventId = isExpandedEvent ? props.event?.id.split("-")[0] : props.event?.id || "";

  return {
    id: eventId || "",
    title: eventTitle,
    description: description.value,
    start,
    end,
    allDay: allDay.value,
    location: location.value,
    color: props.event?.color || DEFAULT_LOCAL_EVENT_COLOR,
    users: selectedUserObjects,
    ical_event: icalEvent,
    ...((selectedIntegrationId.value && selectedIntegrationId.value !== "local") && { integrationId: selectedIntegrationId.value }),
    ...((selectedCalendarId.value && selectedIntegrationId.value !== "local") && { calendarId: selectedCalendarId.value }),
    ...(props.event?.integrationId && { integrationId: props.event.integrationId }),
    ...(props.event?.calendarId && { calendarId: props.event.calendarId }),
    ...(sourceCalendars && sourceCalendars.length > 0 && { sourceCalendars }),
  };
}

function handleSave() {
  const validationError = validateEventData();
  if (validationError) {
    error.value = validationError;
    return;
  }

  const dates = convertFormToEventDates();
  if (!dates) {
    return;
  }

  const startDateOnly = new Date(dates.start.getFullYear(), dates.start.getMonth(), dates.start.getDate());
  const endDateOnly = new Date(dates.end.getFullYear(), dates.end.getMonth(), dates.end.getDate());

  if (isBefore(endDateOnly, startDateOnly)) {
    error.value = "End date cannot be before start date";
    return;
  }

  const adjustedDates = adjustRecurrenceDates(dates.start, dates.end);
  const eventData = buildEventData(adjustedDates.start, adjustedDates.end);

  emit("save", eventData);
}

function handleDelete() {
  if (!canDelete.value) {
    error.value = "This integration does not support deleting events";
    return;
  }

  if (isReadOnly.value) {
    error.value = "No calendars selected for deletion";
    return;
  }

  if (!props.event?.id) {
    return;
  }

  const sourceCalendars = getSelectedSourceCalendars();

  if (hasEditableSourceCalendars.value && (!sourceCalendars || sourceCalendars.length === 0)) {
    error.value = "No calendars selected for deletion";
    return;
  }

  const isExpandedEvent = props.event.id.includes("-");
  const eventId = isExpandedEvent ? props.event.id.split("-")[0] : props.event.id;

  if (!eventId) {
    error.value = "Invalid event ID";
    return;
  }

  emit("delete", eventId);
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
    @click="emit('close')"
  >
    <div
      class="w-[425px] max-h-[90vh] overflow-y-auto bg-default rounded-lg border border-default shadow-lg"
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
          @click="emit('close')"
        />
      </div>
      <div class="p-4 space-y-6">
        <div v-if="error" class="bg-error/10 text-error rounded-md px-3 py-2 text-sm">
          {{ error }}
        </div>
        <div v-if="!hasEditableSourceCalendars && eventSourceCalendars.length > 0" class="bg-info/10 text-info rounded-md px-3 py-2 text-sm">
          This event cannot be edited. No connected calendars allow edits for this event.
        </div>
        <div v-if="hasEditableSourceCalendars && editableSourceCalendars.length < eventSourceCalendars.length" class="bg-info/10 text-info rounded-md px-3 py-2 text-sm">
          This event can be edited. {{ editableSourceCalendars.length }} of {{ eventSourceCalendars.length }} connected calendars support editing.
        </div>
        <div v-if="showCalendarPicker" class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Calendar</label>
          <USelect
            :items="calendarPickerOptions"
            option-attribute="label"
            value-attribute="value"
            placeholder="Select calendar"
            class="w-full"
            :model-value="selectedIntegrationId || undefined"
            @update:model-value="selectedIntegrationId = $event || null"
          />
          <USelect
            v-if="selectedIntegrationConfig?.supportsSelectCalendars && integrationCalendarOptions.length > 0"
            :items="integrationCalendarOptions"
            option-attribute="label"
            value-attribute="value"
            placeholder="Select specific calendar"
            class="w-full mt-2"
            :model-value="selectedCalendarId || undefined"
            @update:model-value="selectedCalendarId = $event || null"
          />
        </div>
        <div v-if="calendarAccordionItems.length" class="space-y-2">
          <UAccordion :items="calendarAccordionItems">
            <template #body>
              <div class="space-y-1">
                <div
                  v-for="calendar in enrichedSourceCalendars"
                  :key="`${calendar.integrationId}-${calendar.calendarId}`"
                  class="flex items-center justify-between rounded-md border border-default px-3 py-2 text-sm"
                >
                  <div class="flex items-center gap-2 flex-1 min-w-0">
                    <template v-if="supportsUserSelection(calendar) && calendar.eventUsers && calendar.eventUsers.length > 1">
                      <UAvatarGroup size="sm">
                        <UAvatar
                          v-for="user in calendar.eventUsers"
                          :key="user.id"
                          :src="user.avatar || undefined"
                          :alt="user.name || ''"
                          size="sm"
                          :ui="{
                            root: user.avatar ? '' : 'ring-0 border-0 shadow-none',
                            image: 'object-cover',
                            fallback: user.avatar ? '' : 'ring-0 border-0 shadow-none',
                          }"
                          :style="user.avatar ? undefined : { backgroundColor: user.color || calendar.displayColor }"
                        >
                          <template v-if="!user.avatar" #fallback>
                            <UIcon name="i-lucide-user" class="h-4 w-4" />
                          </template>
                        </UAvatar>
                      </UAvatarGroup>
                    </template>
                    <template v-else-if="supportsUserSelection(calendar) && calendar.eventUsers && calendar.eventUsers.length === 1 && calendar.eventUsers[0]">
                      <UAvatar
                        :src="calendar.eventUsers[0]?.avatar || undefined"
                        :alt="calendar.eventUsers[0]?.name || ''"
                        size="sm"
                        :ui="{
                          root: calendar.eventUsers[0]?.avatar ? '' : 'ring-0 border-0 shadow-none',
                          image: 'object-cover',
                          fallback: calendar.eventUsers[0]?.avatar ? '' : 'ring-0 border-0 shadow-none',
                        }"
                        :style="calendar.eventUsers[0]?.avatar ? undefined : { backgroundColor: calendar.eventUsers[0]?.color || calendar.displayColor }"
                      >
                        <template v-if="!calendar.eventUsers[0]?.avatar" #fallback>
                          <UIcon name="i-lucide-user" class="h-4 w-4" />
                        </template>
                      </UAvatar>
                    </template>
                    <UAvatar
                      v-else
                      :src="calendar.user?.avatar || undefined"
                      :alt="calendar.user?.name || ''"
                      size="sm"
                      :ui="{
                        root: calendar.user ? '' : 'ring-0 border-0 shadow-none',
                        image: 'object-cover',
                        fallback: calendar.user ? '' : 'ring-0 border-0 shadow-none',
                      }"
                      :style="calendar.user ? undefined : { backgroundColor: calendar.displayColor }"
                    >
                      <template v-if="!calendar.user" #fallback>
                        <UIcon name="i-lucide-calendar" class="h-4 w-4" />
                      </template>
                    </UAvatar>
                    <span class="truncate">
                      {{ calendar.calendarName }}
                    </span>
                  </div>
                  <UButton
                    :icon="calendar.canEdit ? 'i-lucide-pencil' : 'i-lucide-pencil-off'"
                    :color="calendar.canEdit && selectedEditableCalendars.has(`${calendar.integrationId}-${calendar.calendarId}`) ? 'primary' : 'neutral'"
                    variant="ghost"
                    size="sm"
                    :disabled="!calendar.canEdit"
                    :aria-label="calendar.canEdit ? (selectedEditableCalendars.has(`${calendar.integrationId}-${calendar.calendarId}`) ? 'Deselect calendar for editing' : 'Select calendar for editing') : 'Read only calendar'"
                    @click="calendar.canEdit && toggleCalendarSelection(calendar)"
                  />
                </div>
              </div>
            </template>
          </UAccordion>
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
            <div v-if="showLockedUserMessage" class="bg-info/10 text-info rounded-md px-3 py-2 text-sm mb-2">
              Users for this event are based on integration settings and can be changed in the <NuxtLink to="/settings" class="text-primary">
                settings
                page
              </NuxtLink>.
            </div>
            <div v-if="showMixedUserMessage" class="bg-info/10 text-info rounded-md px-3 py-2 text-sm mb-2">
              User selection only affects supported calendars. Other calendars users are based on integration settings and can be changed in the <NuxtLink to="/settings" class="text-primary">
                settings
                page
              </NuxtLink>.
            </div>
            <div class="flex flex-wrap gap-2">
              <UButton
                v-for="user in users"
                :key="user.id"
                variant="ghost"
                size="sm"
                class="p-1"
                :class="selectedUsers.includes(user.id) ? 'ring-2 ring-primary-500' : ''"
                :disabled="isReadOnly || !allowsUserSelection"
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
        <UButton
          v-if="event?.id && canDelete && !isReadOnly"
          color="error"
          variant="ghost"
          icon="i-lucide-trash"
          @click="handleDelete"
        >
          Delete
        </UButton>
        <div class="flex gap-2" :class="{ 'ml-auto': !event?.id || !canDelete || isReadOnly }">
          <UButton
            color="neutral"
            variant="ghost"
            @click="emit('close')"
          >
            Cancel
          </UButton>
          <UButton
            v-if="!isReadOnly"
            color="primary"
            @click="handleSave"
          >
            Save
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
