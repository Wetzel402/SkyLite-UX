import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { itemId, direction } = body;

    if (!itemId || !direction) {
      throw createError({
        statusCode: 400,
        statusMessage: "Item ID and direction are required",
      });
    }

    // Get the current item
    const currentItem = await prisma.shoppingListItem.findUnique({
      where: { id: itemId },
    });

    if (!currentItem) {
      throw createError({
        statusCode: 404,
        statusMessage: "Shopping list item not found",
      });
    }

    // Get all items for the same shopping list
    const items = await prisma.shoppingListItem.findMany({
      where: {
        shoppingListId: currentItem.shoppingListId,
      },
      orderBy: { order: "asc" },
    });

    // Find current position
    const currentIndex = items.findIndex(item => item.id === itemId);
    if (currentIndex === -1)
      return currentItem;

    // Calculate new position
    let targetIndex;
    if (direction === "up" && currentIndex > 0) {
      targetIndex = currentIndex - 1;
    }
    else if (direction === "down" && currentIndex < items.length - 1) {
      targetIndex = currentIndex + 1;
    }
    else {
      return currentItem; // No change needed
    }

    // Simple swap: just exchange the order values of the two adjacent items
    const targetItem = items[targetIndex];
    const tempOrder = currentItem.order;

    await prisma.$transaction([
      prisma.shoppingListItem.update({
        where: { id: itemId },
        data: { order: targetItem.order },
      }),
      prisma.shoppingListItem.update({
        where: { id: targetItem.id },
        data: { order: tempOrder },
      }),
    ]);

    // Return updated item
    const updatedItem = await prisma.shoppingListItem.findUnique({
      where: { id: itemId },
    });

    return updatedItem;
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to reorder shopping list item: ${error}`,
    });
  }
});
