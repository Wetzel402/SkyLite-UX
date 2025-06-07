import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    // Get the highest order for proper positioning
    const maxOrder = await prisma.todoColumn.aggregate({
      _max: {
        order: true,
      },
    });

    const todoColumn = await prisma.todoColumn.create({
      data: {
        name: body.name,
        userId: body.userId || null,
        isDefault: body.isDefault || false,
        order: ((maxOrder._max?.order) || 0) + 1,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        _count: {
          select: { todos: true },
        },
      },
    });

    return todoColumn;
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to create todo column: ${error}`,
    });
  }
});
