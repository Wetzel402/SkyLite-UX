import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { itemIds } = body;

    // Update the order for each item
    const updatePromises = itemIds.map((id: string, index: number) =>
      prisma.shoppingListItem.update({
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
      statusMessage: `Failed to reorder shopping list item: ${error}`,
    });
  }
});
