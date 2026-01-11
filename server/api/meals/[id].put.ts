import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, "id");
    const body = await readBody(event);

    if (!id) {
      throw createError({
        statusCode: 400,
        message: "Meal ID is required",
      });
    }

    const meal = await prisma.meal.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        mealType: body.mealType,
        dayOfWeek: body.dayOfWeek,
        daysInAdvance: body.daysInAdvance,
        completed: body.completed,
      },
    });

    return meal;
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to update meal: ${error}`,
    });
  }
});
