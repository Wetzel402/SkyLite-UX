import { consola } from "consola";
import { createError, defineEventHandler, getQuery, getRouterParam } from "h3";

import prisma from "~/lib/prisma";

import { GoogleCalendarServerService } from "../../../../integrations/google_calendar/client";
import { getGoogleOAuthConfig } from "../../../../utils/googleOAuthConfig";

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, "eventId");
  const { integrationId, calendarId } = getQuery(event) as { integrationId?: string; calendarId?: string };

  if (!eventId) {
    throw createError({
      statusCode: 400,
      message: "eventId is required",
    });
  }

  if (!integrationId) {
    throw createError({
      statusCode: 400,
      message: "integrationId is required",
    });
  }

  const integration = await prisma.integration.findFirst({
    where: {
      id: integrationId,
      type: "calendar",
      service: "google",
      enabled: true,
    },
  });

  if (!integration) {
    throw createError({
      statusCode: 404,
      message: "Google Calendar integration not found",
    });
  }

  if (!integration.apiKey) {
    throw createError({
      statusCode: 400,
      message: "Google Calendar integration is not authenticated",
    });
  }

  // Get OAuth credentials from runtime config or environment variables
  const oauthConfig = getGoogleOAuthConfig();
  if (!oauthConfig) {
    throw createError({
      statusCode: 500,
      message: "Google Calendar integration is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.",
    });
  }
  const { clientId, clientSecret } = oauthConfig;

  const settings = integration.settings as Record<string, unknown> || {};
  const accessToken = settings.accessToken as string;
  const tokenExpiry = settings.tokenExpiry as number;

  const onTokenRefresh = async (id: string, newAccessToken: string, newExpiry: number) => {
    try {
      const existingIntegration = await prisma.integration.findUnique({ where: { id } });
      if (!existingIntegration)
        return;

      const currentSettings = (existingIntegration.settings as Record<string, unknown>) || {};
      await prisma.integration.update({
        where: { id },
        data: {
          settings: {
            ...currentSettings,
            accessToken: newAccessToken,
            tokenExpiry: newExpiry,
          },
        },
      });
    }
    catch (error) {
      consola.error(`Failed to save refreshed token for integration ${id}:`, error);
    }
  };

  const service = new GoogleCalendarServerService(
    clientId,
    clientSecret,
    integration.apiKey,
    accessToken,
    tokenExpiry,
    integrationId,
    onTokenRefresh,
  );

  try {
    // Use eventId directly - Google Calendar IDs should not be split on "-"
    // For recurring event instances, use the event's recurringEventId and originalStartTime fields

    if (calendarId) {
      await service.deleteEvent(calendarId, eventId);
      return { success: true };
    }

    try {
      const primaryEvent = await service.fetchEvent("primary", eventId);
      const calId = primaryEvent.calendarId || "primary";
      await service.deleteEvent(calId, eventId);
      return { success: true };
    }
    catch {}

    const calendars = await service.listCalendars();
    for (const cal of calendars) {
      try {
        await service.fetchEvent(cal.id, eventId);
        await service.deleteEvent(cal.id, eventId);
        return { success: true };
      }
      catch {}
    }

    throw createError({ statusCode: 404, message: "Event not found in any calendar" });
  }
  catch (error) {
    consola.error(`Failed to delete Google Calendar event ${eventId}:`, error);
    const statusCode = (error as { statusCode?: number }).statusCode || 500;
    throw createError({
      statusCode,
      message: error instanceof Error ? error.message : "Failed to delete event",
    });
  }
});
