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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      throw createError({
        statusCode: 400,
        message: "Invalid date format. Expected YYYY-MM-DD.",
      });
    }

    const parts = weekStart.split("-").map(Number);
    const [year, month, day] = parts as [number, number, number];

    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)
      || month < 1 || month > 12 || day < 1 || day > 31) {
      throw createError({
        statusCode: 400,
        message: "Invalid date values in week start parameter.",
      });
    }

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
