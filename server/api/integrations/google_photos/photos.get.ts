import { consola } from "consola";
import { google } from "googleapis";
import { createError, defineEventHandler, getQuery } from "h3";

import prisma from "~/lib/prisma";

import { getGoogleOAuthConfig } from "../../../utils/googleOAuthConfig";

export type PhotoItem = {
  id: string;
  baseUrl: string;
  mimeType: string;
  mediaMetadata: {
    creationTime: string;
    width: string;
    height: string;
    photo?: {
      cameraMake?: string;
      cameraModel?: string;
    };
  };
  filename: string;
  productUrl: string;
};

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const integrationId = query.integrationId as string;
  const albumIds = query.albumIds as string; // Comma-separated list
  const pageSize = Math.min(Number(query.pageSize) || 50, 100);
  const pageToken = query.pageToken as string | undefined;

  if (!integrationId) {
    throw createError({
      statusCode: 400,
      message: "Integration ID is required",
    });
  }

  // Get OAuth credentials
  const oauthConfig = getGoogleOAuthConfig();
  if (!oauthConfig) {
    throw createError({
      statusCode: 500,
      message: "Google Photos integration is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.",
    });
  }
  const { clientId, clientSecret } = oauthConfig;

  // Get integration
  const integration = await prisma.integration.findFirst({
    where: {
      id: integrationId,
      type: "photos",
      service: "google",
      enabled: true,
    },
  });

  if (!integration) {
    throw createError({
      statusCode: 404,
      message: "Google Photos integration not found or disabled",
    });
  }

  const refreshToken = integration.apiKey;
  if (!refreshToken) {
    throw createError({
      statusCode: 401,
      message: "Integration is not authenticated. Please reconnect Google Photos.",
    });
  }

  try {
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    // Refresh access token if needed
    const { credentials } = await oauth2Client.refreshAccessToken();
    const accessToken = credentials.access_token;

    if (!accessToken) {
      throw createError({
        statusCode: 401,
        message: "Failed to refresh access token",
      });
    }

    // Update stored tokens
    const settings = (integration.settings as Record<string, unknown>) || {};
    await prisma.integration.update({
      where: { id: integrationId },
      data: {
        settings: {
          ...settings,
          accessToken: credentials.access_token,
          tokenExpiry: credentials.expiry_date,
        },
      },
    });

    // Fetch photos from selected albums
    const photos: PhotoItem[] = [];
    let nextPageToken: string | undefined;
    const albumIdList = albumIds ? albumIds.split(",").filter(Boolean) : [];

    if (albumIdList.length === 0) {
      // If no albums specified, get from recent media items
      const response = await $fetch<{
        mediaItems?: PhotoItem[];
        nextPageToken?: string;
      }>("https://photoslibrary.googleapis.com/v1/mediaItems", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        query: {
          pageSize,
          ...(pageToken && { pageToken }),
        },
      });

      if (response.mediaItems) {
        // Filter to only photos (not videos)
        photos.push(...response.mediaItems.filter(item =>
          item.mimeType && item.mimeType.startsWith("image/"),
        ));
      }
      nextPageToken = response.nextPageToken;
    }
    else {
      // Search for photos in specified albums
      const body: {
        pageSize: number;
        albumId: string;
        pageToken?: string;
      } = {
        pageSize,
        albumId: albumIdList[0]!, // Note: API only supports one album at a time
      };

      if (pageToken) {
        body.pageToken = pageToken;
      }

      const response = await $fetch<{
        mediaItems?: PhotoItem[];
        nextPageToken?: string;
      }>("https://photoslibrary.googleapis.com/v1/mediaItems:search", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body,
      });

      if (response.mediaItems) {
        // Filter to only photos (not videos)
        photos.push(...response.mediaItems.filter(item =>
          item.mimeType && item.mimeType.startsWith("image/"),
        ));
      }
      nextPageToken = response.nextPageToken;
    }

    // Transform photos to add dimensions to baseUrl for optimal loading
    const transformedPhotos = photos.map(photo => ({
      ...photo,
      // Append dimensions for optimal display (w=width, h=height)
      displayUrl: `${photo.baseUrl}=w1920-h1080`,
    }));

    return {
      photos: transformedPhotos,
      nextPageToken,
    };
  }
  catch (error) {
    consola.error("Google Photos: Failed to fetch photos:", error);

    // Check if it's an auth error
    if (error && typeof error === "object" && "statusCode" in error) {
      const httpError = error as { statusCode: number };
      if (httpError.statusCode === 401 || httpError.statusCode === 403) {
        // Mark integration as needing re-auth
        const settings = (integration.settings as Record<string, unknown>) || {};
        await prisma.integration.update({
          where: { id: integrationId },
          data: {
            settings: {
              ...settings,
              needsReauth: true,
            },
          },
        });

        throw createError({
          statusCode: 401,
          message: "Google Photos authentication expired. Please reconnect.",
        });
      }
    }

    throw createError({
      statusCode: 502,
      message: "Failed to fetch photos from Google Photos",
    });
  }
});
