import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { todoIds } = body;

    // Update the order for each todo
    const updatePromises = todoIds.map((id: string, index: number) =>
      prisma.todo.update({
        where: { id },
        data: { order: index },
      }),
    );

    await Promise.all(updatePromises);

    return { success: true };
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to reorder todo: ${error}`,
    });
  }
});
