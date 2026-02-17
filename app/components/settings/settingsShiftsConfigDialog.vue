<script setup lang="ts">
import type { CalendarDate, DateValue } from "@internationalized/date";

import { getLocalTimeZone, parseDate } from "@internationalized/date";
import { isBefore } from "date-fns";

import type { Integration } from "~/types/database";

import { getDefaultDateToday } from "~/composables/useRecurrence";
import { useSyncManager } from "~/composables/useSyncManager";
import { useTimePicker } from "~/composables/useTimePicker";

const props = defineProps<{
  integration: Integration | null;
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const {
  convert12To24,
  convert24To12,
  addMinutes,
  subtractMinutes,
  isSameTime,
} = useTimePicker();

function parseTimeToMinutes(timeStr: string): number {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match)
    return 0;
  const hours = Number.parseInt(match[1]!, 10);
  const minutes = Number.parseInt(match[2]!, 10);
  return hours * 60 + minutes;
}

type ShiftTemplateSlot = {
  weekIndex: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  label?: string | null;
  defaultPreset?: string;
};

type ShiftTemplate = {
  id: string;
  label: string;
  description?: string;
  cycleWeeks?: number;
  slots?: ShiftTemplateSlot[];
};

const SHIFT_TEMPLATES: ShiftTemplate[] = [
  {
    id: "2-2-2",
    label: "2-2-2",
    description: "2 on, 2 on, 2 off",
    cycleWeeks: 2,
    slots: [
      { weekIndex: 0, dayOfWeek: 1, startTime: "08:00", endTime: "13:00", defaultPreset: "morning" },
      { weekIndex: 0, dayOfWeek: 2, startTime: "08:00", endTime: "13:00", defaultPreset: "morning" },
      { weekIndex: 0, dayOfWeek: 3, startTime: "13:00", endTime: "17:00", defaultPreset: "evening" },
      { weekIndex: 0, dayOfWeek: 4, startTime: "13:00", endTime: "17:00", defaultPreset: "evening" },
      { weekIndex: 0, dayOfWeek: 5, startTime: "19:00", endTime: "07:00", defaultPreset: "night" },
      { weekIndex: 0, dayOfWeek: 6, startTime: "19:00", endTime: "07:00", defaultPreset: "night" },
      { weekIndex: 1, dayOfWeek: 0, startTime: "07:00", endTime: "19:00", defaultPreset: "no-shift" },
      { weekIndex: 1, dayOfWeek: 1, startTime: "07:00", endTime: "19:00", defaultPreset: "no-shift" },
    ],
  },
  {
    id: "dupont",
    label: "DuPont",
    description: "4-week, 2 shift types (Days/Nights)",
    cycleWeeks: 4,
    slots: [
      { weekIndex: 0, dayOfWeek: 1, startTime: "19:00", endTime: "07:00", label: "Night", defaultPreset: "night" },
      { weekIndex: 0, dayOfWeek: 2, startTime: "19:00", endTime: "07:00", label: "Night", defaultPreset: "night" },
      { weekIndex: 0, dayOfWeek: 3, startTime: "19:00", endTime: "07:00", label: "Night", defaultPreset: "night" },
      { weekIndex: 0, dayOfWeek: 4, startTime: "19:00", endTime: "07:00", label: "Night", defaultPreset: "night" },
      { weekIndex: 1, dayOfWeek: 1, startTime: "09:00", endTime: "17:00", label: "Day", defaultPreset: "day-9-17" },
      { weekIndex: 1, dayOfWeek: 2, startTime: "09:00", endTime: "17:00", label: "Day", defaultPreset: "day-9-17" },
      { weekIndex: 1, dayOfWeek: 3, startTime: "09:00", endTime: "17:00", label: "Day", defaultPreset: "day-9-17" },
      { weekIndex: 2, dayOfWeek: 5, startTime: "19:00", endTime: "07:00", label: "Night", defaultPreset: "night" },
      { weekIndex: 2, dayOfWeek: 6, startTime: "19:00", endTime: "07:00", label: "Night", defaultPreset: "night" },
      { weekIndex: 3, dayOfWeek: 2, startTime: "09:00", endTime: "17:00", label: "Day", defaultPreset: "day-9-17" },
      { weekIndex: 3, dayOfWeek: 3, startTime: "09:00", endTime: "17:00", label: "Day", defaultPreset: "day-9-17" },
    ],
  },
  {
    id: "4-on-4-off",
    label: "4 on 4 off",
    description: "4 Days, 4 OFF, 4 Nights, 4 OFF",
    cycleWeeks: 3,
    slots: [
      { weekIndex: 0, dayOfWeek: 1, startTime: "09:00", endTime: "17:00", defaultPreset: "day-9-17" },
      { weekIndex: 0, dayOfWeek: 2, startTime: "09:00", endTime: "17:00", defaultPreset: "day-9-17" },
      { weekIndex: 0, dayOfWeek: 3, startTime: "09:00", endTime: "17:00", defaultPreset: "day-9-17" },
      { weekIndex: 0, dayOfWeek: 4, startTime: "09:00", endTime: "17:00", defaultPreset: "day-9-17" },
      { weekIndex: 0, dayOfWeek: 5, startTime: "07:00", endTime: "19:00", defaultPreset: "no-shift" },
      { weekIndex: 0, dayOfWeek: 6, startTime: "07:00", endTime: "19:00", defaultPreset: "no-shift" },
      { weekIndex: 0, dayOfWeek: 0, startTime: "07:00", endTime: "19:00", defaultPreset: "no-shift" },
      { weekIndex: 1, dayOfWeek: 1, startTime: "07:00", endTime: "19:00", defaultPreset: "no-shift" },
      { weekIndex: 1, dayOfWeek: 2, startTime: "19:00", endTime: "07:00", defaultPreset: "night" },
      { weekIndex: 1, dayOfWeek: 3, startTime: "19:00", endTime: "07:00", defaultPreset: "night" },
      { weekIndex: 1, dayOfWeek: 4, startTime: "19:00", endTime: "07:00", defaultPreset: "night" },
      { weekIndex: 1, dayOfWeek: 5, startTime: "19:00", endTime: "07:00", defaultPreset: "night" },
      { weekIndex: 1, dayOfWeek: 6, startTime: "07:00", endTime: "19:00", defaultPreset: "no-shift" },
      { weekIndex: 1, dayOfWeek: 0, startTime: "07:00", endTime: "19:00", defaultPreset: "no-shift" },
      { weekIndex: 2, dayOfWeek: 1, startTime: "07:00", endTime: "19:00", defaultPreset: "no-shift" },
      { weekIndex: 2, dayOfWeek: 2, startTime: "07:00", endTime: "19:00", defaultPreset: "no-shift" },
    ],
  },
  {
    id: "12h-days",
    label: "12-hour days",
    description: "Mon–Fri 12h day shift",
    cycleWeeks: 1,
    slots: [
      { weekIndex: 0, dayOfWeek: 1, startTime: "07:00", endTime: "19:00" },
      { weekIndex: 0, dayOfWeek: 2, startTime: "07:00", endTime: "19:00" },
      { weekIndex: 0, dayOfWeek: 3, startTime: "07:00", endTime: "19:00" },
      { weekIndex: 0, dayOfWeek: 4, startTime: "07:00", endTime: "19:00" },
      { weekIndex: 0, dayOfWeek: 5, startTime: "07:00", endTime: "19:00" },
    ],
  },
  {
    id: "2-2-4",
    label: "2-2-4",
    description: "2 Days, 2 Nights, 4 OFF",
    cycleWeeks: 2,
    slots: [
      { weekIndex: 0, dayOfWeek: 1, startTime: "09:00", endTime: "17:00", defaultPreset: "day-9-17" },
      { weekIndex: 0, dayOfWeek: 2, startTime: "09:00", endTime: "17:00", defaultPreset: "day-9-17" },
      { weekIndex: 0, dayOfWeek: 3, startTime: "19:00", endTime: "07:00", defaultPreset: "night" },
      { weekIndex: 0, dayOfWeek: 4, startTime: "19:00", endTime: "07:00", defaultPreset: "night" },
      { weekIndex: 0, dayOfWeek: 5, startTime: "07:00", endTime: "19:00", defaultPreset: "no-shift" },
      { weekIndex: 0, dayOfWeek: 6, startTime: "07:00", endTime: "19:00", defaultPreset: "no-shift" },
      { weekIndex: 1, dayOfWeek: 0, startTime: "07:00", endTime: "19:00", defaultPreset: "no-shift" },
      { weekIndex: 1, dayOfWeek: 1, startTime: "07:00", endTime: "19:00", defaultPreset: "no-shift" },
    ],
  },
  {
    id: "4-on-3-off",
    label: "4 on 3 off",
    description: "4 working days then 3 off",
    cycleWeeks: 2,
    slots: [
      { weekIndex: 0, dayOfWeek: 1, startTime: "07:00", endTime: "19:00" },
      { weekIndex: 0, dayOfWeek: 2, startTime: "07:00", endTime: "19:00" },
      { weekIndex: 0, dayOfWeek: 3, startTime: "07:00", endTime: "19:00" },
      { weekIndex: 0, dayOfWeek: 4, startTime: "07:00", endTime: "19:00" },
    ],
  },
  {
    id: "3-on-3-off",
    label: "3 on 3 off",
    description: "3 working days then 3 off",
    cycleWeeks: 2,
    slots: [
      { weekIndex: 0, dayOfWeek: 1, startTime: "07:00", endTime: "19:00" },
      { weekIndex: 0, dayOfWeek: 2, startTime: "07:00", endTime: "19:00" },
      { weekIndex: 0, dayOfWeek: 3, startTime: "07:00", endTime: "19:00" },
      { weekIndex: 1, dayOfWeek: 0, startTime: "07:00", endTime: "19:00" },
      { weekIndex: 1, dayOfWeek: 1, startTime: "07:00", endTime: "19:00" },
      { weekIndex: 1, dayOfWeek: 2, startTime: "07:00", endTime: "19:00" },
    ],
  },
  {
    id: "continental-2-2-3",
    label: "Continental 2-2-3",
    description: "2 on, 2 off, 3 on (2-week)",
    cycleWeeks: 2,
    slots: [
      { weekIndex: 0, dayOfWeek: 1, startTime: "07:00", endTime: "19:00" },
      { weekIndex: 0, dayOfWeek: 2, startTime: "07:00", endTime: "19:00" },
      { weekIndex: 0, dayOfWeek: 5, startTime: "07:00", endTime: "19:00" },
      { weekIndex: 0, dayOfWeek: 6, startTime: "07:00", endTime: "19:00" },
      { weekIndex: 0, dayOfWeek: 0, startTime: "07:00", endTime: "19:00" },
      { weekIndex: 1, dayOfWeek: 3, startTime: "07:00", endTime: "19:00" },
      { weekIndex: 1, dayOfWeek: 4, startTime: "07:00", endTime: "19:00" },
    ],
  },
  {
    id: "7-on-7-off",
    label: "7 on 7 off",
    description: "7 days on then 7 off",
    cycleWeeks: 2,
    slots: [
      { weekIndex: 0, dayOfWeek: 0, startTime: "07:00", endTime: "19:00" },
      { weekIndex: 0, dayOfWeek: 1, startTime: "07:00", endTime: "19:00" },
      { weekIndex: 0, dayOfWeek: 2, startTime: "07:00", endTime: "19:00" },
      { weekIndex: 0, dayOfWeek: 3, startTime: "07:00", endTime: "19:00" },
      { weekIndex: 0, dayOfWeek: 4, startTime: "07:00", endTime: "19:00" },
      { weekIndex: 0, dayOfWeek: 5, startTime: "07:00", endTime: "19:00" },
      { weekIndex: 0, dayOfWeek: 6, startTime: "07:00", endTime: "19:00" },
    ],
  },
  {
    id: "nights-only",
    label: "Nights only",
    description: "Mon–Fri night shift",
    cycleWeeks: 1,
    slots: [
      { weekIndex: 0, dayOfWeek: 1, startTime: "19:00", endTime: "07:00", label: "Night" },
      { weekIndex: 0, dayOfWeek: 2, startTime: "19:00", endTime: "07:00", label: "Night" },
      { weekIndex: 0, dayOfWeek: 3, startTime: "19:00", endTime: "07:00", label: "Night" },
      { weekIndex: 0, dayOfWeek: 4, startTime: "19:00", endTime: "07:00", label: "Night" },
      { weekIndex: 0, dayOfWeek: 5, startTime: "19:00", endTime: "07:00", label: "Night" },
    ],
  },
  {
    id: "2-on-2-off",
    label: "2 on 2 off",
    description: "2 days on, 2 off, repeating",
    cycleWeeks: 2,
    slots: [
      { weekIndex: 0, dayOfWeek: 1, startTime: "07:00", endTime: "19:00" },
      { weekIndex: 0, dayOfWeek: 2, startTime: "07:00", endTime: "19:00" },
      { weekIndex: 0, dayOfWeek: 4, startTime: "07:00", endTime: "19:00" },
      { weekIndex: 0, dayOfWeek: 5, startTime: "07:00", endTime: "19:00" },
      { weekIndex: 1, dayOfWeek: 0, startTime: "07:00", endTime: "19:00" },
      { weekIndex: 1, dayOfWeek: 1, startTime: "07:00", endTime: "19:00" },
      { weekIndex: 1, dayOfWeek: 3, startTime: "07:00", endTime: "19:00" },
      { weekIndex: 1, dayOfWeek: 4, startTime: "07:00", endTime: "19:00" },
    ],
  },
  {
    id: "days-nights-off",
    label: "Days/Nights/Off",
    description: "4 days, 4 nights, 4 off",
    cycleWeeks: 2,
  },
  { id: "on-off", label: "On/Off", description: "N days on, M days off – any combination" },
  { id: "custom", label: "Custom", description: "Build your own pattern" },
];

