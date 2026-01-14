import { consola } from "consola";
import { Prisma } from "@prisma/client";
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

    // Validate required fields
    if (body.name !== undefined && typeof body.name !== "string") {
      throw createError({
        statusCode: 400,
        message: "Name must be a string",
      });
    }

    if (body.mealType !== undefined && !["BREAKFAST", "LUNCH", "DINNER"].includes(body.mealType)) {
      throw createError({
        statusCode: 400,
        message: "Invalid meal type. Must be BREAKFAST, LUNCH, or DINNER",
      });
    }

    if (body.dayOfWeek !== undefined) {
      const dayOfWeek = Number(body.dayOfWeek);
      if (Number.isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
        throw createError({
          statusCode: 400,
          message: "Day of week must be a number between 0 and 6",
        });
      }
    }

    if (body.daysInAdvance !== undefined) {
      const daysInAdvance = Number(body.daysInAdvance);
      if (Number.isNaN(daysInAdvance) || daysInAdvance < 0) {
        throw createError({
          statusCode: 400,
          message: "Days in advance must be a non-negative number",
        });
      }
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
    // Handle Prisma not found error as 404
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      consola.error("Meal not found:", error.message);
      throw createError({
        statusCode: 404,
        message: "Meal not found",
      });
    }

    // Log server error and return generic message
    consola.error("Failed to update meal:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to update meal",
    });
  }
});
