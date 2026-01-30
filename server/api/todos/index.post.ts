import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

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
        isCountdown: body.isCountdown || false,
        countdownMessage: body.countdownMessage || null,
        messageGeneratedAt: body.messageGeneratedAt ? new Date(body.messageGeneratedAt) : null,
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
      message: `Failed to create todo: ${error}`,
    });
  }
});
