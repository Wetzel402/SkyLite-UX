import { createError, defineEventHandler, getQuery } from "h3";

import prisma from "~/lib/prisma";

import type { GoogleCalendarSettings } from "../../../integrations/google-calendar/types";

import { GoogleCalendarServerService } from "../../../integrations/google-calendar";

/**
 * Fetch events from Google Calendar for an integration
 * Used by sync manager to periodically fetch events
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const integrationId = query.integrationId as string;

  if (!integrationId) {
    throw createError({
      statusCode: 400,
      message: "Integration ID required",
    });
  }

  try {
    // Fetch integration from database
    const integration = await prisma.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration || integration.service !== "google-calendar") {
      throw createError({
        statusCode: 404,
        message: "Google Calendar integration not found",
      });
    }

    if (!integration.accessToken || !integration.refreshToken) {
      throw createError({
        statusCode: 400,
        message: "Integration missing OAuth tokens",
      });
    }

    // Create service instance
    const service = new GoogleCalendarServerService(
      integration.id,
      integration.accessToken,
      integration.refreshToken,
      integration.tokenExpiry,
      integration.settings as GoogleCalendarSettings,
    );

    await service.initialize();
    const googleEvents = await service.getEvents();

    // Convert to CalendarEvent format
    const calendarEvents = googleEvents.map(ge => service.convertToCalendarEvent(ge));

    return { events: calendarEvents };
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : "Failed to fetch events",
    });
  }
});
