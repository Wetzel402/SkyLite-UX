import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, "id");
    const body = await readBody(event);

    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: "Shopping list item ID is required",
      });
    }

    const item = await prisma.shoppingListItem.update({
      where: { id },
      data: {
        name: body.name,
        quantity: body.quantity,
        unit: body.unit,
        checked: body.checked,
        notes: body.notes,
      },
    });

    return item;
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to update shopping list item: ${error}`,
    });
  }
});