type ShiftIntervalPreset = {
  value: string;
  label: string;
  startTime: string | null;
  endTime: string | null;
};

const SHIFT_INTERVAL_PRESETS: ShiftIntervalPreset[] = [
  { value: "day", label: "Day (7-7)", startTime: "07:00", endTime: "19:00" },
  { value: "day-9-17", label: "Days (9-5)", startTime: "09:00", endTime: "17:00" },
  { value: "nights-7-5", label: "Nights (7-5)", startTime: "19:00", endTime: "05:00" },
  { value: "early", label: "Early (5-1)", startTime: "05:00", endTime: "01:00" },
  { value: "late", label: "Late (12-8)", startTime: "12:00", endTime: "20:00" },
  { value: "midday", label: "Midday (11-3)", startTime: "11:00", endTime: "15:00" },
  { value: "night", label: "Night (7-7)", startTime: "19:00", endTime: "07:00" },
  { value: "morning", label: "Morning (8-1)", startTime: "08:00", endTime: "13:00" },
  { value: "evening", label: "Evening (1-5)", startTime: "13:00", endTime: "17:00" },
  { value: "am", label: "AM (6-2)", startTime: "06:00", endTime: "14:00" },
  { value: "long-day", label: "Long Day (7-9)", startTime: "07:00", endTime: "21:00" },
  { value: "no-shift", label: "No shift", startTime: null, endTime: null },
  { value: "custom", label: "Custom", startTime: null, endTime: null },
];

