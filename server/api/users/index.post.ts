import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    // Get the highest order for todo columns to set the next available order
    const maxOrder = await prisma.todoColumn.aggregate({
      _max: {
        order: true,
      },
    });

    // Create user and todo column in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the user (convert empty email to null)
      const user = await tx.user.create({
        data: {
          name: body.name,
          email: body.email && body.email.trim() ? body.email.trim() : null,
          avatar: body.avatar || null,
        },
      });

      // Create todo column for the user
      const todoColumn = await tx.todoColumn.create({
        data: {
          name: user.name,
          userId: user.id,
          order: ((maxOrder._max?.order) || 0) + 1,
        },
      });

      return { user, todoColumn };
    });

    return result.user;
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to create user: ${error}`,
    });
  }
});
