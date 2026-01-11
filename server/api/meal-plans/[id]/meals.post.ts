import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const mealPlanId = getRouterParam(event, "id");
    const body = await readBody(event);

    if (!mealPlanId) {
      throw createError({
        statusCode: 400,
        message: "Meal plan ID is required",
      });
    }

    const maxOrder = await prisma.meal.aggregate({
      where: {
        mealPlanId,
        dayOfWeek: body.dayOfWeek,
        mealType: body.mealType,
      },
      _max: {
        order: true,
      },
    });

    const meal = await prisma.meal.create({
      data: {
        name: body.name,
        description: body.description,
        mealType: body.mealType,
        dayOfWeek: body.dayOfWeek,
        daysInAdvance: body.daysInAdvance || 0,
        completed: body.completed || false,
        mealPlanId,
        order: ((maxOrder._max?.order) || 0) + 1,
      },
    });

    return meal;
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to add meal: ${error}`,
    });
  }
});
