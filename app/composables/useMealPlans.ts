import { consola } from "consola";

import type {
  CreateMealInput,
  CreateMealPlanInput,
  Meal,
  MealPlanWithMeals,
  MealWithDate,
  UpdateMealInput,
} from "~/types/database";

import { queueMealCreation } from "~/utils/offlineDb";

import { useOfflineSync } from "./useOfflineSync";

export function useMealPlans() {
  const loading = ref(false);
  const error = ref<string | null>(null);

  const { data: mealPlans } = useNuxtData<MealPlanWithMeals[]>("meal-plans");
  const { isOnline, updatePendingCount } = useOfflineSync();

  const currentMealPlans = computed(() => mealPlans.value || []);

  const getMealPlans = async () => {
    loading.value = true;
    error.value = null;
    try {
      await refreshNuxtData("meal-plans");
      consola.debug("Use Meal Plans: Meal plans refreshed successfully");
    }
    catch (err) {
      error.value = "Failed to fetch meal plans";
      consola.error("Use Meal Plans: Error fetching meal plans:", err);
      throw err;
    }
    finally {
      loading.value = false;
    }
  };

  const getMealPlanByWeek = async (weekStart: Date) => {
    try {
      const weekStartStr = weekStart.toISOString().split("T")[0];
      const plan = await $fetch<MealPlanWithMeals | null>(
        `/api/meal-plans/by-week/${weekStartStr}`,
      );
      return plan;
    }
    catch (err) {
      error.value = "Failed to fetch meal plan for week";
      consola.error("Use Meal Plans: Error fetching meal plan by week:", err);
      throw err;
    }
  };

  const createMealPlan = async (planData: CreateMealPlanInput) => {
    try {
      const newPlan = await $fetch<MealPlanWithMeals>("/api/meal-plans", {
        method: "POST",
        body: {
          ...planData,
          weekStart: planData.weekStart.toISOString(),
        },
      });

      await refreshNuxtData("meal-plans");
      return newPlan;
    }
    catch (err) {
      error.value = "Failed to create meal plan";
      consola.error("Use Meal Plans: Error creating meal plan:", err);
      throw err;
    }
  };

  const deleteMealPlan = async (planId: string) => {
    try {
      await $fetch(`/api/meal-plans/${planId}`, {
        method: "DELETE",
      });

      await refreshNuxtData("meal-plans");
    }
    catch (err) {
      error.value = "Failed to delete meal plan";
      consola.error("Use Meal Plans: Error deleting meal plan:", err);
      throw err;
    }
  };

  const addMealToPlan = async (planId: string, mealData: CreateMealInput) => {
    consola.info("[Use Meal Plans] addMealToPlan called", {
      planId,
      mealData,
      isOnline: isOnline.value,
    });

    // If offline, queue the operation
    if (!isOnline.value) {
      consola.info("[Use Meal Plans] Device is offline, queueing meal creation");

      const plan = mealPlans.value?.find(p => p.id === planId);

      if (!plan) {
        consola.error("[Use Meal Plans] Meal plan not found in local data", { planId });
        error.value = "Meal plan not found";
        throw new Error("Meal plan not found");
      }

      consola.info("[Use Meal Plans] Found meal plan", { plan });

      // Ensure weekStart is a Date object before calling toISOString
      const weekStartDate = plan.weekStart instanceof Date
        ? plan.weekStart
        : new Date(plan.weekStart);

      consola.info("[Use Meal Plans] Queueing meal creation", {
        planId,
        weekStart: weekStartDate.toISOString(),
        mealData,
      });

      const tempId = await queueMealCreation(
        planId,
        weekStartDate.toISOString(),
        mealData,
      );

      consola.info("[Use Meal Plans] Meal queued with tempId:", tempId);

      const tempMeal = {
        id: tempId,
        ...mealData,
        mealPlanId: planId,
        createdAt: new Date(),
        updatedAt: new Date(),
        order: 0,
        _isPending: true,
      } as Meal & { _isPending: boolean };

      consola.info("[Use Meal Plans] Created temp meal object", tempMeal);

      // Optimistically update local data
      if (plan.meals) {
        plan.meals.push(tempMeal as any);
        consola.info("[Use Meal Plans] Added temp meal to plan.meals, new count:", plan.meals.length);
      }
      else {
        consola.warn("[Use Meal Plans] plan.meals is undefined, cannot add temp meal");
      }

      await updatePendingCount();
      consola.info("[Use Meal Plans] Updated pending count after queueing");
      return tempMeal;
    }

    // Online - normal flow
    consola.info("[Use Meal Plans] Device is online, creating meal via API");
    try {
      const newMeal = await $fetch<Meal>(`/api/meal-plans/${planId}/meals`, {
        method: "POST",
        body: mealData,
      });

      consola.info("[Use Meal Plans] Meal created successfully via API", newMeal);

      await refreshNuxtData("meal-plans");
      return newMeal;
    }
    catch (err) {
      error.value = "Failed to add meal to plan";
      consola.error("Use Meal Plans: Error adding meal:", err);
      throw err;
    }
  };

  const updateMeal = async (mealId: string, updates: UpdateMealInput) => {
    try {
      const updatedMeal = await $fetch<Meal>(`/api/meals/${mealId}`, {
        method: "PUT",
        body: updates,
      });

      await refreshNuxtData("meal-plans");
      return updatedMeal;
    }
    catch (err) {
      error.value = "Failed to update meal";
      consola.error("Use Meal Plans: Error updating meal:", err);
      throw err;
    }
  };

  const deleteMeal = async (mealId: string) => {
    try {
      await $fetch(`/api/meals/${mealId}`, {
        method: "DELETE",
      });

      await refreshNuxtData("meal-plans");
    }
    catch (err) {
      error.value = "Failed to delete meal";
      consola.error("Use Meal Plans: Error deleting meal:", err);
      throw err;
    }
  };

  const getUpcomingPrepMeals = async () => {
    try {
      const meals = await $fetch<Meal[]>("/api/meals/upcomingPrep");
      return meals;
    }
    catch (err) {
      error.value = "Failed to fetch upcoming preparation meals";
      consola.error("Use Meal Plans: Error fetching upcoming prep meals:", err);
      throw err;
    }
  };

  const getMealsForDateRange = async (startDate: Date, endDate: Date) => {
    try {
      const meals = await $fetch<MealWithDate[]>(
        "/api/meals/byDateRange",
        {
          params: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          },
        },
      );
      return meals;
    }
    catch (err) {
      error.value = "Failed to fetch meals for date range";
      consola.error("Use Meal Plans: Error fetching meals by date range:", err);
      throw err;
    }
  };

  return {
    mealPlans: readonly(currentMealPlans),
    loading: readonly(loading),
    error: readonly(error),
    getMealPlans,
    getMealPlanByWeek,
    createMealPlan,
    deleteMealPlan,
    addMealToPlan,
    updateMeal,
    deleteMeal,
    getUpcomingPrepMeals,
    getMealsForDateRange,
  };
}
