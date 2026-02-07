import prisma from "~/lib/prisma";

import { sanitizeIntegration } from "../../utils/sanitizeIntegration";

export default defineEventHandler(async (_event) => {
  try {
    const integrations = await prisma.integration.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return integrations.map(integration => sanitizeIntegration(integration));
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to fetch integration: ${error}`,
    });
  }
});
