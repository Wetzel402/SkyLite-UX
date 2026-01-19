import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const weekStart = getRouterParam(event, "weekStart");

    if (!weekStart) {
      throw createError({
        statusCode: 400,
        message: "Week start date is required",
      });
    }

    // Parse the date and normalize to start of day in UTC
    const searchDate = new Date(weekStart);
    searchDate.setUTCHours(0, 0, 0, 0);

    // Find meal plan for the week by date range (handles timezone differences)
    const endOfDay = new Date(searchDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

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