type PatternSegment = {
  label: string;
  count: number;
  preset: string;
};

const SEGMENT_DEFAULTS: Record<string, PatternSegment[]> = {
  "4-on-3-off": [
    { label: "Shift 1", count: 4, preset: "day" },
    { label: "OFF", count: 3, preset: "no-shift" },
  ],
  "2-2-2": [
    { label: "Shift 1", count: 2, preset: "morning" },
    { label: "Shift 2", count: 2, preset: "evening" },
    { label: "Shift 3", count: 2, preset: "nights-7-5" },
    { label: "OFF", count: 2, preset: "no-shift" },
  ],
  "on-off": [
    { label: "Shift 1", count: 4, preset: "day" },
    { label: "OFF", count: 4, preset: "no-shift" },
  ],
  "2-2-4": [
    { label: "Shift 1", count: 2, preset: "day-9-17" },
    { label: "Shift 2", count: 2, preset: "nights-7-5" },
    { label: "OFF", count: 4, preset: "no-shift" },
  ],
  "4-on-4-off": [
    { label: "Shift 1", count: 4, preset: "day-9-17" },
    { label: "OFF", count: 4, preset: "no-shift" },
    { label: "Shift 2", count: 4, preset: "nights-7-5" },
    { label: "OFF", count: 4, preset: "no-shift" },
  ],
  "7-on-7-off": [
    { label: "Shift 1", count: 7, preset: "day" },
    { label: "OFF", count: 7, preset: "no-shift" },
  ],
  "days-nights-off": [
    { label: "Shift 1", count: 4, preset: "day-9-17" },
    { label: "Shift 2", count: 4, preset: "nights-7-5" },
    { label: "OFF", count: 4, preset: "no-shift" },
  ],
  "3-on-3-off": [
    { label: "Shift 1", count: 3, preset: "day" },
    { label: "OFF", count: 3, preset: "no-shift" },
  ],
  "2-on-2-off": [
    { label: "Shift 1", count: 2, preset: "day" },
    { label: "OFF", count: 2, preset: "no-shift" },
  ],
  "12h-days": [
    { label: "Shift 1", count: 5, preset: "day" },
  ],
  "nights-only": [
    { label: "Shift 1", count: 5, preset: "night" },
  ],
  "dupont": [
    { label: "Shift 1", count: 4, preset: "night" },
    { label: "OFF", count: 4, preset: "no-shift" },
    { label: "Shift 3", count: 3, preset: "day-9-17" },
    { label: "OFF", count: 3, preset: "no-shift" },
    { label: "Shift 5", count: 2, preset: "night" },
    { label: "OFF", count: 2, preset: "no-shift" },
    { label: "Shift 7", count: 2, preset: "day-9-17" },
    { label: "OFF", count: 2, preset: "no-shift" },
  ],
  "custom": [
    { label: "Shift 1", count: 1, preset: "day-9-17" },
  ],
};

const customSegmentTimes = ref<Record<number, {
  startHour: number;
  startMinute: number;
  startAmPm: string;
  endHour: number;
  endMinute: number;
  endAmPm: string;
}>>({});

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
    options.push({ value: minute, label: minute.toString().padStart(2, "0") });
  }
  return options;
});

const amPmOptions = [
  { value: "AM", label: "AM" },
  { value: "PM", label: "PM" },
];

function getPresetTimes(presetValue: string, segmentIndex?: number): { startTime: string; endTime: string } | null {
  if (presetValue === "custom" && segmentIndex !== undefined) {
    const customTimes = customSegmentTimes.value[segmentIndex];
    if (!customTimes)
      return null;
    const startHour24 = convert12To24(customTimes.startHour, customTimes.startAmPm);
    const endHour24 = convert12To24(customTimes.endHour, customTimes.endAmPm);
    const startTime = `${startHour24.toString().padStart(2, "0")}:${customTimes.startMinute.toString().padStart(2, "0")}`;
    const endTime = `${endHour24.toString().padStart(2, "0")}:${customTimes.endMinute.toString().padStart(2, "0")}`;
    return { startTime, endTime };
  }
  const preset = SHIFT_INTERVAL_PRESETS.find(p => p.value === presetValue);
  if (!preset?.startTime || !preset.endTime)
    return null;
  return { startTime: preset.startTime, endTime: preset.endTime };
}

const { triggerImmediateSync } = useSyncManager();

const integrationOwnerUserId = computed(() => {
  const user = props.integration?.settings as { user?: string[] } | undefined;
  return user?.user?.[0];
});

const templateSelectItems = computed(() =>
  SHIFT_TEMPLATES.map(t => ({ label: t.label, value: t.id })),
);

const selectedTemplateId = ref("");

const selectedTemplate = computed(() =>
  SHIFT_TEMPLATES.find(t => t.id === selectedTemplateId.value) ?? null,
);

const editingAssignmentId = ref<string | null>(null);
const formStartDate = ref<DateValue>(getDefaultDateToday() as DateValue);
const formEndDate = ref<DateValue | null>(null);

const rotations = ref<Array<{
  id: string;
  name: string;
  cycleWeeks: number;
  color: string | null;
  order: number;
  _count?: { slots: number; assignments: number };
}>>([]);
const assignments = ref<Array<{
  id: string;
  userId: string;
  shiftRotationId: string;
  startDate: string;
  endDate: string | null;
  user: { id: string; name: string; avatar: string | null; color: string | null };
  shiftRotation: { id: string; name: string; cycleWeeks: number; color: string | null };
}>>([]);
const loading = ref(false);
const error = ref<string | null>(null);

async function fetchRotations() {
  if (!props.integration?.id)
    return;
  try {
    const data = await $fetch(`/api/integrations/${props.integration.id}/shifts/rotations`);
    rotations.value = data as typeof rotations.value;
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to load rotations";
  }
}

async function fetchAssignments() {
  if (!props.integration?.id)
    return;
  try {
    const data = await $fetch(`/api/integrations/${props.integration.id}/shifts/assignments`);
    assignments.value = data as typeof assignments.value;
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to load assignments";
  }
}

