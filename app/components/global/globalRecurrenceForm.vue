<script setup lang="ts">
import type { DateValue } from "@internationalized/date";

import { CalendarDate, getLocalTimeZone } from "@internationalized/date";

import type { RecurrenceState } from "~/composables/useRecurrence";

import { useRecurrence } from "~/composables/useRecurrence";

const props = defineProps<{
  state: RecurrenceState;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:state", state: RecurrenceState): void;
}>();

const { resetRecurrenceFields: resetRecurrenceFieldsComposable } = useRecurrence();

const dayNames = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

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

function toggleRecurrenceDay(day: number) {
  if (props.disabled)
    return;

  const index = props.state.recurrenceDays.value.indexOf(day);
  if (index > -1) {
    props.state.recurrenceDays.value.splice(index, 1);
  }
  else {
    props.state.recurrenceDays.value.push(day);
  }
  emit("update:state", props.state);
}
</script>

<template>
  <div class="space-y-3 pt-2 border-t border-default">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <UIcon
          name="i-lucide-repeat"
          class="h-4 w-4 transition-colors"
          :class="state.isRecurring.value ? 'text-primary' : 'text-muted'"
        />
        <label
          class="text-sm font-medium cursor-pointer transition-colors"
          :class="state.isRecurring.value ? 'text-primary' : 'text-highlighted'"
          @click="state.isRecurring.value = !state.isRecurring.value; emit('update:state', state)"
        >
          Repeat
          <span
            v-if="state.isRecurring.value"
            class="text-xs text-primary/70 ml-1"
          >(enabled)</span>
        </label>
      </div>
      <UToggle
        :model-value="state.isRecurring.value"
        size="md"
        :disabled="disabled"
        @update:model-value="state.isRecurring.value = $event; emit('update:state', state)"
      />
    </div>

    <div
      v-if="state.isRecurring.value"
      class="space-y-3 pl-4 border-l-2 border-primary/20"
    >
      <div class="flex gap-3">
        <div class="flex-1 space-y-2">
          <label class="block text-xs font-medium text-muted">Frequency</label>
          <USelect
            :model-value="state.recurrenceType.value"
            :items="recurrenceTypeOptions"
            option-attribute="label"
            value-attribute="value"
            class="w-full"
            :ui="{ base: 'w-full' }"
            :disabled="disabled"
            @update:model-value="state.recurrenceType.value = $event; emit('update:state', state)"
          />
        </div>

        <div class="w-24 space-y-2">
          <label class="block text-xs font-medium text-muted">Every</label>
          <UInput
            :model-value="state.recurrenceInterval.value"
            type="number"
            min="1"
            class="w-full"
            :ui="{ base: 'w-full' }"
            :disabled="disabled"
            @update:model-value="state.recurrenceInterval.value = Number($event); emit('update:state', state)"
          />
        </div>
      </div>

      <div
        v-if="state.recurrenceType.value === 'weekly'"
        class="space-y-2"
      >
        <label class="block text-xs font-medium text-muted">Days of Week</label>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="day in dayOptions"
            :key="day.value"
            :color="
              state.recurrenceDays.value.includes(day.value)
                ? 'primary'
                : 'neutral'
            "
            :variant="
              state.recurrenceDays.value.includes(day.value)
                ? 'solid'
                : 'outline'
            "
            size="xs"
            :disabled="disabled"
            @click="toggleRecurrenceDay(day.value)"
          >
            {{ day.label }}
          </UButton>
        </div>
      </div>

      <div
        v-if="state.recurrenceType.value === 'monthly'"
        class="space-y-2"
      >
        <label class="block text-xs font-medium text-muted">Repeat on</label>
        <USelect
          :model-value="state.recurrenceMonthlyType.value"
          :items="monthlyTypeOptions"
          option-attribute="label"
          value-attribute="value"
          class="w-full"
          :ui="{ base: 'w-full' }"
          :disabled="disabled"
          @update:model-value="state.recurrenceMonthlyType.value = $event; emit('update:state', state)"
        />
        <div
          v-if="state.recurrenceMonthlyType.value === 'weekday'"
          class="space-y-2"
        >
          <label class="block text-xs font-medium text-muted">Weekday</label>
          <div class="flex gap-2">
            <USelect
              :model-value="state.recurrenceMonthlyWeekday.value.week"
              :items="weekOptions"
              option-attribute="label"
              value-attribute="value"
              class="flex-1"
              :ui="{ base: 'flex-1' }"
              :disabled="disabled"
              @update:model-value="state.recurrenceMonthlyWeekday.value.week = $event; emit('update:state', state)"
            />
            <USelect
              :model-value="state.recurrenceMonthlyWeekday.value.day"
              :items="dayOptions"
              option-attribute="label"
              value-attribute="value"
              class="flex-1"
              :ui="{ base: 'flex-1' }"
              :disabled="disabled"
              @update:model-value="state.recurrenceMonthlyWeekday.value.day = $event; emit('update:state', state)"
            />
          </div>
        </div>
      </div>

      <div
        v-if="state.recurrenceType.value === 'yearly'"
        class="space-y-2"
      >
        <label class="block text-xs font-medium text-muted">Repeat on</label>
        <USelect
          :model-value="state.recurrenceYearlyType.value"
          :items="yearlyTypeOptions"
          option-attribute="label"
          value-attribute="value"
          class="w-full"
          :ui="{ base: 'w-full' }"
          :disabled="disabled"
          @update:model-value="state.recurrenceYearlyType.value = $event; emit('update:state', state)"
        />
        <div
          v-if="state.recurrenceYearlyType.value === 'weekday'"
          class="space-y-2"
        >
          <label class="block text-xs font-medium text-muted">Weekday</label>
          <div class="flex gap-2">
            <USelect
              :model-value="state.recurrenceYearlyWeekday.value.week"
              :items="weekOptions"
              option-attribute="label"
              value-attribute="value"
              class="flex-1"
              :ui="{ base: 'flex-1' }"
              :disabled="disabled"
              @update:model-value="state.recurrenceYearlyWeekday.value.week = $event; emit('update:state', state)"
            />
            <USelect
              :model-value="state.recurrenceYearlyWeekday.value.day"
              :items="dayOptions"
              option-attribute="label"
              value-attribute="value"
              class="flex-1"
              :ui="{ base: 'flex-1' }"
              :disabled="disabled"
              @update:model-value="state.recurrenceYearlyWeekday.value.day = $event; emit('update:state', state)"
            />
            <USelect
              :model-value="state.recurrenceYearlyWeekday.value.month"
              :items="monthOptions"
              option-attribute="label"
              value-attribute="value"
              class="flex-1"
              :ui="{ base: 'flex-1' }"
              :disabled="disabled"
              @update:model-value="state.recurrenceYearlyWeekday.value.month = $event; emit('update:state', state)"
            />
          </div>
        </div>
      </div>

      <div class="space-y-2">
        <label class="block text-xs font-medium text-muted">Ends</label>
        <div class="flex gap-4">
          <USelect
            :model-value="state.recurrenceEndType.value"
            :items="recurrenceEndTypeOptions"
            option-attribute="label"
            value-attribute="value"
            class="flex-1"
            :ui="{ base: 'flex-1' }"
            :disabled="disabled"
            @update:model-value="state.recurrenceEndType.value = $event; emit('update:state', state)"
          />
          <UInput
            v-if="state.recurrenceEndType.value === 'count'"
            :model-value="state.recurrenceCount.value"
            type="number"
            min="1"
            max="999"
            placeholder="10"
            class="w-20"
            :ui="{ base: 'w-20' }"
            :disabled="disabled"
            @update:model-value="state.recurrenceCount.value = Number($event); emit('update:state', state)"
          />
          <UPopover v-if="state.recurrenceEndType.value === 'until'">
            <UButton
              color="neutral"
              variant="subtle"
              icon="i-lucide-calendar"
              class="flex-1 justify-between"
              :disabled="disabled"
            >
              <NuxtTime
                v-if="state.recurrenceUntil.value"
                :datetime="state.recurrenceUntil.value.toDate(getLocalTimeZone())"
                year="numeric"
                month="short"
                day="numeric"
              />
              <span v-else>Select date</span>
            </UButton>
            <template #content>
              <UCalendar
                :model-value="state.recurrenceUntil.value as DateValue"
                class="p-2"
                :disabled="disabled"
                @update:model-value="
                  (value) => {
                    if (value) {
                      state.recurrenceUntil.value = value as DateValue;
                      emit('update:state', state);
                    }
                  }
                "
              />
            </template>
          </UPopover>
        </div>
      </div>
    </div>
  </div>
</template>
