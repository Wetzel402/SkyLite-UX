import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, "id");
    const body = await readBody(event);

    if (!id) {
      throw createError({
        statusCode: 400,
        message: "Todo column ID is required",
      });
    }

    const todoColumn = await prisma.todoColumn.update({
      where: { id },
      data: {
        name: body.name,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        todos: true,
        _count: {
          select: {
            todos: true,
          },
        },
      },
    });

    return todoColumn;
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to update todo column: ${error}`,
    });
  }
});
