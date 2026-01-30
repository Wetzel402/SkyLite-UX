import consola from "consola";

import prisma from "~/lib/prisma";

export default defineEventHandler(async (_event) => {
  try {
    const now = new Date();

    // Query for all uncompleted countdown todos with future due dates
    const countdowns = await prisma.todo.findMany({
      where: {
        isCountdown: true,
        completed: false,
        dueDate: {
          gte: now,
        },
      },
      orderBy: {
        dueDate: "asc", // Sort by earliest first
      },
      include: {
        todoColumn: {
          select: {
            id: true,
            name: true,
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

    consola.debug(`Found ${countdowns.length} active countdowns`);
    return countdowns;
  }
  catch (error) {
    consola.error("Failed to fetch countdowns:", error);
    throw createError({
      statusCode: 500,
      message: `Failed to fetch countdowns: ${error}`,
    });
  }
});
