import { consola } from "consola";
import { google } from "googleapis";
import prisma from "~/lib/prisma";
import { getGoogleOAuthConfig } from "../../../utils/googleOAuthConfig";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const code = query.code as string;
  const state = query.state as string;

  if (!code) {
    throw createError({
      statusCode: 400,
      message: "Missing authorization code",
    });
  }

  // Verify CSRF state token
  const storedState = getCookie(event, "google_tasks_oauth_state");
  deleteCookie(event, "google_tasks_oauth_state");

  if (!storedState || storedState !== state) {
    throw createError({
      statusCode: 403,
      message: "Invalid state parameter - possible CSRF attack",
    });
  }

  const oauthConfig = getGoogleOAuthConfig();
  if (!oauthConfig) {
    throw createError({
      statusCode: 500,
      message: "Google OAuth credentials not configured",
    });
  }

  const requestUrl = getRequestURL(event, {
    xForwardedHost: true,
    xForwardedProto: true,
  });
  const origin = requestUrl.origin;
  const redirectUri = `${origin}/api/integrations/google_tasks/callback`;

  const oauth2Client = new google.auth.OAuth2(
    oauthConfig.clientId,
    oauthConfig.clientSecret,
    redirectUri
  );

  try {
    const { tokens } = await oauth2Client.getToken(code);

    consola.info("Google Tasks OAuth: Token received", {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      scope: tokens.scope,
    });

    const existing = await prisma.integration.findFirst({
      where: {
        type: "tasks",
        service: "google",
      },
    });

    let integration;

    if (existing) {
      // Update existing integration
      integration = await prisma.integration.update({
        where: { id: existing.id },
        data: {
          enabled: true,
          // Preserve existing refresh token if Google didn't provide a new one
          apiKey: tokens.refresh_token ?? existing.apiKey,
          settings: {
            accessToken: tokens.access_token,
            tokenExpiry: tokens.expiry_date,
            scope: tokens.scope,
          },
        },
      });
    }
    else {
      // Create new integration - refresh token is required for offline access
      if (!tokens.refresh_token) {
        throw createError({
          statusCode: 400,
          message: "No refresh token received - offline access not granted",
        });
      }

      integration = await prisma.integration.create({
        data: {
          name: "Google Tasks",
          type: "tasks",
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
    }

    consola.success(`Google Tasks integration ${integration.id} authenticated`);

    return sendRedirect(
      event,
      `/settings?success=google_tasks_added&integrationId=${integration.id}`,
      302
    );
  } catch (error) {
    consola.error("Google Tasks OAuth callback error:", error);
    throw createError({
      statusCode: 500,
      message: `OAuth callback failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
});
