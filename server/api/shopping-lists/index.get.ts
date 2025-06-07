import prisma from "~/lib/prisma";

export default defineEventHandler(async (_event) => {
  try {
    const shoppingLists = await prisma.shoppingList.findMany({
      include: {
        items: {
          orderBy: [
            { order: "asc" },
            { checked: "asc" },
          ],
        },
        _count: {
          select: { items: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return shoppingLists;
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to fetch shopping list: ${error}`,
    });
  }
});