watch(
  () => [props.isOpen, props.integration?.id],
  async ([isOpen, id]) => {
    if (isOpen && id) {
      loading.value = true;
      error.value = null;
      await Promise.all([fetchRotations(), fetchAssignments()]);
      loading.value = false;
    }
  },
);

const newRotationName = ref("");
const newRotationCycleWeeks = ref(2);
const newRotationColor = ref("#06b6d4");
const onOffOnDays = ref(4);
const onOffOffDays = ref(4);

const editableSegments = ref<PatternSegment[]>([]);

const isSegmentBasedTemplate = computed(() => {
  const id = selectedTemplateId.value;
  return id !== "" && id in SEGMENT_DEFAULTS;
});

const formStartDateValue = computed(() => formStartDate.value as DateValue | null);

const formEndDateValue = computed(() => formEndDate.value as DateValue | null);

const slotPresetSelectItems = computed(() =>
  SHIFT_INTERVAL_PRESETS.filter(p => p.value !== "no-shift").map(p => ({ label: p.label, value: p.value })),
);

const slotPresetSelectItemsWithOff = computed(() =>
  SHIFT_INTERVAL_PRESETS.map(p => ({ label: p.label, value: p.value })),
);

const shiftStartHour = ref(7);
const shiftStartMinute = ref(0);
const shiftStartAmPm = ref("AM");
const shiftEndHour = ref(7);
const shiftEndMinute = ref(0);
const shiftEndAmPm = ref("PM");
const shiftDurationMinutes = ref(12 * 60);
let isUpdatingShiftTime = false;

const showShiftTimeInputs = computed(() => {
  if (editingAssignmentId.value)
    return false;
  if (isSegmentBasedTemplate.value)
    return false;
  const id = selectedTemplateId.value;
  return id && id !== "dupont" && id !== "custom";
});

function initEditableSegments() {
  const id = selectedTemplateId.value;
  const defaults = SEGMENT_DEFAULTS[id];
  editableSegments.value = defaults ? defaults.map(s => ({ ...s })) : [];
  const newCustomTimes: typeof customSegmentTimes.value = {};
  editableSegments.value.forEach((seg, idx) => {
    if (seg.preset === "custom" && !customSegmentTimes.value[idx]) {
      newCustomTimes[idx] = {
        startHour: 9,
        startMinute: 0,
        startAmPm: "AM",
        endHour: 5,
        endMinute: 0,
        endAmPm: "PM",
      };
    }
    else if (customSegmentTimes.value[idx]) {
      newCustomTimes[idx] = customSegmentTimes.value[idx]!;
    }
  });
  customSegmentTimes.value = newCustomTimes;
}

type EditableSlotGroup = { index: number; weekIndex: number; dayOfWeek: number };

const editableSlotGroups = computed((): EditableSlotGroup[] => {
  if (isSegmentBasedTemplate.value || !showShiftTimeInputs.value)
    return [];
  const template = selectedTemplate.value;
  const slots = template?.slots;
  if (!slots?.length)
    return [];
  return slots.map((s, i) => ({ index: i, weekIndex: s.weekIndex, dayOfWeek: s.dayOfWeek }));
});

const totalSegmentDays = computed(() =>
  editableSegments.value.reduce((sum, s) => sum + Math.max(1, Math.min(99, s.count)), 0),
);

const effectiveCycleWeeks = computed(() => {
  if (isSegmentBasedTemplate.value)
    return Math.max(1, Math.ceil(totalSegmentDays.value / 7));
  return selectedTemplate.value?.cycleWeeks ?? 1;
});

const preferredStartDay = computed<number | null>(() => {
  const id = selectedTemplateId.value;
  if (id === "dupont" || id === "custom" || !id)
    return null;
  if (isSegmentBasedTemplate.value) {
    if (id === "7-on-7-off")
      return 0;
    return 1;
  }
  if (id === "7-on-7-off")
    return 0;
  const slots = selectedTemplate.value?.slots;
  if (!slots?.length)
    return null;
  return Math.min(...slots.map(s => s.dayOfWeek));
});

const startDateIsDisabled = computed(() => {
  const pref = preferredStartDay.value;
  if (pref === null)
    return undefined;
  return (date: DateValue) => date.toDate(getLocalTimeZone()).getDay() !== pref;
});

function onStartDateSelect(value: DateValue | null) {
  if (!value)
    return;
  const pref = preferredStartDay.value;
  formStartDate.value = pref !== null ? roundToPreferredStartDay(value, pref) : value;
}

function roundToPreferredStartDay(date: DateValue, preferredDay: number): DateValue {
  const d = date as CalendarDate;
  const currentDayOfWeek = d.toDate(getLocalTimeZone()).getDay();
  const daysBack = (currentDayOfWeek - preferredDay + 7) % 7;
  return d.add({ days: -daysBack });
}

function getSlotDate(startDate: DateValue, g: EditableSlotGroup): DateValue {
  const d = startDate as CalendarDate;
  const firstDay = d.add({ days: g.weekIndex * 7 });
  const firstDayOfWeek = firstDay.toDate(getLocalTimeZone()).getDay();
  const dayOffset = (g.dayOfWeek - firstDayOfWeek + 7) % 7;
  return firstDay.add({ days: dayOffset });
}

function formatSlotDate(slotDate: DateValue): string {
  const d = slotDate.toDate(getLocalTimeZone());
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).replace(", ", " ");
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getSlotLabel(
  g: EditableSlotGroup,
  groups: EditableSlotGroup[],
  startDate: DateValue | null,
  cycleWeeks: number,
): string {
  const dayName = DAY_LABELS[g.dayOfWeek] ?? `Day ${g.index + 1}`;
  let base: string;
  if (startDate) {
    const slotDate = getSlotDate(startDate, g);
    base = formatSlotDate(slotDate);
  }
  else {
    base = dayName;
  }
  if (cycleWeeks > 1)
    return `${base} (W${g.weekIndex + 1})`;
  return base;
}

const slotPresets = ref<Record<number, string>>({});

function setSlotPreset(index: number, value: string) {
  slotPresets.value = { ...slotPresets.value, [index]: value };
}

function initSlotPresets() {
  const groups = editableSlotGroups.value;
  const id = selectedTemplateId.value;
  const templateDefault = id === "nights-only" ? "night" : "day";
  const template = selectedTemplate.value;
  const templateSlots = template?.slots;
  const next: Record<number, string> = {};
  for (const g of groups) {
    const slot = templateSlots?.[g.index];
    const slotDefault = slot?.defaultPreset ?? templateDefault;
    next[g.index] = slotPresets.value[g.index] ?? slotDefault;
  }
  slotPresets.value = next;
}

