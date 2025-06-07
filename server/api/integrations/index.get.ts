import prisma from "~/lib/prisma";

export default defineEventHandler(async (_event) => {
  try {
    const integrations = await prisma.integration.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return integrations;
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to fetch integration: ${error}`,
    });
  }
});
