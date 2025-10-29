import { PrismaClient } from "@prisma/client";
import { consola } from "consola";
import { createError, defineEventHandler, getQuery, getRouterParam } from "h3";

import { GoogleCalendarServerService } from "../../../../integrations/google_calendar/client";

const prisma = new PrismaClient();

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

  const settings = integration.settings as Record<string, unknown> || {};
  const clientId = settings.clientId as string;
  const clientSecret = settings.clientSecret as string || "";
  const accessToken = settings.accessToken as string;
  const tokenExpiry = settings.tokenExpiry as number;

  if (!clientId) {
    throw createError({
      statusCode: 400,
      message: "Client ID not found in integration settings",
    });
  }

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
    const baseEventId = eventId.includes("-") ? (eventId.split("-")[0] || eventId) : eventId;

    if (calendarId) {
      await service.deleteEvent(calendarId, baseEventId);
      return { success: true };
    }

    try {
      const primaryEvent = await service.fetchEvent("primary", baseEventId);
      const calId = primaryEvent.calendarId || "primary";
      await service.deleteEvent(calId, baseEventId);
      return { success: true };
    }
    catch {}

    const calendars = await service.listCalendars();
    for (const cal of calendars) {
      try {
        await service.fetchEvent(cal.id, baseEventId);
        await service.deleteEvent(cal.id, baseEventId);
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
