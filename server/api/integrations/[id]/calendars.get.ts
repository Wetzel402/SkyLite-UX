import { PrismaClient } from "@prisma/client";
import { consola } from "consola";
import { createError, defineEventHandler, getRouterParam } from "h3";

import { isGoogleApiError } from "~/types/errors";

import { GoogleCalendarServerService } from "../../../integrations/google_calendar/client";

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  const integrationId = getRouterParam(event, "id");
  if (!integrationId)
    throw createError({ statusCode: 400, message: "integration id required" });

  if (integrationId === "temp") {
    throw createError({
      statusCode: 400,
      message: "Cannot fetch calendars for temporary integration. Please complete OAuth authentication first.",
    });
  }

  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });

  if (
    !integration
    || integration.type !== "calendar"
    || integration.service !== "google"
  ) {
    throw createError({
      statusCode: 404,
      message: "Integration not found or does not support listing calendars",
    });
  }

  if (!integration.apiKey) {
    throw createError({
      statusCode: 400,
      message: "Integration is not authenticated. Please complete OAuth flow.",
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
    const rawCalendars = await service.listCalendars();
    const calendars = rawCalendars.map(cal => ({
      id: cal.id,
      summary: cal.summary,
      backgroundColor: cal.backgroundColor,
      accessRole: cal.accessRole,
    }));
    return { calendars };
  }
  catch (error: unknown) {
    const err = isGoogleApiError(error) ? error : { message: String(error) };

    consola.error("Integrations Calendars: Error details:", {
      code: err?.code,
      message: err?.message,
      response: err?.response?.data,
    });

    if (err?.code === 401 || err?.message?.includes("invalid_grant") || err?.message?.includes("Invalid Credentials")) {
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
        message: "Authentication expired. Please re-authorize in Settings.",
      });
    }

    consola.error("Integrations Calendars: Failed to list calendars:", error);
    throw createError({
      statusCode: 400,
      message: error instanceof Error ? error.message : "Failed to list calendars",
    });
  }
});
