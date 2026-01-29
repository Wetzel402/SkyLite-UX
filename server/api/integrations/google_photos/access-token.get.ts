import consola from "consola";

import prisma from "~/lib/prisma";

import { GooglePhotosServerService } from "../../../integrations/google_photos";
import { getGoogleOAuthConfig } from "../../../utils/googleOAuthConfig";

export default defineEventHandler(async (event) => {
  const origin = getHeader(event, "origin");
  const referer = getHeader(event, "referer");
  const host = getHeader(event, "host");

  consola.info("Access token retrieval attempt", {
    origin: origin || "none",
    referer: referer || "none",
    host: host || "none",
  });

  try {
    // TODO: Add authentication gate when user authentication is implemented
    // Example: const user = await getCurrentUser(event);
    // if (!user) { throw createError({ statusCode: 401, message: "Unauthorized" }); }
    // For now, this is a single-user application without authentication

    // Security: Only allow server-side requests (not direct browser calls)
    // Block requests with external origins (CSRF protection)
    if (origin && origin !== `http://${host}` && origin !== `https://${host}`) {
      consola.warn("Access token request blocked - invalid origin", {
        origin,
        host,
      });
      throw createError({
        statusCode: 403,
        message: "Forbidden: Invalid origin",
      });
    }

    // Verify request is from same-site
    if (referer && !referer.startsWith(`http://${host}`) && !referer.startsWith(`https://${host}`)) {
      consola.warn("Access token request blocked - invalid referer", {
        referer,
        host,
      });
      throw createError({
        statusCode: 403,
        message: "Forbidden: Invalid referer",
      });
    }

    consola.info("Access token request passed CSRF checks");

    // Find the Google Photos integration
    const integration = await prisma.integration.findFirst({
      where: {
        type: "photos",
        service: "google",
        enabled: true,
      },
    });

    if (!integration) {
      throw createError({
        statusCode: 404,
        message: "Google Photos integration not found",
      });
    }

    const settings = integration.settings as {
      accessToken?: string;
      tokenExpiry?: number;
    };

    // Check if we have a refresh token
    if (!integration.apiKey) {
      throw createError({
        statusCode: 401,
        message: "Google Photos not authorized. Please authorize first.",
      });
    }

    // Get OAuth config
    const oauthConfig = getGoogleOAuthConfig();
    if (!oauthConfig) {
      throw createError({
        statusCode: 500,
        message: "Google OAuth credentials not configured",
      });
    }

    // Create service to handle token refresh if needed
    const service = new GooglePhotosServerService(
      oauthConfig.clientId,
      oauthConfig.clientSecret,
      integration.apiKey,
      settings.accessToken,
      settings.tokenExpiry,
      integration.id,
      async (integrationId, accessToken, expiry) => {
        await prisma.integration.update({
          where: { id: integrationId },
          data: {
            settings: {
              ...settings,
              accessToken,
              tokenExpiry: expiry,
            },
          },
        });
      },
    );

    // Get access token and expiry (will refresh if needed)
    const { accessToken, expiry } = await service.getAccessTokenWithExpiry();

    consola.success("Access token retrieved successfully", {
      integrationId: integration.id,
      hasToken: true,
    });

    return {
      accessToken,
      expiryDate: expiry,
    };
  }
  catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      consola.error("Access token request denied", {
        statusCode: error.statusCode,
        message: "message" in error ? error.message : "Unknown error",
      });
      throw error;
    }
    consola.error("Failed to get access token", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw createError({
      statusCode: 500,
      message: `Failed to get access token: ${error}`,
    });
  }
});
