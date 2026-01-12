import { consola } from "consola";
import type {
  CreateMealInput,
  CreateMealPlanInput,
  Meal,
  MealPlanWithMeals,
  UpdateMealInput,
} from "~/types/database";

export function useMealPlans() {
  const loading = ref(false);
  const error = ref<string | null>(null);

  const { data: mealPlans } = useNuxtData<MealPlanWithMeals[]>("meal-plans");

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
    try {
      const newMeal = await $fetch<Meal>(`/api/meal-plans/${planId}/meals`, {
        method: "POST",
        body: mealData,
      });

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
      const meals = await $fetch<Meal[]>("/api/meals/upcoming-prep");
      return meals;
    }
    catch (err) {
      error.value = "Failed to fetch upcoming preparation meals";
      consola.error("Use Meal Plans: Error fetching upcoming prep meals:", err);
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
  };
}