function buildSlotsFromPresets(
  groups: EditableSlotGroup[],
  presets: Record<number, string>,
): ShiftTemplateSlot[] {
  const slots: ShiftTemplateSlot[] = [];
  for (const g of groups) {
    const presetValue = presets[g.index] ?? "day";
    if (presetValue === "no-shift")
      continue;
    const times = getPresetTimes(presetValue);
    if (!times)
      continue;
    const preset = SHIFT_INTERVAL_PRESETS.find(p => p.value === presetValue);
    slots.push({
      weekIndex: g.weekIndex,
      dayOfWeek: g.dayOfWeek,
      startTime: times.startTime,
      endTime: times.endTime,
      label: preset?.label !== "Day (12h)" ? preset?.label ?? undefined : undefined,
    });
  }
  return slots;
}

function segmentsToSlots(segments: PatternSegment[], startDate: DateValue): ShiftTemplateSlot[] {
  const slots: ShiftTemplateSlot[] = [];
  let dayIndex = 0;
  const d0 = startDate as CalendarDate;
  let segmentIndex = 0;
  for (const seg of segments) {
    const count = Math.max(1, Math.min(99, seg.count));
    for (let i = 0; i < count; i++) {
      const weekIndex = Math.floor(dayIndex / 7);
      const dateAt = d0.add({ days: dayIndex });
      const dayOfWeek = dateAt.toDate(getLocalTimeZone()).getDay();
      if (seg.preset !== "no-shift") {
        const times = getPresetTimes(seg.preset, segmentIndex);
        if (times) {
          const preset = SHIFT_INTERVAL_PRESETS.find(p => p.value === seg.preset);
          slots.push({
            weekIndex,
            dayOfWeek,
            startTime: times.startTime,
            endTime: times.endTime,
            label: preset?.label !== "Day (12h)" && preset?.value !== "custom" ? preset?.label ?? undefined : undefined,
          });
        }
      }
      dayIndex++;
    }
    segmentIndex++;
  }
  return slots;
}

const DUPONT_SLOT_INDEX_TO_SEGMENT_INDEX = [0, 0, 0, 0, 2, 2, 2, 4, 4, 6, 6];

function dupontSegmentsToSlots(
  segments: PatternSegment[],
  templateSlots: ShiftTemplateSlot[],
): ShiftTemplateSlot[] {
  const slots: ShiftTemplateSlot[] = [];
  for (let slotIdx = 0; slotIdx < templateSlots.length; slotIdx++) {
    const originalSlot = templateSlots[slotIdx];
    if (!originalSlot)
      continue;
    const segIdx = DUPONT_SLOT_INDEX_TO_SEGMENT_INDEX[slotIdx] ?? 0;
    const seg = segments[segIdx];
    if (!seg || seg.preset === "no-shift")
      continue;
    const times = getPresetTimes(seg.preset, segIdx);
    if (!times)
      continue;
    const preset = SHIFT_INTERVAL_PRESETS.find(p => p.value === seg.preset);
    slots.push({
      weekIndex: originalSlot.weekIndex,
      dayOfWeek: originalSlot.dayOfWeek,
      startTime: times.startTime,
      endTime: times.endTime,
      label: preset?.label !== "Day (12h)" && preset?.value !== "custom" ? preset?.label ?? undefined : originalSlot.label ?? undefined,
    });
  }
  return slots;
}

function updateSegmentCount(index: number, value: number | string) {
  const count = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(count))
    return;
  const next = [...editableSegments.value];
  if (next[index])
    next[index] = { ...next[index]!, count: Math.max(1, Math.min(99, count)) };
  editableSegments.value = next;
}

function updateSegmentPreset(index: number, preset: string) {
  const next = [...editableSegments.value];
  if (next[index])
    next[index] = { ...next[index]!, preset };
  editableSegments.value = next;
  if (preset === "custom" && !customSegmentTimes.value[index]) {
    customSegmentTimes.value = {
      ...customSegmentTimes.value,
      [index]: {
        startHour: 9,
        startMinute: 0,
        startAmPm: "AM",
        endHour: 5,
        endMinute: 0,
        endAmPm: "PM",
      },
    };
  }
}

function updateCustomSegmentTime(
  index: number,
  field: "startHour" | "startMinute" | "startAmPm" | "endHour" | "endMinute" | "endAmPm",
  value: number | string,
) {
  const current = customSegmentTimes.value[index];
  if (!current)
    return;
  customSegmentTimes.value = {
    ...customSegmentTimes.value,
    [index]: {
      ...current,
      [field]: value,
    },
  };
}

function addShiftSegment() {
  const shiftCount = editableSegments.value.filter(s => s.preset !== "no-shift").length + 1;
  editableSegments.value = [
    ...editableSegments.value,
    { label: `Shift ${shiftCount}`, count: 1, preset: "day-9-17" },
  ];
}

function addOffSegment() {
  editableSegments.value = [
    ...editableSegments.value,
    { label: "OFF", count: 1, preset: "no-shift" },
  ];
}

function removeSegment(index: number) {
  editableSegments.value = editableSegments.value.filter((_, i) => i !== index);
  const newCustomTimes: typeof customSegmentTimes.value = {};
  editableSegments.value.forEach((_, i) => {
    if (customSegmentTimes.value[i] !== undefined) {
      newCustomTimes[i] = customSegmentTimes.value[i]!;
    }
  });
  customSegmentTimes.value = newCustomTimes;
}

function validateSegments(): string | null {
  if (editableSegments.value.length === 0)
    return "Add at least one segment.";
  if (totalSegmentDays.value < 1)
    return "Total days must be at least 1.";
  for (let i = 0; i < editableSegments.value.length; i++) {
    const s = editableSegments.value[i]!;
    if (s.count < 1 || s.count > 99)
      return "Each segment count must be between 1 and 99.";
    if (s.preset === "custom") {
      const customTimes = customSegmentTimes.value[i];
      if (!customTimes)
        return `Custom times are required for segment "${s.label}".`;
      const startHour24 = convert12To24(customTimes.startHour, customTimes.startAmPm);
      const endHour24 = convert12To24(customTimes.endHour, customTimes.endAmPm);
      if (startHour24 < 0 || startHour24 > 23 || endHour24 < 0 || endHour24 > 23)
        return `Invalid time values for segment "${s.label}".`;
    }
  }
  return null;
}

function parseTimeToForm(timeStr: string): { hour: number; minute: number; amPm: string } {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match)
    return { hour: 7, minute: 0, amPm: "AM" };
  const hour24 = Number.parseInt(match[1]!, 10);
  const minute = Number.parseInt(match[2]!, 10);
  const { hour, amPm } = convert24To12(hour24);
  return { hour, minute, amPm };
}

function closeForm() {
  selectedTemplateId.value = "";
  newRotationName.value = "";
  newRotationCycleWeeks.value = 2;
  newRotationColor.value = "#06b6d4";
  onOffOnDays.value = 4;
  onOffOffDays.value = 4;
  editableSegments.value = [];
  customSegmentTimes.value = {};
  shiftStartHour.value = 7;
  shiftStartMinute.value = 0;
  shiftStartAmPm.value = "AM";
  shiftEndHour.value = 7;
  shiftEndMinute.value = 0;
  shiftEndAmPm.value = "PM";
  slotPresets.value = {};
  formStartDate.value = getDefaultDateToday();
  formEndDate.value = null;
  editingAssignmentId.value = null;
}

