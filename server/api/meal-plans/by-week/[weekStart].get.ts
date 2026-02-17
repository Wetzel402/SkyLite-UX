import prisma from "~/lib/prisma";
import { parseLocalDate } from "~/utils/dateParser";

export default defineEventHandler(async (event) => {
  try {
    const weekStart = getRouterParam(event, "weekStart");

    if (!weekStart) {
      throw createError({
        statusCode: 400,
        message: "Week start date is required",
      });
    }

    const searchDate = parseLocalDate(weekStart);

    // Find meal plan for the week by date range (handles timezone differences)
    const endOfDay = new Date(searchDate);
    endOfDay.setHours(23, 59, 59, 999);

    const mealPlan = await prisma.mealPlan.findFirst({
      where: {
        weekStart: {
          gte: searchDate,
          lte: endOfDay,
        },
      },
      include: {
        meals: {
          orderBy: [
            { dayOfWeek: "asc" },
            { order: "asc" },
          ],
        },
        _count: {
          select: { meals: true },
        },
      },
    });

    return mealPlan;
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to fetch meal plan: ${error}`,
    });
  }
});
