import { addDays } from "date-fns";

import type { MealWithDate } from "~/types/database";

import prisma from "~/lib/prisma";

export default defineEventHandler(async (event): Promise<MealWithDate[]> => {
  try {
    const query = getQuery(event);
    const startDateStr = query.startDate as string;
    const endDateStr = query.endDate as string;

    if (!startDateStr || !endDateStr) {
      throw createError({
        statusCode: 400,
        message: "Both startDate and endDate query parameters are required",
      });
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw createError({
        statusCode: 400,
        message: "Invalid date format. Use ISO 8601 format (e.g., 2024-01-01T00:00:00Z)",
      });
    }

    // Find all meal plans that could have meals in the date range
    // We need to look back up to 6 days before startDate (for meals on Sunday of a week starting Monday)
    const lookbackDate = addDays(startDate, -6);

    const mealPlans = await prisma.mealPlan.findMany({
      where: {
        weekStart: {
          gte: lookbackDate,
          lte: endDate,
        },
      },
      include: {
        meals: true,
      },
    });

    // Calculate actual dates for meals and filter to date range
    const mealsWithDates: MealWithDate[] = [];

    for (const mealPlan of mealPlans) {
      for (const meal of mealPlan.meals) {
        // Calculate the actual date of the meal
        // dayOfWeek: 0 = Monday, 1 = Tuesday, ..., 6 = Sunday
        const mealDate = addDays(mealPlan.weekStart, meal.dayOfWeek);

        // Check if meal falls within the requested range
        if (mealDate >= startDate && mealDate <= endDate) {
          mealsWithDates.push({
            ...meal,
            calculatedDate: mealDate,
            mealPlanWeekStart: mealPlan.weekStart,
          });
        }
      }
    }

    return mealsWithDates;
  }
  catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      message: `Failed to fetch meals by date range: ${error}`,
    });
  }
});
