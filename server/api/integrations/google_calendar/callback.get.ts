import { PrismaClient } from "@prisma/client";
import { consola } from "consola";
import { google } from "googleapis";
import { createError, defineEventHandler, getQuery, sendRedirect } from "h3";

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const code = query.code as string;
  const state = query.state as string;
  const error = query.error as string;

  if (error) {
    consola.error("Google OAuth callback error:", error);
    return sendRedirect(event, `/settings?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    throw createError({
      statusCode: 400,
      message: "Authorization code is required",
    });
  }

  if (!state) {
    throw createError({
      statusCode: 400,
      message: "State parameter is required",
    });
  }

  try {
    const integrationData = JSON.parse(decodeURIComponent(state));
    const { name, type, service, enabled, settings, redirectUri, integrationId } = integrationData;
    const clientId = settings?.clientId;
    const clientSecret = settings?.clientSecret;
    const isReAuth = !!integrationId;

    if (!clientId) {
      throw createError({
        statusCode: 400,
        message: "Client ID not found in integration data",
      });
    }

    if (!clientSecret) {
      throw createError({
        statusCode: 400,
        message: "Client Secret not found in integration data",
      });
    }

    if (!redirectUri) {
      throw createError({
        statusCode: 400,
        message: "Redirect URI not found in state data",
      });
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri,
    );

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      throw createError({
        statusCode: 400,
        message: "No refresh token received from Google. Please ensure you're requesting offline access.",
      });
    }

    let integration;

    if (isReAuth && integrationId) {
      integration = await prisma.integration.update({
        where: { id: integrationId },
        data: {
          apiKey: tokens.refresh_token,
          settings: {
            ...settings,
            accessToken: tokens.access_token,
            tokenExpiry: tokens.expiry_date,
            needsReauth: undefined,
          },
        },
      });

      consola.success(`Google Calendar integration ${integration.id} re-authenticated successfully`);
    }
    else {
      integration = await prisma.integration.create({
        data: {
          name,
          type,
          service,
          apiKey: tokens.refresh_token,
          baseUrl: null,
          icon: null,
          enabled,
          settings: {
            ...settings,
            accessToken: tokens.access_token,
            tokenExpiry: tokens.expiry_date,
            needsReauth: undefined,
          },
        },
      });

      consola.success(`Google Calendar integration ${integration.id} created and authenticated successfully`);
    }

    return sendRedirect(event, `/settings?success=google_calendar_added&integrationId=${integration.id}`);
  }
  catch (error) {
    consola.error("Google Calendar OAuth callback: Failed to process:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to authenticate with Google Calendar";
    return sendRedirect(event, `/settings?error=${encodeURIComponent(errorMessage)}`);
  }
});
