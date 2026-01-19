import prisma from "~/lib/prisma";

export default defineEventHandler(async () => {
  try {
    // Get or create singleton HomeSettings
    let settings = await prisma.homeSettings.findUnique({
      where: { singletonId: 1 },
    });

    if (!settings) {
      settings = await prisma.homeSettings.create({
        data: { singletonId: 1 },
      });
    }

    return settings;
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to fetch home settings: ${error}`,
    });
  }
});
