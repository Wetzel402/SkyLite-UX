<script setup lang="ts">
import { format } from "date-fns";

import type { Meal, MealType } from "~/types/database";

type MealWithPending = Meal & { _isPending?: boolean };

const props = defineProps<{
  weekStart: Date;
  meals: MealWithPending[];
}>();

const emit = defineEmits<{
  (e: "addMeal", dayOfWeek: number, mealType: MealType): void;
  (e: "editMeal", meal: Meal): void;
}>();

const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const mealTypes: MealType[] = ["BREAKFAST", "LUNCH", "DINNER"];
const mealTypeLabels: Record<MealType, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
};

const mealGrid = computed(() => {
  const grid: Record<number, Record<MealType, Meal[]>> = {};

  for (let day = 0; day < 7; day++) {
    grid[day] = {
      BREAKFAST: [],
      LUNCH: [],
      DINNER: [],
    };
  }

  props.meals.forEach((meal) => {
    if (grid[meal.dayOfWeek]?.[meal.mealType]) {
      grid[meal.dayOfWeek]![meal.mealType]!.push(meal);
    }
  });

  return grid;
});

function getDayDate(dayOfWeek: number): string {
  const date = new Date(props.weekStart);
  date.setDate(date.getDate() + dayOfWeek);
  return format(date, "MMM d");
}
</script>

<template>
  <div class="overflow-x-auto">
    <div class="min-w-[900px]">
      <!-- Header Row -->
      <div class="grid grid-cols-8 gap-2 mb-2">
        <div class="font-medium text-sm text-muted">
          <!-- Empty cell for meal type column -->
        </div>
        <div
          v-for="(day, index) in dayNames"
          :key="index"
          class="text-center"
        >
          <div class="font-semibold text-sm">
            {{ day }}
          </div>
          <div class="text-xs text-muted">
            {{ getDayDate(index) }}
          </div>
        </div>
      </div>

      <!-- Meal Type Rows -->
      <div
        v-for="mealType in mealTypes"
        :key="mealType"
        class="mb-4"
      >
        <div class="grid grid-cols-8 gap-2">
          <!-- Meal Type Label -->
          <div class="flex items-center">
            <span class="font-medium text-sm text-muted">
              {{ mealTypeLabels[mealType] }}
            </span>
          </div>

          <!-- Day Cells -->
          <div
            v-for="dayOfWeek in 7"
            :key="dayOfWeek"
            class="border border-default rounded-md p-2 min-h-[100px] bg-default hover:bg-muted/5 transition-colors cursor-pointer"
            @click="emit('addMeal', dayOfWeek - 1, mealType)"
          >
            <div class="space-y-1">
              <div
                v-for="meal in mealGrid[dayOfWeek - 1]?.[mealType] || []"
                :key="meal.id"
                class="relative text-sm bg-primary/10 hover:bg-primary/20 rounded px-2 py-1 transition-colors cursor-pointer"
                @click.stop="emit('editMeal', meal)"
              >
                <div class="font-medium truncate">
                  {{ meal.name }}
                </div>
                <div v-if="meal.daysInAdvance > 0" class="text-xs text-muted">
                  Prep: {{ meal.daysInAdvance }}d before
                </div>

                <!-- Pending sync indicator -->
                <div
                  v-if="(meal as any)._isPending"
                  class="absolute top-1 right-1 w-2 h-2 bg-yellow-500 rounded-full"
                  title="Waiting to sync"
                />
              </div>

              <div v-if="(mealGrid[dayOfWeek - 1]?.[mealType]?.length || 0) === 0" class="text-xs text-muted text-center py-2">
                + Add meal
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
