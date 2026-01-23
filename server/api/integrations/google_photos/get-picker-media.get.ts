import { consola } from "consola";

import prisma from "~/lib/prisma";

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

    const settings = integration.settings as { accessToken?: string };

    if (!settings.accessToken) {
      throw createError({
        statusCode: 401,
        message: "No access token available",
      });
    }

    // Get media items from the picker session
    const url = `https://photospicker.googleapis.com/v1/mediaItems?sessionId=${sessionId}`;
    consola.info("Fetching media items from:", url);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${settings.accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      consola.error("Failed to get media items:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      throw createError({
        statusCode: response.status,
        message: `Failed to get media items: ${response.status} ${response.statusText} - ${errorText}`,
      });
    }

    const data = await response.json();
    consola.info("Media items received:", {
      count: data.mediaItems?.length || 0,
      hasNextPageToken: !!data.nextPageToken,
    });

    // Log first media item structure for debugging
    if (data.mediaItems && data.mediaItems.length > 0) {
      consola.info("Sample media item structure:", JSON.stringify(data.mediaItems[0], null, 2));
    }

    return {
      mediaItems: data.mediaItems || [],
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