function prefillShiftTimes() {
  const id = selectedTemplateId.value;
  if (id === "on-off") {
    initSlotPresets();
    return;
  }
  if (id && id !== "dupont" && id !== "custom") {
    const template = selectedTemplate.value;
    const slot = template?.slots?.[0];
    if (slot) {
      const start = parseTimeToForm(slot.startTime);
      const end = parseTimeToForm(slot.endTime);
      shiftStartHour.value = start.hour;
      shiftStartMinute.value = start.minute;
      shiftStartAmPm.value = start.amPm;
      shiftEndHour.value = end.hour;
      shiftEndMinute.value = end.minute;
      shiftEndAmPm.value = end.amPm;
      const dur = (parseTimeToMinutes(slot.endTime) - parseTimeToMinutes(slot.startTime) + 24 * 60) % (24 * 60);
      shiftDurationMinutes.value = dur > 0 ? dur : 12 * 60;
    }
  }
  initSlotPresets();
}

function updateShiftEndTime() {
  if (!showShiftTimeInputs.value || isUpdatingShiftTime)
    return;
  isUpdatingShiftTime = true;
  const endTime = addMinutes(
    shiftStartHour.value,
    shiftStartMinute.value,
    shiftStartAmPm.value,
    shiftDurationMinutes.value,
  );
  shiftEndHour.value = endTime.hour;
  shiftEndMinute.value = endTime.minute;
  shiftEndAmPm.value = endTime.amPm;
  isUpdatingShiftTime = false;
}

function updateShiftStartTime() {
  if (!showShiftTimeInputs.value || isUpdatingShiftTime)
    return;
  isUpdatingShiftTime = true;
  const startTime = subtractMinutes(
    shiftEndHour.value,
    shiftEndMinute.value,
    shiftEndAmPm.value,
    shiftDurationMinutes.value,
  );
  shiftStartHour.value = startTime.hour;
  shiftStartMinute.value = startTime.minute;
  shiftStartAmPm.value = startTime.amPm;
  isUpdatingShiftTime = false;
}

watch(selectedTemplateId, () => {
  initEditableSegments();
  prefillShiftTimes();
});
watch(selectedTemplateId, () => {
  if (editingAssignmentId.value)
    return;
  const start = formStartDate.value;
  const pref = preferredStartDay.value;
  if (start && pref !== null)
    formStartDate.value = roundToPreferredStartDay(start as DateValue, pref);
});

watch([shiftStartHour, shiftStartMinute, shiftStartAmPm], updateShiftEndTime);
watch([shiftEndHour, shiftEndMinute, shiftEndAmPm], updateShiftStartTime);

function generateUniquePatternName(
  baseName: string,
  existingRotations: { name: string }[],
): string {
  const existingNames = existingRotations.map(r => r.name);
  if (!existingNames.includes(baseName))
    return baseName;
  let counter = 2;
  while (existingNames.includes(`${baseName}${counter}`))
    counter++;
  return `${baseName}${counter}`;
}

const StartHour = 0;
const EndHour = 23;

function validateShiftForm(): string | null {
  if (!formStartDate.value)
    return "Start date is required.";
  if (formEndDate.value) {
    const startDateOnly = new Date(
      formStartDate.value.year,
      formStartDate.value.month - 1,
      formStartDate.value.day,
    );
    const endDateOnly = new Date(
      formEndDate.value.year,
      formEndDate.value.month - 1,
      formEndDate.value.day,
    );
    if (isBefore(endDateOnly, startDateOnly))
      return "End date cannot be before start date";
  }
  return null;
}

function validateShiftTimes(): string | null {
  const startHours24 = convert12To24(
    shiftStartHour.value,
    shiftStartAmPm.value,
  );
  const endHours24 = convert12To24(shiftEndHour.value, shiftEndAmPm.value);
  if (
    startHours24 < StartHour
    || startHours24 > EndHour
    || endHours24 < StartHour
    || endHours24 > EndHour
  ) {
    return `Selected time must be between ${StartHour}:00 and ${EndHour}:00`;
  }
  if (
    isSameTime(
      shiftStartHour.value,
      shiftStartMinute.value,
      shiftStartAmPm.value,
      shiftEndHour.value,
      shiftEndMinute.value,
      shiftEndAmPm.value,
    )
  ) {
    return "Shift start and end time cannot be the same";
  }
  return null;
}

function openEditForm(a: typeof assignments.value[0]) {
  editingAssignmentId.value = a.id;
  selectedTemplateId.value = "";
  newRotationName.value = a.shiftRotation.name;
  newRotationColor.value = a.shiftRotation.color ?? "#06b6d4";
  formStartDate.value = parseDate(new Date(a.startDate).toLocaleDateString("en-CA"));
  formEndDate.value = a.endDate
    ? parseDate(new Date(a.endDate).toLocaleDateString("en-CA"))
    : null;
}

async function saveConfiguredShift() {
  const integrationId = props.integration?.id;
  const userId = integrationOwnerUserId.value;
  if (!integrationId) {
    error.value = "Integration not set.";
    return;
  }
  if (!userId) {
    error.value = "Select a user for this integration in Settings first.";
    return;
  }
  if (!selectedTemplateId.value && !editingAssignmentId.value) {
    error.value = "Select a shift pattern.";
    return;
  }
  const formError = validateShiftForm();
  if (formError) {
    error.value = formError;
    return;
  }
  if (isSegmentBasedTemplate.value) {
    const segmentError = validateSegments();
    if (segmentError) {
      error.value = segmentError;
      return;
    }
  }
  if (showShiftTimeInputs.value && editableSlotGroups.value.length === 0) {
    const timeError = validateShiftTimes();
    if (timeError) {
      error.value = timeError;
      return;
    }
  }
  try {
    error.value = null;
    if (editingAssignmentId.value) {
      const a = assignments.value.find(x => x.id === editingAssignmentId.value);
      if (!a)
        return;
      await $fetch(
        `/api/integrations/${integrationId}/shifts/rotations/${a.shiftRotationId}`,
        {
          method: "PUT",
          body: {
            name: newRotationName.value.trim() || a.shiftRotation.name,
            color: newRotationColor.value,
          },
        },
      );
      const startD = formStartDate.value;
      const endD = formEndDate.value;
      await $fetch(
        `/api/integrations/${integrationId}/shifts/assignments/${a.id}`,
        {
          method: "PUT",
          body: {
            startDate: new Date(Date.UTC(startD.year, startD.month - 1, startD.day, 0, 0, 0, 0)).toISOString(),
            endDate: endD
              ? new Date(Date.UTC(endD.year, endD.month - 1, endD.day, 0, 0, 0, 0)).toISOString()
              : null,
          },
        },
      );
    }
    else {
      const template = selectedTemplate.value;
      const name = newRotationName.value.trim()
        || generateUniquePatternName(
          template?.label ?? "Custom",
          rotations.value,
        );
      let cycleWeeks: number;
      let slots: ShiftTemplateSlot[] | undefined;
      if (selectedTemplateId.value === "dupont") {
        cycleWeeks = template?.cycleWeeks ?? 4;
        const dupontTemplateSlots = template?.slots ?? [];
        slots = dupontTemplateSlots.length > 0
          ? dupontSegmentsToSlots(editableSegments.value, dupontTemplateSlots)
          : undefined;
      }
      else if (isSegmentBasedTemplate.value && formStartDate.value) {
        cycleWeeks = effectiveCycleWeeks.value;
        slots = segmentsToSlots(editableSegments.value, formStartDate.value as DateValue);
      }
      else if (editableSlotGroups.value.length > 0) {
        cycleWeeks = template?.cycleWeeks ?? 2;
        slots = buildSlotsFromPresets(editableSlotGroups.value, slotPresets.value);
      }
      else {
        cycleWeeks = template?.cycleWeeks ?? 2;
        slots = template?.slots;
      }
      const rotation = await $fetch<{ id: string }>(
        `/api/integrations/${integrationId}/shifts/rotations`,
        {
          method: "POST",
          body: {
            name,
            cycleWeeks,
            color: newRotationColor.value,
            order: rotations.value.length,
          },
        },
      );
      if (slots?.length) {
        await Promise.all(slots.map((slot, i) =>
          $fetch(
            `/api/integrations/${integrationId}/shifts/rotations/${rotation.id}/slots`,
            {
              method: "POST",
              body: {
                weekIndex: slot.weekIndex,
                dayOfWeek: slot.dayOfWeek,
                startTime: slot.startTime,
                endTime: slot.endTime,
                label: slot.label ?? null,
                order: i,
              },
            },
          ),
        ));
      }
      const startD = formStartDate.value;
      const endD = formEndDate.value;
      await $fetch(`/api/integrations/${integrationId}/shifts/assignments`, {
        method: "POST",
        body: {
          userId,
          shiftRotationId: rotation.id,
          startDate: new Date(Date.UTC(startD.year, startD.month - 1, startD.day, 0, 0, 0, 0)).toISOString(),
          endDate: endD
            ? new Date(Date.UTC(endD.year, endD.month - 1, endD.day, 0, 0, 0, 0)).toISOString()
            : null,
        },
      });
    }
    await Promise.all([fetchRotations(), fetchAssignments()]);
    closeForm();
    await triggerImmediateSync("calendar", integrationId);
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to save shift";
  }
}

