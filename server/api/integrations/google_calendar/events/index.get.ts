import { PrismaClient } from "@prisma/client";
import { consola } from "consola";
import { createError, defineEventHandler, getQuery } from "h3";

import { GoogleCalendarServerService } from "../../../../integrations/google_calendar/client";

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  const integrationId = getQuery(event).integrationId as string;

  if (!integrationId || typeof integrationId !== "string") {
    throw createError({
      statusCode: 400,
      message: "integrationId is required",
    });
  }

  if (integrationId === "temp") {
    throw createError({
      statusCode: 400,
      message: "Cannot fetch events for temporary integration. Please complete OAuth authentication first.",
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
      message: "Google Calendar integration not found or not configured",
    });
  }

  if (!integration.apiKey) {
    throw createError({
      statusCode: 400,
      message: "Google Calendar integration is not authenticated. Please complete OAuth flow.",
    });
  }

  const settings = integration.settings as Record<string, unknown> || {};
  const clientId = settings.clientId as string;
  const clientSecret = settings.clientSecret as string || "";
  const accessToken = settings.accessToken as string;
  const tokenExpiry = settings.tokenExpiry as number;
  const calendars = (settings.calendars as { id: string; enabled: boolean }[]) || [];
  const selectedCalendars = calendars.filter(c => c.enabled).map(c => c.id);

  if (selectedCalendars.length === 0) {
    return { events: [], calendars: [] };
  }

  if (!clientId) {
    throw createError({
      statusCode: 400,
      message: "Client ID not found in integration settings",
    });
  }

  const service = new GoogleCalendarServerService(clientId, clientSecret, integration.apiKey, accessToken, tokenExpiry);

  try {
    const events = await service.fetchEvents(selectedCalendars);
    return { events, calendars: settings.calendars || [] };
  }
  catch (error: unknown) {
    const err = error as { code?: number; message?: string; response?: { data?: unknown } };

    consola.error("Integrations Google Calendar Events: Error details:", {
      code: err?.code,
      message: err?.message,
      response: err?.response?.data,
    });

    if (err?.code === 401 || err?.code === 400 || err?.message?.includes("invalid_grant") || err?.message?.includes("invalid_request") || err?.message?.includes("Invalid Credentials")) {
      await prisma.integration.update({
        where: { id: integrationId },
        data: {
          apiKey: null,
          settings: {
            ...(integration.settings as object),
            needsReauth: true,
          },
        },
      });

      throw createError({
        statusCode: 401,
        message: "Google Calendar authentication expired. Please re-authorize in Settings.",
      });
    }

    consola.error("Integrations Google Calendar Events: Failed to fetch events:", error);
    throw createError({
      statusCode: 400,
      message: error instanceof Error ? error.message : "Failed to fetch Google Calendar events",
    });
  }
});
