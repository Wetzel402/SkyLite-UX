import { PrismaClient } from "@prisma/client";
import { consola } from "consola";
import { google } from "googleapis";
import { createError, defineEventHandler, readBody } from "h3";

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { integrationId, authCode } = body;

  if (!integrationId || typeof integrationId !== "string") {
    throw createError({
      statusCode: 400,
      message: "integrationId is required",
    });
  }

  if (!authCode || typeof authCode !== "string") {
    throw createError({
      statusCode: 400,
      message: "authCode is required",
    });
  }

  const integration = await prisma.integration.findFirst({
    where: {
      id: integrationId,
      type: "calendar",
      service: "google",
    },
  });

  if (!integration) {
    throw createError({
      statusCode: 404,
      message: "Google Calendar integration not found",
    });
  }

  const settings = integration.settings as Record<string, unknown> || {};
  const clientId = settings.clientId as string;
  const clientSecret = settings.clientSecret as string || "";

  if (!clientId) {
    throw createError({
      statusCode: 400,
      message: "Client ID not found in integration settings",
    });
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    "postmessage",
  );

  try {
    const { tokens } = await oauth2Client.getToken(authCode);

    if (!tokens.refresh_token) {
      throw createError({
        statusCode: 400,
        message: "No refresh token received from Google. Please ensure you're requesting offline access.",
      });
    }

    await prisma.integration.update({
      where: { id: integrationId },
      data: { apiKey: tokens.refresh_token },
    });

    consola.success(`Google Calendar integration ${integrationId} authenticated successfully`);

    return { success: true };
  }
  catch (error) {
    consola.error("Integrations Google Calendar Auth: Failed to exchange auth code:", error);
    throw createError({
      statusCode: 400,
      message: error instanceof Error ? error.message : "Failed to authenticate with Google Calendar",
    });
  }
});
