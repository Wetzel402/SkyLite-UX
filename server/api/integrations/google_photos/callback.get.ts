import { consola } from "consola";
import { google } from "googleapis";

import prisma from "~/lib/prisma";

import { getGoogleOAuthConfig } from "../../../utils/googleOAuthConfig";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const code = query.code as string;
  const state = query.state as string | undefined;

  if (!code) {
    throw createError({
      statusCode: 400,
      message: "Missing authorization code",
    });
  }

  // Verify CSRF state parameter
  const storedState = getCookie(event, "google_photos_oauth_state");

  if (!state || !storedState || state !== storedState) {
    // Clear the cookie
    deleteCookie(event, "google_photos_oauth_state");

    throw createError({
      statusCode: 403,
      message: "Invalid state parameter - possible CSRF attack",
    });
  }

  // Clear the state cookie after verification
  deleteCookie(event, "google_photos_oauth_state");

  // Get OAuth config
  const oauthConfig = getGoogleOAuthConfig();
  if (!oauthConfig) {
    throw createError({
      statusCode: 500,
      message: "Google OAuth credentials not configured",
    });
  }

  // Determine callback URL using getRequestURL for proxy-safe origin
  const requestUrl = getRequestURL(event, {
    xForwardedHost: true,
    xForwardedProto: true,
  });
  const origin = requestUrl.origin;
  const redirectUri = `${origin}/api/integrations/google_photos/callback`;

  // Initialize OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    oauthConfig.clientId,
    oauthConfig.clientSecret,
    redirectUri,
  );

  try {
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    consola.info("Google Photos OAuth: Token received", {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      scope: tokens.scope,
      expiryDate: tokens.expiry_date,
    });

    // Find existing integration
    const existing = await prisma.integration.findFirst({
      where: {
        type: "photos",
        service: "google",
      },
    });

    // Create or update integration using upsert
    const integration = await prisma.integration.upsert({
      where: {
        id: existing?.id || "",
      },
      update: {
        enabled: true,
        apiKey: tokens.refresh_token,
        settings: {
          accessToken: tokens.access_token,
          tokenExpiry: tokens.expiry_date,
          scope: tokens.scope,
        },
      },
      create: {
        name: "Google Photos",
        type: "photos",
        service: "google",
        enabled: true,
        apiKey: tokens.refresh_token,
        settings: {
          accessToken: tokens.access_token,
          tokenExpiry: tokens.expiry_date,
          scope: tokens.scope,
        },
      },
    });

    consola.success(
      `Google Photos integration ${integration.id} created and authenticated successfully`,
    );

    // Redirect back to settings with success message
    return sendRedirect(
      event,
      `/settings?success=google_photos_added&integrationId=${integration.id}`,
      302,
    );
  }
  catch (error) {
    consola.error("Google Photos OAuth callback error:", error);
    throw createError({
      statusCode: 500,
      message: `OAuth callback failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
});
