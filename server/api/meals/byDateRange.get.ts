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

    // Parse dates as UTC to avoid timezone issues
    // Accept both YYYY-MM-DD format and ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)
    let startDate: Date;
    let endDate: Date;

    // Check if it's an ISO 8601 format (contains 'T')
    if (startDateStr.includes("T")) {
      startDate = new Date(startDateStr);
      // Normalize to start of day in UTC
      startDate = new Date(Date.UTC(
        startDate.getUTCFullYear(),
        startDate.getUTCMonth(),
        startDate.getUTCDate(),
        0,
        0,
        0,
        0,
      ));
    }
    else {
      // Parse YYYY-MM-DD format explicitly as UTC
      const startParts = startDateStr.split("-").map(Number);

      if (startParts.length !== 3) {
        throw createError({
          statusCode: 400,
          message: "Invalid date format. Use YYYY-MM-DD or ISO 8601 format",
        });
      }

      const [startYear, startMonth, startDay] = startParts as [number, number, number];
      startDate = new Date(Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0, 0));
    }

    if (endDateStr.includes("T")) {
      endDate = new Date(endDateStr);
      // Normalize to end of day in UTC for inclusive range
      endDate = new Date(Date.UTC(
        endDate.getUTCFullYear(),
        endDate.getUTCMonth(),
        endDate.getUTCDate(),
        23,
        59,
        59,
        999,
      ));
    }
    else {
      // Parse YYYY-MM-DD format explicitly as UTC
      const endParts = endDateStr.split("-").map(Number);

      if (endParts.length !== 3) {
        throw createError({
          statusCode: 400,
          message: "Invalid date format. Use YYYY-MM-DD or ISO 8601 format",
        });
      }

      const [endYear, endMonth, endDay] = endParts as [number, number, number];
      endDate = new Date(Date.UTC(endYear, endMonth - 1, endDay, 23, 59, 59, 999));
    }

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw createError({
        statusCode: 400,
        message: "Invalid date format. Use YYYY-MM-DD or ISO 8601 format",
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
          mealDate.getUTCFullYear(),
          mealDate.getUTCMonth(),
          mealDate.getUTCDate(),
          0,
          0,
          0,
          0,
        ));

        const startDateUTC = new Date(Date.UTC(
          startDate.getUTCFullYear(),
          startDate.getUTCMonth(),
          startDate.getUTCDate(),
          0,
          0,
          0,
          0,
        ));

        const endDateUTC = new Date(Date.UTC(
          endDate.getUTCFullYear(),
          endDate.getUTCMonth(),
          endDate.getUTCDate(),
          23,
          59,
          59,
          999,
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
