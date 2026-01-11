import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    const mealPlan = await prisma.mealPlan.create({
      data: {
        weekStart: new Date(body.weekStart),
        order: body.order || 0,
      },
      include: {
        meals: true,
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
      message: `Failed to create meal plan: ${error}`,
    });
  }
});
