import { consola } from "consola";
import { Prisma } from "@prisma/client";
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

    // Validate required fields
    if (!body.name || typeof body.name !== "string" || body.name.trim() === "") {
      throw createError({
        statusCode: 400,
        message: "Name is required and must be a non-empty string",
      });
    }

    if (!body.mealType || !["BREAKFAST", "LUNCH", "DINNER"].includes(body.mealType)) {
      throw createError({
        statusCode: 400,
        message: "Valid meal type is required (BREAKFAST, LUNCH, or DINNER)",
      });
    }

    const dayOfWeek = Number(body.dayOfWeek);
    if (Number.isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      throw createError({
        statusCode: 400,
        message: "Day of week is required and must be a number between 0 and 6",
      });
    }

    const daysInAdvance = body.daysInAdvance !== undefined ? Number(body.daysInAdvance) : 0;
    if (Number.isNaN(daysInAdvance) || daysInAdvance < 0) {
      throw createError({
        statusCode: 400,
        message: "Days in advance must be a non-negative number",
      });
    }

    const maxOrder = await prisma.meal.aggregate({
      where: {
        mealPlanId,
        dayOfWeek,
        mealType: body.mealType,
      },
      _max: {
        order: true,
      },
    });

    const meal = await prisma.meal.create({
      data: {
        name: body.name.trim(),
        description: body.description?.trim() || null,
        mealType: body.mealType,
        dayOfWeek,
        daysInAdvance,
        completed: body.completed === true,
        mealPlanId,
        order: ((maxOrder._max?.order) || 0) + 1,
      },
    });

    return meal;
  }
  catch (error) {
    // Re-throw validation errors (H3 errors with statusCode)
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }

    // Handle Prisma foreign key constraint error
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      consola.error("Meal plan not found:", error.message);
      throw createError({
        statusCode: 404,
        message: "Meal plan not found",
      });
    }

    // Log server error and return generic message
    consola.error("Failed to add meal:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to add meal",
    });
  }
});
