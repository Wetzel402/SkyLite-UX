import prisma from "~/lib/prisma";

export default defineEventHandler(async (_event) => {
  try {
    const mealPlans = await prisma.mealPlan.findMany({
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
      orderBy: {
        weekStart: "desc",
      },
    });

    return mealPlans;
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to fetch meal plans: ${error}`,
    });
  }
});
