import { consola } from "consola";

import prisma from "~/lib/prisma";

import { invalidateHolidayCache } from "../../utils/holidayCache";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    // Validate showMealsOnCalendar field
    if (body.showMealsOnCalendar !== undefined && typeof body.showMealsOnCalendar !== "boolean") {
      throw createError({
        statusCode: 400,
        message: "showMealsOnCalendar must be a boolean value",
      });
    }

    // Get or create the single settings record
    let settings = await prisma.appSettings.findFirst();

    // Fetch current settings BEFORE update to detect actual changes
    const currentSettings = settings;

    // Detect actual changes
    const locationChanged
      = ("holidayCountryCode" in body && body.holidayCountryCode !== currentSettings?.holidayCountryCode)
        || ("holidaySubdivisionCode" in body && body.holidaySubdivisionCode !== currentSettings?.holidaySubdivisionCode);

    // Only invalidate when location actually changed
    if (currentSettings && locationChanged) {
      if (currentSettings.holidayCountryCode) {
        consola.info("Invalidating holiday cache due to settings change");
        try {
          await invalidateHolidayCache(
            currentSettings.holidayCountryCode,
            currentSettings.holidaySubdivisionCode ?? undefined,
          );
        }
        catch (error) {
          consola.error("Failed to invalidate holiday cache:", error);
          // Continue with update despite cache invalidation failure
        }
      }
    }

    if (!settings) {
      // Create with provided values
      settings = await prisma.appSettings.create({
        data: {
          showMealsOnCalendar: body.showMealsOnCalendar ?? false,
          holidayCountryCode: body.holidayCountryCode,
          holidaySubdivisionCode: body.holidaySubdivisionCode,
          enableHolidayCountdowns: body.enableHolidayCountdowns,
        },
      });
    }
    else {
      // Update existing settings
      settings = await prisma.appSettings.update({
        where: { id: settings.id },
        data: {
          showMealsOnCalendar: body.showMealsOnCalendar,
          holidayCountryCode: body.holidayCountryCode,
          holidaySubdivisionCode: body.holidaySubdivisionCode,
          enableHolidayCountdowns: body.enableHolidayCountdowns,
        },
      });
    }

    return settings;
  }
  catch (error) {
    // Re-throw validation errors (H3 errors with statusCode)
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }

    // Log server error and return generic message
    consola.error("Failed to update app settings:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to update app settings",
    });
  }
});
