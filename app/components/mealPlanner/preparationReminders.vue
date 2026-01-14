<script setup lang="ts">
import { format } from "date-fns";

import type { Meal } from "~/types/database";

const props = defineProps<{
  meals: Meal[];
  weekStart: Date;
}>();

const emit = defineEmits<{
  (e: "toggleComplete", mealId: string, completed: boolean): void;
}>();

const mealTypeLabels: Record<string, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
};

const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function getMealDate(meal: Meal & { weekStart?: Date }): Date {
  const weekStartDate = meal.weekStart || props.weekStart;
  const date = new Date(weekStartDate);
  date.setDate(date.getDate() + meal.dayOfWeek);
  return date;
}

function getFormattedMealInfo(meal: Meal & { weekStart?: Date }): string {
  const mealDate = getMealDate(meal);
  const dayName = dayNames[meal.dayOfWeek];
  const dateStr = format(mealDate, "MMM d");
  const mealTypeLabel = mealTypeLabels[meal.mealType];

  return `${dayName}, ${dateStr} - ${mealTypeLabel}`;
}
</script>

<template>
  <div v-if="meals.length > 0" class="border-t border-default pt-4">
    <div class="flex items-center gap-2 mb-3">
      <UIcon name="i-lucide-clock" class="h-5 w-5 text-primary" />
      <h3 class="font-semibold text-lg">
        Preparation Reminders
      </h3>
    </div>

    <div class="space-y-2">
      <div
        v-for="meal in meals"
        :key="meal.id"
        class="flex items-center gap-3 p-3 bg-default border border-default rounded-md hover:bg-muted/5 transition-colors"
      >
        <UCheckbox
          :model-value="meal.completed"
          @update:model-value="emit('toggleComplete', meal.id, $event)"
        />

        <div class="flex-1">
          <div class="font-medium">
            {{ meal.name }}
          </div>
          <div class="text-sm text-muted">
            {{ getFormattedMealInfo(meal) }}
          </div>
          <div v-if="meal.description" class="text-sm text-muted mt-1">
            {{ meal.description }}
          </div>
        </div>

        <div class="text-xs bg-warning/10 text-warning px-2 py-1 rounded">
          {{ meal.daysInAdvance }}d advance
        </div>
      </div>
    </div>
  </div>
</template>
