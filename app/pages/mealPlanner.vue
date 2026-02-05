<script setup lang="ts">
import { consola } from "consola";
import { addWeeks, format, startOfWeek, subWeeks } from "date-fns";

import type { CreateMealInput, Meal, MealPlanWithMeals, MealType } from "~/types/database";

import GlobalDateHeader from "~/components/global/globalDateHeader.vue";
import MealDialog from "~/components/mealPlanner/mealDialog.vue";
import PreparationReminders from "~/components/mealPlanner/preparationReminders.vue";
import SyncStatusBar from "~/components/mealPlanner/syncStatusBar.vue";
import WeeklyMealGrid from "~/components/mealPlanner/weeklyMealGrid.vue";
import { useAlertToast } from "~/composables/useAlertToast";
import { useStableDate } from "~/composables/useStableDate";

const { getStableDate } = useStableDate();
const { showError, showSuccess } = useAlertToast();

const {
  getMealPlanByWeek,
  createMealPlan,
  addMealToPlan,
  updateMeal,
  deleteMeal,
  getUpcomingPrepMeals,
} = useMealPlans();

const { isOnline } = useOfflineSync();

// Current week state (Monday of the week)
const currentWeekStart = ref<Date>(
  startOfWeek(getStableDate(), { weekStartsOn: 1 }),
);

// Meal plan data
const currentPlan = ref<MealPlanWithMeals | null>(null);
const upcomingPrepMeals = ref<Meal[]>([]);
const loading = ref(false);

// Dialog state
const mealDialog = ref(false);
const editingMeal = ref<Meal | null>(null);
const selectedDayOfWeek = ref(0);
const selectedMealType = ref<MealType>("BREAKFAST");

// Computed properties
const weekRange = computed(() => {
  const start = currentWeekStart.value;
  const end = addWeeks(start, 1);
  end.setDate(end.getDate() - 1); // Last day of the week (Sunday)

  return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
});

const isCurrentWeek = computed(() => {
  const todayWeekStart = startOfWeek(getStableDate(), { weekStartsOn: 1 });
  return currentWeekStart.value.getTime() === todayWeekStart.getTime();
});

