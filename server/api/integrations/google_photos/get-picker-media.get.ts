import { consola } from "consola";

import prisma from "~/lib/prisma";

import { GooglePhotosServerService } from "../../../integrations/google_photos";
import { getGoogleOAuthConfig } from "../../../utils/googleOAuthConfig";

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const sessionId = query.sessionId as string;

    consola.info("Getting picker media for session:", sessionId);

    if (!sessionId) {
      throw createError({
        statusCode: 400,
        message: "sessionId is required",
      });
    }

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

    // Fetch all pages of media items
    const allMediaItems: any[] = [];
    let nextPageToken: string | undefined;
    let pageCount = 0;

    do {
      pageCount++;

      // Get fresh access token for each page (auto-refreshes if needed)
      const accessToken = await service.getAccessToken();

      const url = nextPageToken
        ? `https://photospicker.googleapis.com/v1/mediaItems?sessionId=${sessionId}&pageToken=${nextPageToken}`
        : `https://photospicker.googleapis.com/v1/mediaItems?sessionId=${sessionId}`;

      consola.info(`Fetching page ${pageCount} from:`, url);

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();

        // Check if this is a "user hasn't picked items" error (expected when picker is closed without selection)
        if (response.status === 400 && errorText.includes("PENDING_USER_ACTION")) {
          consola.info("User closed picker without selecting photos");
          return {
            mediaItems: [],
          };
        }

        consola.error("Failed to get media items:", {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          page: pageCount,
        });
        throw createError({
          statusCode: response.status,
          message: `Failed to get media items: ${response.status} ${response.statusText}`,
        });
      }

      const data = await response.json();
      const mediaItems = data.mediaItems || [];

      consola.info(`Page ${pageCount} received:`, {
        count: mediaItems.length,
        hasNextPageToken: !!data.nextPageToken,
      });

      // Add items from this page
      allMediaItems.push(...mediaItems);

      // Get next page token
      nextPageToken = data.nextPageToken;

      // Safety limit: max 50 pages (should handle up to ~5000 photos)
      if (pageCount >= 50) {
        consola.warn("Reached maximum page limit (50), stopping pagination");
        break;
      }
    } while (nextPageToken);

    consola.success(`Fetched all ${allMediaItems.length} media items across ${pageCount} page(s)`);

    // Log first media item structure for debugging (only once)
    if (allMediaItems.length > 0) {
      consola.info("Sample media item structure:", JSON.stringify(allMediaItems[0], null, 2));
    }

    return {
      mediaItems: allMediaItems,
    };
  }
  catch (error: any) {
    if (error.statusCode) {
      throw error;
    }

    consola.error("Error in get-picker-media:", error);
    throw createError({
      statusCode: 500,
      message: `Failed to get media items: ${error.message || error}`,
    });
  }
});
