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

    const mealPlan = await prisma.mealPlan.findUnique({
      where: { weekStart: new Date(weekStart) },
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
