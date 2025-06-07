import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, "id");

    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: "Todo column ID is required",
      });
    }

    // Check if the column exists and get its details
    const existingColumn = await prisma.todoColumn.findUnique({
      where: { id },
      include: {
        todos: true,
      },
    });

    if (!existingColumn) {
      throw createError({
        statusCode: 404,
        statusMessage: "Todo column not found",
      });
    }

    // Prevent deletion of user columns (columns with userId) and default columns (unassigned)
    if (existingColumn.userId || existingColumn.isDefault) {
      throw createError({
        statusCode: 400,
        statusMessage: "Cannot delete user columns or the default unassigned column",
      });
    }

    // Delete column and handle todos in a transaction
    await prisma.$transaction(async (tx) => {
      // If the column has todos, move them to the unassigned column
      if (existingColumn.todos.length > 0) {
        // Find or create the unassigned column
        let unassignedColumn = await tx.todoColumn.findFirst({
          where: { isDefault: true },
        });

        if (!unassignedColumn) {
          // Create unassigned column if it doesn't exist
          unassignedColumn = await tx.todoColumn.create({
            data: {
              name: "Unassigned",
              isDefault: true,
              order: 0,
            },
          });
        }

        // Move all todos from the column being deleted to the unassigned column
        await tx.todo.updateMany({
          where: { todoColumnId: id },
          data: { todoColumnId: unassignedColumn.id },
        });
      }

      // Delete the column
      await tx.todoColumn.delete({
        where: { id },
      });
    });

    return { success: true };
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to delete todo column: ${error}`,
    });
  }
});
