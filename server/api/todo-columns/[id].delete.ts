import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, "id");

    if (!id) {
      throw createError({
        statusCode: 400,
        message: "Todo column ID is required",
      });
    }

    const existingColumn = await prisma.todoColumn.findUnique({
      where: { id },
      include: {
        todos: true,
      },
    });

    if (!existingColumn) {
      throw createError({
        statusCode: 404,
        message: "Todo column not found",
      });
    }

    if (existingColumn.userId) {
      throw createError({
        statusCode: 400,
        message: "Cannot delete user columns",
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.todo.deleteMany({
        where: { todoColumnId: id },
      });

      await tx.todoColumn.delete({
        where: { id },
      });
    });

    return { success: true };
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to delete todo column: ${error}`,
    });
  }
});
