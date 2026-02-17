<script setup lang="ts">
import type { DateValue } from "@internationalized/date";
import type { DateRange } from "reka-ui";

import { computed } from "vue";

import { getDefaultDateToday } from "~/composables/useRecurrence";

const props = withDefaults(
  defineProps<{
    modelValue: DateValue | null;
    disabled?: boolean;
    minValue?: DateValue;
    maxValue?: DateValue;
    isDateDisabled?: (date: DateValue) => boolean;
  }>(),
  {
    disabled: false,
    minValue: undefined,
    maxValue: undefined,
    isDateDisabled: undefined,
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: DateValue | null): void;
}>();

const effectiveValue = computed(() =>
  props.modelValue ?? getDefaultDateToday(),
);

function onUpdate(
  date: DateValue | DateRange | DateValue[] | null | undefined,
) {
  const value
    = date != null && !Array.isArray(date) && "year" in date && "month" in date
      ? (date as DateValue)
      : null;
  emit("update:modelValue", value);
}
</script>

<template>
  <UCalendar
    :model-value="effectiveValue"
    class="p-2"
    :disabled="disabled"
    :min-value="minValue"
    :max-value="maxValue"
    :is-date-disabled="isDateDisabled"
    @update:model-value="onUpdate"
  />
</template>