async function deleteConfiguredShift(assignmentId: string) {
  if (!props.integration?.id)
    return;
  try {
    await $fetch(
      `/api/integrations/${props.integration.id}/shifts/assignments/${assignmentId}`,
      { method: "DELETE" },
    );
    await fetchAssignments();
    if (editingAssignmentId.value === assignmentId)
      closeForm();
    await triggerImmediateSync("calendar", props.integration.id);
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to delete shift";
  }
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
    @click="emit('close')"
  >
    <div
      class="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-default rounded-lg border border-default shadow-lg"
      @click.stop
    >
      <div class="flex items-center justify-between p-4 border-b border-default">
        <h3 class="text-base font-semibold leading-6">
          Configure Shifts – {{ integration?.name ?? "Integration" }}
        </h3>
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-x"
          aria-label="Close"
          @click="emit('close')"
        />
      </div>

      <div class="p-4 space-y-6">
        <div v-if="error" class="bg-error/10 text-error rounded-md px-3 py-2 text-sm">
          {{ error }}
        </div>

        <div v-if="loading" class="flex justify-center py-8">
          <UIcon name="i-lucide-loader-2" class="animate-spin h-8 w-8" />
        </div>

        <template v-else>
          <div>
            <h4 class="font-medium text-highlighted mb-2">
              Add shift
            </h4>
            <p
              v-if="!integrationOwnerUserId"
              class="text-sm text-muted mb-4"
            >
              Select a user for this integration in the integration settings first.
            </p>
            <div class="mb-4 p-4 rounded-lg border border-default space-y-4">
              <div class="space-y-2">
                <label class="block text-sm font-medium text-highlighted">Patterns</label>
                <div class="flex gap-2 items-center">
                  <USelect
                    v-model="selectedTemplateId"
                    :items="templateSelectItems"
                    placeholder="Select a shift pattern"
                    class="flex-1"
                    :disabled="!!editingAssignmentId"
                  />
                  <UButton
                    v-if="selectedTemplateId && !editingAssignmentId"
                    label="Change"
                    color="neutral"
                    variant="outline"
                    size="sm"
                    aria-label="Change pattern"
                  />
                </div>
                <p
                  v-if="selectedTemplate?.description && !editingAssignmentId"
                  class="text-sm text-muted"
                >
                  {{ selectedTemplate.description }}
                </p>
              </div>
              <template v-if="selectedTemplateId || editingAssignmentId">
                <div class="space-y-2">
                  <label class="block text-sm font-medium text-highlighted">Starts</label>
                  <UPopover>
                    <UButton
                      color="neutral"
                      variant="subtle"
                      icon="i-lucide-calendar"
                      class="w-full justify-between"
                    >
                      <NuxtTime
                        v-if="formStartDate"
                        :datetime="formStartDate.toDate(getLocalTimeZone())"
                        year="numeric"
                        month="short"
                        day="numeric"
                      />
                      <span v-else>Select a date</span>
                    </UButton>
                    <template #content>
                      <GlobalDatePicker
                        :model-value="formStartDateValue"
                        :is-date-disabled="startDateIsDisabled"
                        @update:model-value="onStartDateSelect"
                      />
                    </template>
                  </UPopover>
                </div>
                <div
                  v-if="isSegmentBasedTemplate && editableSegments.length > 0"
                  class="space-y-3"
                >
                  <label class="block text-sm font-medium text-highlighted">Shifts</label>
                  <div class="space-y-2">
                    <div
                      v-for="(seg, idx) in editableSegments"
                      :key="idx"
                      class="flex flex-wrap items-center gap-2"
                    >
                      <span class="text-sm font-medium text-highlighted min-w-[72px]">{{ seg.label }}</span>
                      <UInput
                        v-if="selectedTemplateId !== 'dupont'"
                        :model-value="seg.count"
                        type="number"
                        min="1"
                        max="99"
                        class="w-16"
                        @update:model-value="(v) => updateSegmentCount(idx, v)"
                      />
                      <span v-if="seg.preset !== 'no-shift' && selectedTemplateId !== 'dupont'" class="text-muted">×</span>
                      <USelect
                        v-if="seg.preset !== 'no-shift'"
                        :model-value="seg.preset"
                        :items="slotPresetSelectItems"
                        option-attribute="label"
                        value-attribute="value"
                        class="min-w-[140px]"
                        @update:model-value="(v: string) => updateSegmentPreset(idx, v)"
                      />
                      <div
                        v-if="seg.preset === 'custom'"
                        class="flex items-center gap-1 text-xs text-muted"
                      >
                        <span>Start:</span>
                        <USelect
                          :model-value="customSegmentTimes[idx]?.startHour ?? 9"
                          :items="hourOptions"
                          option-attribute="label"
                          value-attribute="value"
                          class="w-16"
                          @update:model-value="(v: number) => updateCustomSegmentTime(idx, 'startHour', v)"
                        />
                        <USelect
                          :model-value="customSegmentTimes[idx]?.startMinute ?? 0"
                          :items="minuteOptions"
                          option-attribute="label"
                          value-attribute="value"
                          class="w-16"
                          @update:model-value="(v: number) => updateCustomSegmentTime(idx, 'startMinute', v)"
                        />
                        <USelect
                          :model-value="customSegmentTimes[idx]?.startAmPm ?? 'AM'"
                          :items="amPmOptions"
                          option-attribute="label"
                          value-attribute="value"
                          class="w-16"
                          @update:model-value="(v: string) => updateCustomSegmentTime(idx, 'startAmPm', v)"
                        />
                        <span>End:</span>
                        <USelect
                          :model-value="customSegmentTimes[idx]?.endHour ?? 5"
                          :items="hourOptions"
                          option-attribute="label"
                          value-attribute="value"
                          class="w-16"
                          @update:model-value="(v: number) => updateCustomSegmentTime(idx, 'endHour', v)"
                        />
                        <USelect
                          :model-value="customSegmentTimes[idx]?.endMinute ?? 0"
                          :items="minuteOptions"
                          option-attribute="label"
                          value-attribute="value"
                          class="w-16"
                          @update:model-value="(v: number) => updateCustomSegmentTime(idx, 'endMinute', v)"
                        />
                        <USelect
                          :model-value="customSegmentTimes[idx]?.endAmPm ?? 'PM'"
                          :items="amPmOptions"
                          option-attribute="label"
                          value-attribute="value"
                          class="w-16"
                          @update:model-value="(v: string) => updateCustomSegmentTime(idx, 'endAmPm', v)"
                        />
                      </div>
                      <UButton
                        v-if="selectedTemplateId === 'custom' && editableSegments.length > 1"
                        color="neutral"
                        variant="ghost"
                        size="xs"
                        icon="i-lucide-trash"
                        :aria-label="`Remove ${seg.label}`"
                        @click="removeSegment(idx)"
                      />
                    </div>
                  </div>
                  <div
                    v-if="selectedTemplateId === 'custom'"
                    class="flex gap-2 flex-wrap"
                  >
                    <UButton
                      size="xs"
                      color="neutral"
                      variant="outline"
                      @click="addShiftSegment"
                    >
                      Add shift
                    </UButton>
                    <UButton
                      size="xs"
                      color="neutral"
                      variant="outline"
                      @click="addOffSegment"
                    >
                      Add off
                    </UButton>
                  </div>
                </div>
                <div
                  v-if="editableSlotGroups.length > 0"
                  class="space-y-2"
                >
                  <label class="block text-sm font-medium text-highlighted">Shifts</label>
                  <p class="text-sm text-muted mb-2">
                    Tap each shift to choose its type (Day, Morning, Evening, Night, etc.)
                  </p>
                  <div class="flex flex-wrap gap-2">
                    <div
                      v-for="g in editableSlotGroups"
                      :key="g.index"
                      class="min-w-[140px]"
                    >
                      <label class="block text-xs text-muted mb-1">{{ getSlotLabel(g, editableSlotGroups, formStartDate as DateValue | null, effectiveCycleWeeks) }}</label>
                      <USelect
                        :model-value="slotPresets[g.index] ?? 'day'"
                        :items="slotPresetSelectItemsWithOff"
                        option-attribute="label"
                        value-attribute="value"
                        class="w-full"
                        @update:model-value="(v: string) => setSlotPreset(g.index, v)"
                      />
                    </div>
                  </div>
                </div>
                <div class="space-y-2">
                  <label class="block text-sm font-medium text-highlighted">Pattern name</label>
                  <UInput
                    v-model="newRotationName"
                    placeholder="Pattern name"
                    class="w-full"
                  />
                  <p v-if="!editingAssignmentId" class="text-sm text-muted">
                    Optional: If not provided, a name will be generated.
                  </p>
                </div>
                <div class="space-y-2">
                  <label class="block text-sm font-medium text-highlighted">Color</label>
                  <UPopover>
                    <UButton
                      label="Choose color"
                      color="neutral"
                      variant="outline"
                    >
                      <template #leading>
                        <span
                          :style="{
                            backgroundColor: newRotationColor || '#06b6d4',
                          }"
                          class="size-3 rounded-full"
                        />
                      </template>
                    </UButton>
                    <template #content>
                      <UColorPicker v-model="newRotationColor" class="p-2" />
                    </template>
                  </UPopover>
                </div>
                <div class="space-y-2">
                  <label class="block text-sm font-medium text-highlighted">End date (optional)</label>
                  <UPopover>
                    <UButton
                      color="neutral"
                      variant="subtle"
                      icon="i-lucide-calendar"
                      class="w-full justify-between"
                    >
                      <NuxtTime
                        v-if="formEndDate"
                        :datetime="formEndDate.toDate(getLocalTimeZone())"
                        year="numeric"
                        month="short"
                        day="numeric"
                      />
                      <span v-else>Select a date</span>
                    </UButton>
                    <template #content>
                      <GlobalDatePicker
                        :model-value="formEndDateValue"
                        @update:model-value="(value: DateValue | null) => { formEndDate = value; }"
                      />
                    </template>
                  </UPopover>
                </div>
                <div class="flex gap-2">
                  <UButton size="sm" @click="saveConfiguredShift">
                    Save
                  </UButton>
                  <UButton
                    size="sm"
                    variant="ghost"
                    @click="closeForm"
                  >
                    {{ editingAssignmentId ? "Cancel" : "Clear" }}
                  </UButton>
                </div>
              </template>
            </div>

            <h4 class="font-medium text-highlighted mb-2">
              Configured shifts
            </h4>
            <p class="text-sm text-muted mb-4">
              Your configured shift patterns and date ranges. Edit or delete via the buttons.
            </p>
            <div class="space-y-4">
              <div
                v-for="a in assignments"
                :key="a.id"
                class="flex items-center justify-between p-4 rounded-lg border border-default"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    :style="{
                      backgroundColor: a.shiftRotation.color ?? '#06b6d4',
                    }"
                  />
                  <div>
                    <p class="font-medium text-highlighted">
                      {{ a.shiftRotation.name }}
                    </p>
                    <p class="text-sm text-muted">
                      {{ new Date(a.startDate).toLocaleDateString() }}
                      <template v-if="a.endDate">
                        – {{ new Date(a.endDate).toLocaleDateString() }}
                      </template>
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <UButton
                    variant="ghost"
                    size="sm"
                    icon="i-lucide-edit"
                    :aria-label="`Edit ${a.shiftRotation.name}`"
                    @click="openEditForm(a)"
                  />
                  <UButton
                    variant="ghost"
                    size="sm"
                    color="error"
                    icon="i-lucide-trash"
                    :aria-label="`Delete ${a.shiftRotation.name}`"
                    @click="deleteConfiguredShift(a.id)"
                  />
                </div>
              </div>
              <p v-if="assignments.length === 0" class="text-muted text-sm py-2">
                No configured shifts yet. Select a pattern and fill the form above to add one.
              </p>
            </div>
          </div>
        </template>
      </div>

      <div class="p-4 border-t border-default">
        <UButton
          color="neutral"
          variant="ghost"
          @click="emit('close')"
        >
          Done
        </UButton>
      </div>
    </div>
  </div>
</template>
