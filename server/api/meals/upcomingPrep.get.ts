import { consola } from "consola";
import { startOfDay, subDays } from "date-fns";

import prisma from "~/lib/prisma";

export default defineEventHandler(async (_event) => {
  try {
    const today = startOfDay(new Date());
    // Only look back 30 days to avoid fetching excessive historical data
    const lookbackDate = subDays(today, 30);

    // Get meal plans with meals that need preparation (limited to last 30 days)
    const mealPlans = await prisma.mealPlan.findMany({
      where: {
        weekStart: {
          gte: lookbackDate,
          lte: today,
        },
      },
      include: {
        meals: {
          where: {
            daysInAdvance: {
              gt: 0,
            },
            completed: false,
          },
        },
      },
    });

    // Filter meals that need preparation today or in the past
    const upcomingMeals = mealPlans.flatMap((plan) => {
      return plan.meals.filter((meal) => {
        const mealDate = new Date(plan.weekStart);
        mealDate.setDate(mealDate.getDate() + meal.dayOfWeek);
        const prepDate = new Date(mealDate);
        prepDate.setDate(prepDate.getDate() - meal.daysInAdvance);

        return prepDate <= today;
      }).map(meal => ({
        ...meal,
        weekStart: plan.weekStart,
      }));
    });

    return upcomingMeals;
  }
  catch (error) {
    // Log server error and return generic message
    consola.error("Failed to fetch upcoming preparation meals:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to fetch upcoming preparation meals",
    });
  }
});
