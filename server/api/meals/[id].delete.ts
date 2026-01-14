import { consola } from "consola";
import { Prisma } from "@prisma/client";
import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, "id");

    if (!id) {
      throw createError({
        statusCode: 400,
        message: "Meal ID is required",
      });
    }

    await prisma.meal.delete({
      where: { id },
    });

    return { success: true };
  }
  catch (error) {
    // Re-throw validation errors (H3 errors with statusCode)
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }

    // Handle Prisma not found error as 404
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      consola.error("Meal not found:", error.message);
      throw createError({
        statusCode: 404,
        message: "Meal not found",
      });
    }

    // Log server error and return generic message
    consola.error("Failed to delete meal:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to delete meal",
    });
  }
});
