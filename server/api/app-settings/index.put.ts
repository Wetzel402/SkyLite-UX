import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    // Get or create the single settings record
    let settings = await prisma.appSettings.findFirst();

    if (!settings) {
      // Create with provided values
      settings = await prisma.appSettings.create({
        data: {
          showMealsOnCalendar: body.showMealsOnCalendar ?? false,
        },
      });
    }
    else {
      // Update existing settings
      settings = await prisma.appSettings.update({
        where: { id: settings.id },
        data: {
          showMealsOnCalendar: body.showMealsOnCalendar,
        },
      });
    }

    return settings;
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to update app settings: ${error}`,
    });
  }
});
