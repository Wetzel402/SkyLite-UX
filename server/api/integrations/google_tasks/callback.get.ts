import { consola } from "consola";
import { google } from "googleapis";
import prisma from "~/lib/prisma";
import { getGoogleOAuthConfig } from "../../../utils/googleOAuthConfig";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const code = query.code as string;

  if (!code) {
    throw createError({
      statusCode: 400,
      message: "Missing authorization code",
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

    const integration = await prisma.integration.upsert({
      where: {
        id: existing?.id || "",
      },
      update: {
        enabled: true,
        apiKey: tokens.refresh_token, // Store refresh token
        settings: {
          accessToken: tokens.access_token,
          expiryDate: tokens.expiry_date,
          scope: tokens.scope,
        },
      },
      create: {
        name: "Google Tasks",
        type: "tasks",
        service: "google",
        enabled: true,
        apiKey: tokens.refresh_token,
        settings: {
          accessToken: tokens.access_token,
          expiryDate: tokens.expiry_date,
          scope: tokens.scope,
        },
      },
    });

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
