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

    // Parse YYYY-MM-DD as UTC to match how meal plan dates are stored
    const parts = weekStart.split("-").map(Number);
    const [year, month, day] = parts as [number, number, number];
    const searchDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

    // Find meal plan for the week by date range
    const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

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
