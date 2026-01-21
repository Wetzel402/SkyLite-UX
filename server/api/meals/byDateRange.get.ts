import { addDays } from "date-fns";
import { consola } from "consola";

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

    // Parse dates as UTC to avoid timezone issues
    // Input format: YYYY-MM-DD
    const [startYear, startMonth, startDay] = startDateStr.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDateStr.split('-').map(Number);

    const startDate = new Date(Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(endYear, endMonth - 1, endDay, 23, 59, 59, 999));

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw createError({
        statusCode: 400,
        message: "Invalid date format. Use YYYY-MM-DD format",
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

        // Normalize to UTC midnight for comparison
        const mealDateUTC = new Date(Date.UTC(
          mealDate.getFullYear(),
          mealDate.getMonth(),
          mealDate.getDate(),
          0, 0, 0, 0,
        ));

        const startDateUTC = new Date(Date.UTC(
          startDate.getFullYear(),
          startDate.getMonth(),
          startDate.getDate(),
          0, 0, 0, 0,
        ));

        const endDateUTC = new Date(Date.UTC(
          endDate.getFullYear(),
          endDate.getMonth(),
          endDate.getDate(),
          23, 59, 59, 999,
        ));

        // Check if meal falls within the requested range
        if (mealDateUTC >= startDateUTC && mealDateUTC <= endDateUTC) {
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