// Load meal plan for current week
async function loadWeekMealPlan() {
  loading.value = true;
  try {
    const plan = await getMealPlanByWeek(currentWeekStart.value);

    if (!plan) {
      // Create a new meal plan for this week
      const newPlan = await createMealPlan({
        weekStart: currentWeekStart.value,
        order: 0,
      });
      currentPlan.value = newPlan;
    }
    else {
      currentPlan.value = plan;
    }
  }
  catch (error) {
    // Provide different error messages based on online status
    if (!isOnline.value) {
      showError("Offline", "Cannot load meal plan while offline. Please check your connection.");
      // Set empty plan so UI still renders
      currentPlan.value = {
        id: "",
        weekStart: currentWeekStart.value,
        order: 0,
        meals: [],
        _count: { meals: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    else {
      showError("Load Failed", "Failed to load meal plan. Please try again.");
    }
    consola.error("Failed to load meal plan:", error);
  }
  finally {
    loading.value = false;
  }
}

// Load upcoming preparation meals
async function loadUpcomingPrepMeals() {
  try {
    const meals = await getUpcomingPrepMeals();
    upcomingPrepMeals.value = meals;
  }
  catch (error: any) {
    consola.error("Failed to load preparation reminders:", error);
    // Set empty array so UI doesn't break
    upcomingPrepMeals.value = [];

    // Show error only if we're online (offline is expected to fail)
    if (isOnline.value) {
      showError("Load Failed", "Failed to load preparation reminders.");
    }
  }
}

// Navigation
function handlePreviousWeek() {
  currentWeekStart.value = subWeeks(currentWeekStart.value, 1);
}

function handleNextWeek() {
  currentWeekStart.value = addWeeks(currentWeekStart.value, 1);
}

function handleToday() {
  currentWeekStart.value = startOfWeek(getStableDate(), { weekStartsOn: 1 });
}

// Meal operations
function openAddMeal(dayOfWeek: number, mealType: MealType, data?: { name: string; description: string; daysInAdvance: number }) {
  if (data) {
    // Called from inline form with data - create meal directly
    handleMealSaveFromInline(dayOfWeek, mealType, data);
  }
  else {
    // Called from desktop - open dialog
    selectedDayOfWeek.value = dayOfWeek;
    selectedMealType.value = mealType;
    editingMeal.value = null;
    mealDialog.value = true;
  }
}

function openEditMeal(meal: Meal) {
  editingMeal.value = meal;
  selectedDayOfWeek.value = meal.dayOfWeek;
  selectedMealType.value = meal.mealType;
  mealDialog.value = true;
}

async function handleMealSaveFromInline(dayOfWeek: number, mealType: MealType, data: { name: string; description: string; daysInAdvance: number }) {
  try {
    if (!currentPlan.value?.id) {
      showError("Error", "No meal plan found for this week.");
      return;
    }

    await addMealToPlan(currentPlan.value.id, {
      name: data.name,
      description: data.description,
      daysInAdvance: data.daysInAdvance,
      dayOfWeek,
      mealType,
    });
    showSuccess("Meal Added", "Meal has been added successfully.");

    // Reload the meal plan
    await loadWeekMealPlan();
    await loadUpcomingPrepMeals();
  }
  catch (error) {
    consola.error("Failed to save meal:", error);
    showError("Save Failed", "Failed to save meal. Please try again.");
  }
}

async function handleMealSave(mealData: CreateMealInput) {
  try {
    if (editingMeal.value?.id) {
      // Update existing meal
      await updateMeal(editingMeal.value.id, mealData);
      showSuccess("Meal Updated", "Meal has been updated successfully.");
    }
    else {
      // Add new meal
      if (!currentPlan.value?.id) {
        showError("Error", "No meal plan found for this week.");
        return;
      }

      await addMealToPlan(currentPlan.value.id, mealData);
      showSuccess("Meal Added", "Meal has been added successfully.");
    }

    // Reload the meal plan
    await loadWeekMealPlan();
    await loadUpcomingPrepMeals();

    mealDialog.value = false;
    editingMeal.value = null;
  }
  catch (error) {
    consola.error("Failed to save meal:", error);
    showError("Save Failed", "Failed to save meal. Please try again.");
  }
}

async function handleMealDelete() {
  if (!editingMeal.value?.id)
    return;

  try {
    await deleteMeal(editingMeal.value.id);
    showSuccess("Meal Deleted", "Meal has been deleted successfully.");

    // Reload the meal plan
    await loadWeekMealPlan();
    await loadUpcomingPrepMeals();

    mealDialog.value = false;
    editingMeal.value = null;
  }
  catch (error) {
    consola.error("Failed to delete meal:", error);
    showError("Delete Failed", "Failed to delete meal. Please try again.");
  }
}

async function handleMealDeleteFromInline(meal: Meal) {
  if (!meal?.id)
    return;

  try {
    await deleteMeal(meal.id);
    showSuccess("Meal Deleted", "Meal has been deleted successfully.");

    // Reload the meal plan
    await loadWeekMealPlan();
    await loadUpcomingPrepMeals();
  }
  catch (error) {
    consola.error("Failed to delete meal:", error);
    showError("Delete Failed", "Failed to delete meal. Please try again.");
  }
}

async function handleTogglePreparation(mealId: string, completed: boolean) {
  // Find the meal and store previous state for rollback
  const meal = upcomingPrepMeals.value.find(m => m.id === mealId);
  if (!meal) {
    return;
  }

  const previousCompleted = meal.completed;

  // Update local state optimistically (before API call)
  meal.completed = completed;

  try {
    await updateMeal(mealId, { completed });

    // Reload to ensure consistency with server state
    await loadUpcomingPrepMeals();
  }
  catch (error) {
    // Re-find meal in case array was mutated, then roll back optimistic update
    const mealToRollback = upcomingPrepMeals.value.find(m => m.id === mealId);
    if (mealToRollback) {
      mealToRollback.completed = previousCompleted;
    }

    consola.error("Failed to toggle preparation:", error);
    showError("Update Failed", "Failed to update preparation status.");
  }
}

async function handleMoveMeal(event: { mealId: string; newDayOfWeek: number; newMealType: MealType }) {
  try {
    // Update meal with new day and meal type
    await updateMeal(event.mealId, {
      dayOfWeek: event.newDayOfWeek,
      mealType: event.newMealType,
    });

    showSuccess("Meal Moved", "Meal has been moved successfully.");

    // Reload the meal plan
    await loadWeekMealPlan();
    await loadUpcomingPrepMeals();
  }
  catch (error) {
    consola.error("Failed to move meal:", error);
    showError("Move Failed", "Failed to move meal. Please try again.");
  }
}

// Load data on mount
onMounted(() => {
  loadWeekMealPlan();
  loadUpcomingPrepMeals();
});

// Watch for week changes
watch(currentWeekStart, () => {
  loadWeekMealPlan();
});
</script>

<template>
  <div class="flex h-screen w-full flex-col overflow-x-hidden overflow-y-hidden">
    <!-- Header -->
    <div class="py-5 sm:px-4 flex-shrink-0 bg-default border-b border-default">
      <GlobalDateHeader />
    </div>

    <!-- Sync Status Bar -->
    <div class="flex-shrink-0">
      <SyncStatusBar />
    </div>

    <!-- Week Navigation -->
    <div class="p-4 border-b border-default bg-default flex-shrink-0">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <h2 class="text-xl font-bold">
            {{ weekRange }}
          </h2>
          <UBadge
            v-if="isCurrentWeek"
            color="primary"
            variant="soft"
          >
            Current Week
          </UBadge>
        </div>

        <div class="flex items-center gap-2">
          <UButton
            icon="i-lucide-chevron-left"
            color="neutral"
            variant="ghost"
            aria-label="Previous week"
            @click="handlePreviousWeek"
          />
          <UButton
            color="neutral"
            variant="outline"
            @click="handleToday"
          >
            Today
          </UButton>
          <UButton
            icon="i-lucide-chevron-right"
            color="neutral"
            variant="ghost"
            aria-label="Next week"
            @click="handleNextWeek"
          />
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4">
      <div v-if="loading" class="flex items-center justify-center h-64">
        <div class="text-center">
          <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-primary-500" />
          <p class="mt-2 text-sm text-muted">
            Loading meal plan...
          </p>
        </div>
      </div>

      <div v-else>
        <!-- Weekly Meal Grid -->
        <WeeklyMealGrid
          :week-start="currentWeekStart"
          :meals="currentPlan?.meals || []"
          @add-meal="openAddMeal"
          @edit-meal="openEditMeal"
          @delete-meal="handleMealDeleteFromInline"
          @move-meal="handleMoveMeal"
        />

        <!-- Preparation Reminders -->
        <div class="mt-6">
          <PreparationReminders
            :meals="upcomingPrepMeals"
            :week-start="currentWeekStart"
            @toggle-complete="handleTogglePreparation"
          />
        </div>
      </div>
    </div>

    <!-- Meal Dialog -->
    <MealDialog
      :is-open="mealDialog"
      :meal="editingMeal"
      :day-of-week="selectedDayOfWeek"
      :meal-type="selectedMealType"
      @close="mealDialog = false; editingMeal = null"
      @save="handleMealSave"
      @delete="handleMealDelete"
    />
  </div>
</template>
