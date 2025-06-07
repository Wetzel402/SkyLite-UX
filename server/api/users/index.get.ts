import prisma from "~/lib/prisma";

export default defineEventHandler(async (_event) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        todoColumn: {
          include: {
            _count: {
              select: { todos: true },
            },
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });
    return users;
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to fetch user: ${error}`,
    });
  }
});
