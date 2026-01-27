import type { DBSchema, IDBPDatabase } from "idb";

import { consola } from "consola";
import { openDB } from "idb";

type OfflineDBSchema = {
  "pending-meals": {
    key: string;
    value: {
      id: string;
      mealPlanId: string;
      weekStart: string;
      mealData: {
        name: string;
        description?: string;
        mealType: "BREAKFAST" | "LUNCH" | "DINNER";
        dayOfWeek: number;
        daysInAdvance?: number;
        completed?: boolean;
      };
      timestamp: number;
      status: "pending" | "syncing" | "error";
      error?: string;
    };
  };
} & DBSchema;

type PendingMealData = OfflineDBSchema["pending-meals"]["value"]["mealData"];

export type PendingMeal = OfflineDBSchema["pending-meals"]["value"];

let dbInstance: IDBPDatabase<OfflineDBSchema> | null = null;

export async function getOfflineDB() {
  if (dbInstance)
    return dbInstance;

  dbInstance = await openDB<OfflineDBSchema>("skylite-offline", 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("pending-meals")) {
        db.createObjectStore("pending-meals", { keyPath: "id" });
      }
    },
  });

  return dbInstance;
}

export async function queueMealCreation(
  mealPlanId: string,
  weekStart: string,
  mealData: PendingMealData,
) {
  const db = await getOfflineDB();
  const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  await db.add("pending-meals", {
    id: tempId,
    mealPlanId,
    weekStart,
    mealData,
    timestamp: Date.now(),
    status: "pending",
  });

  return tempId;
}

export async function getPendingMeals() {
  const db = await getOfflineDB();
  return await db.getAll("pending-meals");
}

export async function removePendingMeal(id: string) {
  const db = await getOfflineDB();
  await db.delete("pending-meals", id);
}

export async function updatePendingMealStatus(
  id: string,
  status: "pending" | "syncing" | "error",
  error?: string,
) {
  const db = await getOfflineDB();
  const meal = await db.get("pending-meals", id);
  if (meal) {
    meal.status = status;
    if (error)
      meal.error = error;
    await db.put("pending-meals", meal);
  }
  else {
    consola.warn(`Attempted to update non-existent pending meal: ${id}`);
  }
}
