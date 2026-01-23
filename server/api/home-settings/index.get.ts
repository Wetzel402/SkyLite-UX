import consola from "consola";

import prisma from "~/lib/prisma";

export default defineEventHandler(async () => {
  try {
    consola.info("Fetching home settings");

    // Use atomic upsert to get or create singleton HomeSettings
    const settings = await prisma.homeSettings.upsert({
      where: { singletonId: 1 },
      update: {},
      create: { singletonId: 1 },
    });

    consola.success("Home settings fetched successfully");
    return settings;
  }
  catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    consola.error("Failed to fetch home settings:", errorMessage);

    throw createError({
      statusCode: 500,
      message: `Failed to fetch home settings: ${errorMessage}`,
    });
  }
});
