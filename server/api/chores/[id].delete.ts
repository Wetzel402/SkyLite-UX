import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, "id");

    if (!id) {
      throw createError({
        statusCode: 400,
        message: "Chore ID is required",
      });
    }

    // Check if chore exists
    const existingChore = await prisma.chore.findUnique({
      where: { id },
    });

    if (!existingChore) {
      throw createError({
        statusCode: 404,
        message: "Chore not found",
      });
    }

    // Delete chore (completions will cascade delete due to schema)
    await prisma.chore.delete({
      where: { id },
    });

    return { success: true, id };
  }
  catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      message: `Failed to delete chore: ${error}`,
    });
  }
});
