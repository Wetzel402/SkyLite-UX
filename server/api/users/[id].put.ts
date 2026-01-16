import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  const id = event.context.params?.id;
  if (!id) {
    throw createError({ statusCode: 400, message: "User ID is required" });
  }
  const body = await readBody(event);

  try {
    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: {
          name: body.name,
          email: body.email && body.email.trim() ? body.email.trim() : null,
          avatar: body.avatar || null,
          color: body.color || null,
          role: body.role ?? undefined,
          todoOrder: body.todoOrder ?? undefined,
        },
      }),
      ...(body.name
        ? [
            prisma.todoColumn.updateMany({
              where: { userId: id },
              data: { name: body.name },
            }),
          ]
        : []),
    ]);
    return updatedUser;
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to update user: ${error}`,
    });
  }
});
