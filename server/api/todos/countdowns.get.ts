import consola from "consola";

import prisma from "../../../app/lib/prisma";
import { getHolidayCache, saveHolidayCache } from "../../utils/holidayCache";
import { getNextUpcomingHoliday } from "../../utils/nagerDateApi";

export default defineEventHandler(async (_event) => {
  try {
    const now = new Date();

    // Query for all uncompleted countdown todos with future due dates
    const countdowns = await prisma.todo.findMany({
      where: {
        isCountdown: true,
        completed: false,
        dueDate: {
          gte: now,
        },
      },
      orderBy: {
        dueDate: "asc", // Sort by earliest first
      },
      include: {
        todoColumn: {
          select: {
            id: true,
            name: true,
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    // If user countdowns exist, return them (existing behavior)
    if (countdowns.length > 0) {
      consola.debug(`Found ${countdowns.length} active countdowns`);
      return countdowns;
    }

    // No user countdowns - check for holiday fallback
    consola.debug("No user countdowns found, checking for holiday fallback");

    // Get app settings for holiday configuration
    const appSettings = await prisma.appSettings.findFirst();

    // If holiday countdowns are disabled or no settings, return empty array
    if (!appSettings || !appSettings.enableHolidayCountdowns) {
      consola.debug("Holiday countdowns disabled or no settings found");
      return [];
    }

    const { holidayCountryCode, holidaySubdivisionCode } = appSettings;

    // Try to get cached holiday first
    let holiday = await getHolidayCache(
      holidayCountryCode,
      holidaySubdivisionCode ?? undefined,
    );

    // If no valid cache, fetch from API
    if (!holiday) {
      consola.debug("No valid holiday cache, fetching from API");
      const apiHoliday = await getNextUpcomingHoliday(
        holidayCountryCode,
        holidaySubdivisionCode ?? undefined,
      );

      if (!apiHoliday) {
        consola.debug("No upcoming holidays found");
        return [];
      }

      // Save to cache
      const holidayDate = new Date(apiHoliday.date);
      const cachedUntil = new Date(holidayDate);
      cachedUntil.setHours(23, 59, 59, 999); // End of holiday day

      holiday = await saveHolidayCache({
        countryCode: holidayCountryCode,
        subdivisionCode: holidaySubdivisionCode ?? null,
        holidayName: apiHoliday.name,
        holidayDate,
        cachedUntil,
      });

      consola.debug(`Cached holiday: ${holiday.holidayName} on ${holidayDate}`);
    }

    // Return holiday as a countdown with isHoliday flag
    return [
      {
        id: `holiday-${holiday.id}`,
        title: holiday.holidayName,
        description: null,
        completed: false,
        priority: "MEDIUM",
        dueDate: holiday.holidayDate,
        order: 0,
        isCountdown: true,
        countdownMessage: null,
        messageGeneratedAt: null,
        todoColumnId: null,
        createdAt: holiday.createdAt,
        updatedAt: holiday.updatedAt,
        todoColumn: null,
        isHoliday: true,
      },
    ];
  }
  catch (error) {
    consola.error("Failed to fetch countdowns:", error);
    throw createError({
      statusCode: 500,
      message: `Failed to fetch countdowns: ${error}`,
    });
  }
});
