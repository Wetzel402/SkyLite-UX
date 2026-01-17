import prisma from "~/lib/prisma";

export default defineEventHandler(async () => {
  try {
    // Get or create the single settings record
    let settings = await prisma.appSettings.findFirst();

    if (!settings) {
      // Create default settings if none exist
      settings = await prisma.appSettings.create({
        data: {
          showMealsOnCalendar: false,
        },
      });
    }

    return settings;
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to fetch app settings: ${error}`,
    });
  }
});
