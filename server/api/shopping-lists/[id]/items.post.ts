import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const listId = getRouterParam(event, "id");
    const body = await readBody(event);

    if (!listId) {
      throw createError({
        statusCode: 400,
        statusMessage: "Shopping list ID is required",
      });
    }

    // Get the highest order for this shopping list's items
    const maxOrder = await prisma.shoppingListItem.aggregate({
      where: {
        shoppingListId: listId,
      },
      _max: {
        order: true,
      },
    });

    const item = await prisma.shoppingListItem.create({
      data: {
        name: body.name,
        quantity: body.quantity || 1,
        unit: body.unit,
        notes: body.notes,
        shoppingListId: listId,
        order: ((maxOrder._max?.order) || 0) + 1,
      },
    });

    return item;
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to add item to shopping list: ${error}`,
    });
  }
});
