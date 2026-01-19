import { consola } from "consola";
import { google } from "googleapis";
import { createError, defineEventHandler, getQuery, sendRedirect } from "h3";

import prisma from "~/lib/prisma";

import { getGoogleOAuthConfig } from "../../../utils/googleOAuthConfig";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const code = query.code as string;
  const state = query.state as string;
  const error = query.error as string;

  if (error) {
    consola.error("Google Photos OAuth callback error:", error);
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

    // Get OAuth credentials from runtime config or environment variables
    const oauthConfig = getGoogleOAuthConfig();
    if (!oauthConfig) {
      throw createError({
        statusCode: 500,
        message: "Google Photos integration is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.",
      });
    }
    const { clientId, clientSecret } = oauthConfig;

    let existingIntegration;

    if (isReAuth && integrationId) {
      existingIntegration = await prisma.integration.findFirst({
        where: {
          id: integrationId,
          type: "photos",
          service: "google",
        },
      });

      if (!existingIntegration) {
        throw createError({
          statusCode: 404,
          message: "Integration not found",
        });
      }
    }

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri,
    );

    const { tokens } = await oauth2Client.getToken(code);

    // Log token info for debugging (scope tells us what permissions were granted)
    consola.info("Google Photos OAuth: Token received", {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      scope: tokens.scope,
      expiryDate: tokens.expiry_date,
    });

    // Check if the Photos scope was actually granted
    if (!tokens.scope?.includes("photoslibrary")) {
      consola.warn("Google Photos OAuth: Photos scope NOT granted! Scope received:", tokens.scope);
      consola.warn("This usually means the photoslibrary.readonly scope is not added to your OAuth consent screen in Google Cloud Console.");
    }

    let integration;

    if (isReAuth && integrationId && existingIntegration) {
      // During reauth, keep existing refresh token if new one not provided
      const refreshToken = tokens.refresh_token || existingIntegration.apiKey;

      if (!refreshToken) {
        throw createError({
          statusCode: 400,
          message: "No refresh token available. Please try reconnecting Google Photos.",
        });
      }

      const existingSettings = existingIntegration.settings as Record<string, unknown> || {};
      // Remove needsReauth flag by destructuring it out
      const { needsReauth: _, ...cleanSettings } = existingSettings;
      integration = await prisma.integration.update({
        where: { id: integrationId },
        data: {
          apiKey: refreshToken,
          settings: {
            ...cleanSettings,
            accessToken: tokens.access_token,
            tokenExpiry: tokens.expiry_date,
          },
        },
      });

      consola.success(`Google Photos integration ${integration.id} re-authenticated successfully`);
    }
    else {
      // New integration requires refresh token
      if (!tokens.refresh_token) {
        throw createError({
          statusCode: 400,
          message: "No refresh token received from Google. Please ensure you're requesting offline access.",
        });
      }

      // Extract only non-sensitive settings
      const safeSettings = settings || {};

      integration = await prisma.integration.create({
        data: {
          name,
          type,
          service,
          apiKey: tokens.refresh_token,
          baseUrl: null,
          icon: "https://unpkg.com/lucide-static@latest/icons/image.svg",
          enabled,
          settings: {
            ...safeSettings,
            accessToken: tokens.access_token,
            tokenExpiry: tokens.expiry_date,
            selectedAlbums: [],
          },
        },
      });

      consola.success(`Google Photos integration ${integration.id} created and authenticated successfully`);
    }

    return sendRedirect(event, `/settings?success=google_photos_added&integrationId=${integration.id}`);
  }
  catch (error) {
    consola.error("Google Photos OAuth callback: Failed to process:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to authenticate with Google Photos";
    return sendRedirect(event, `/settings?error=${encodeURIComponent(errorMessage)}`);
  }
});
