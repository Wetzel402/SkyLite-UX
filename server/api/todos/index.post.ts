import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    // Get the highest order for this column's todos
    const maxOrder = await prisma.todo.aggregate({
      where: {
        todoColumnId: body.todoColumnId || null,
        completed: false,
      },
      _max: {
        order: true,
      },
    });

    const todo = await prisma.todo.create({
      data: {
        title: body.title,
        description: body.description,
        priority: body.priority || "MEDIUM",
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        todoColumnId: body.todoColumnId,
        order: (maxOrder._max.order || 0) + 1,
      },
      include: {
        todoColumn: {
          select: {
            id: true,
            name: true,
            order: true,
            isDefault: true,
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    return todo;
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to create todo: ${error}`,
    });
  }
});
