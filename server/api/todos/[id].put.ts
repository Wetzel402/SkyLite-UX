import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, "id");
    const body = await readBody(event);

    if (!id) {
      throw createError({
        statusCode: 400,
        message: "Todo ID is required",
      });
    }

    const todo = await prisma.todo.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        completed: body.completed,
        priority: body.priority,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        todoColumnId: body.todoColumnId,
        order: body.order,
        ...(body.isCountdown !== undefined && { isCountdown: body.isCountdown }),
        ...(body.countdownMessage !== undefined && { countdownMessage: body.countdownMessage }),
        ...(body.messageGeneratedAt !== undefined && { messageGeneratedAt: body.messageGeneratedAt ? new Date(body.messageGeneratedAt) : null }),
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
      message: `Failed to update todo: ${error}`,
    });
  }
});
