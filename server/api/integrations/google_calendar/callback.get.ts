import { consola } from "consola";
import { google } from "googleapis";
import { createError, defineEventHandler, getQuery, sendRedirect } from "h3";

import prisma from "~/lib/prisma";

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

    // Validate state object structure
    if (!integrationData || typeof integrationData !== "object") {
      throw createError({
        statusCode: 400,
        message: "Invalid state parameter format",
      });
    }

    const { name, type, service, enabled, settings, redirectUri, integrationId } = integrationData;

    // Validate required fields
    if (typeof redirectUri !== "string" || !redirectUri) {
      throw createError({
        statusCode: 400,
        message: "Invalid redirect URI in state data",
      });
    }

    if (typeof enabled !== "boolean") {
      throw createError({
        statusCode: 400,
        message: "Invalid enabled value in state data",
      });
    }

    if (integrationId !== undefined && typeof integrationId !== "string") {
      throw createError({
        statusCode: 400,
        message: "Invalid integration ID in state data",
      });
    }

    const isReAuth = !!integrationId;

    let clientId: string;
    let clientSecret: string;
    let existingIntegration;

    if (isReAuth && integrationId) {
      existingIntegration = await prisma.integration.findFirst({
        where: {
          id: integrationId,
          type: "calendar",
          service: "google",
        },
      });

      if (!existingIntegration) {
        throw createError({
          statusCode: 404,
          message: "Integration not found",
        });
      }

      const dbSettings = existingIntegration.settings as Record<string, unknown> || {};
      clientId = dbSettings.clientId as string;
      clientSecret = dbSettings.clientSecret as string;

      if (!clientId) {
        throw createError({
          statusCode: 400,
          message: "Client ID not found in integration settings",
        });
      }

      if (!clientSecret) {
        throw createError({
          statusCode: 400,
          message: "Client Secret not found in integration settings",
        });
      }
    }
    else {
      clientId = settings?.clientId as string;
      clientSecret = settings?.clientSecret as string;

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

    if (isReAuth && integrationId && existingIntegration) {
      const existingSettings = existingIntegration.settings as Record<string, unknown> || {};
      integration = await prisma.integration.update({
        where: { id: integrationId },
        data: {
          apiKey: tokens.refresh_token,
          settings: {
            ...existingSettings,
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
