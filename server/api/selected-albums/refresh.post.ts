import { consola } from "consola";

import { GooglePhotosServerService } from "../../../server/integrations/google_photos";
import prisma from "~/lib/prisma";
import { getGoogleOAuthConfig } from "../../../server/utils/googleOAuthConfig";

/**
 * Refresh selected albums to get fresh URLs from Google Photos
 */
export default defineEventHandler(async () => {
  try {
    // Get integration
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

    // Get OAuth config
    const oauthConfig = getGoogleOAuthConfig();
    if (!oauthConfig) {
      throw createError({
        statusCode: 500,
        message: "Google OAuth credentials not configured",
      });
    }

    const settings = integration.settings as {
      accessToken?: string;
      refreshToken?: string;
      expiryDate?: number;
    };

    if (!settings.refreshToken) {
      throw createError({
        statusCode: 401,
        message: "No refresh token available. Please re-authorize the integration.",
      });
    }

    // Create service
    const service = new GooglePhotosServerService(
      oauthConfig.clientId,
      oauthConfig.clientSecret,
      settings.refreshToken,
      settings.accessToken,
      settings.expiryDate,
      integration.id,
      async (integrationId, accessToken, expiry) => {
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

    // Get all selected albums
    const selectedAlbums = await prisma.selectedAlbum.findMany();

    if (selectedAlbums.length === 0) {
      return { success: true, refreshed: 0 };
    }

    consola.info(`Refreshing ${selectedAlbums.length} album URLs...`);

    // Refresh each album's cover photo URL
    let refreshedCount = 0;
    for (const album of selectedAlbums) {
      try {
        // Get fresh album data from Google Photos API
        const accessToken = await service.getAccessToken();

        // Add timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(
          `https://photoslibrary.googleapis.com/v1/albums/${album.albumId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        if (response.ok) {
          const albumData = await response.json();

          // Update the coverPhotoUrl with fresh URL
          await prisma.selectedAlbum.update({
            where: { id: album.id },
            data: {
              coverPhotoUrl: albumData.coverPhotoBaseUrl,
            },
          });

          refreshedCount++;
        } else {
          consola.warn(`Failed to refresh album ${album.albumId}: ${response.status}`);
        }
      } catch (err) {
        consola.error(`Error refreshing album ${album.albumId}:`, err);
      }
    }

    consola.success(`Refreshed ${refreshedCount} album URLs`);

    return { success: true, refreshed: refreshedCount };
  } catch (error: any) {
    consola.error("Error refreshing albums:", error);
    throw createError({
      statusCode: 500,
      message: `Failed to refresh albums: ${error.message || error}`,
    });
  }
});
