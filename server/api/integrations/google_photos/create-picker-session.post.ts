import { consola } from "consola";

import prisma from "~/lib/prisma";

import { GooglePhotosServerService } from "../../../integrations/google_photos";
import { getGoogleOAuthConfig } from "../../../utils/googleOAuthConfig";

export default defineEventHandler(async (_event) => {
  try {
    consola.info("Creating Google Photos Picker session...");

    // Find the Google Photos integration
    const integration = await prisma.integration.findFirst({
      where: {
        type: "photos",
        service: "google",
        enabled: true,
      },
    });

    if (!integration) {
      consola.error("Google Photos integration not found");
      throw createError({
        statusCode: 404,
        message: "Google Photos integration not found",
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

    // Guard against null/missing settings
    if (!integration.settings) {
      consola.error("Integration settings are missing");
      throw createError({
        statusCode: 401,
        message: "Integration settings are missing. Please re-authorize the integration.",
      });
    }

    const settings = integration.settings as {
      accessToken?: string;
      refreshToken?: string;
      expiryDate?: number;
    };

    if (!settings.refreshToken) {
      consola.error("No refresh token in settings");
      throw createError({
        statusCode: 401,
        message: "No refresh token available. Please re-authorize the integration.",
      });
    }

    // Create service with token refresh callback
    const service = new GooglePhotosServerService(
      oauthConfig.clientId,
      oauthConfig.clientSecret,
      settings.refreshToken,
      settings.accessToken,
      settings.expiryDate,
      integration.id,
      async (integrationId, accessToken, expiry) => {
        // Persist refreshed token to database
        await prisma.integration.update({
          where: { id: integrationId },
          data: {
            settings: {
              ...settings,
              accessToken,
              expiryDate: expiry,
            },
          },
        });
      },
    );

    // Create picker session (handles token refresh automatically)
    const { sessionId, pickerUri } = await service.createPickerSession();

    return { sessionId, pickerUri };
  }
  catch (error: any) {
    if (error.statusCode) {
      throw error;
    }

    consola.error("Failed to create picker session:", error);
    throw createError({
      statusCode: 500,
      message: `Failed to create picker session: ${error.message || error}`,
    });
  }
});
