import { consola } from "consola";
import { google } from "googleapis";
import { createError, defineEventHandler, getQuery } from "h3";

import prisma from "~/lib/prisma";

import { getGoogleOAuthConfig } from "../../../utils/googleOAuthConfig";

export type PhotoAlbum = {
  id: string;
  title: string;
  productUrl?: string;
  mediaItemsCount?: string;
  coverPhotoBaseUrl?: string;
  coverPhotoMediaItemId?: string;
};

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const integrationId = query.integrationId as string;

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
    const settings = (integration.settings as Record<string, unknown>) || {};
    const storedAccessToken = settings.accessToken as string | undefined;
    const tokenExpiry = settings.tokenExpiry as number | undefined;

    let accessToken: string | null | undefined = storedAccessToken;

    // Check if we need to refresh the token
    const now = Date.now();
    const isTokenExpired = !tokenExpiry || tokenExpiry < now + 60000; // 1 minute buffer

    if (!storedAccessToken || isTokenExpired) {
      consola.info("Google Photos: Refreshing access token (expired or missing)");
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
      oauth2Client.setCredentials({ refresh_token: refreshToken });

      const { credentials } = await oauth2Client.refreshAccessToken();
      accessToken = credentials.access_token;

      consola.info("Google Photos: Token refreshed", {
        hasAccessToken: !!accessToken,
        scope: credentials.scope,
        expiry: credentials.expiry_date,
      });

      if (!accessToken) {
        throw createError({
          statusCode: 401,
          message: "Failed to refresh access token",
        });
      }

      // Update stored tokens
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
    }
    else {
      consola.info("Google Photos: Using stored access token (still valid)");
    }

    // Verify the token's scopes using Google's tokeninfo endpoint
    try {
      const tokenInfo = await $fetch<{ scope?: string; error_description?: string }>(
        `https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`,
      );
      consola.info("Google Photos: Token info", {
        scope: tokenInfo.scope,
        hasPhotosScope: tokenInfo.scope?.includes("photoslibrary"),
      });

      if (!tokenInfo.scope?.includes("photoslibrary")) {
        consola.error("Google Photos: Token does NOT have photoslibrary scope! Actual scopes:", tokenInfo.scope);
      }
    }
    catch (tokenInfoError) {
      consola.warn("Google Photos: Could not verify token scopes:", tokenInfoError);
    }

    // Fetch albums from Google Photos API using googleapis library
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    // Use the Photos Library API through a direct HTTP call with the auth client
    const albums: PhotoAlbum[] = [];
    let pageToken: string | undefined;

    do {
      // Make the request using the OAuth2 client's request method for proper auth handling
      const url = new URL("https://photoslibrary.googleapis.com/v1/albums");
      url.searchParams.set("pageSize", "50");
      if (pageToken) {
        url.searchParams.set("pageToken", pageToken);
      }

      const response = await $fetch<{
        albums?: PhotoAlbum[];
        nextPageToken?: string;
      }>(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.albums) {
        albums.push(...response.albums);
      }
      pageToken = response.nextPageToken;
    } while (pageToken);

    return { albums };
  }
  catch (error) {
    consola.error("Google Photos: Failed to fetch albums:", error);

    // Log the full error details for debugging
    const httpError = error as { statusCode?: number; status?: number; data?: { error?: { message?: string; status?: string; code?: number } }; response?: { _data?: unknown } };
    consola.error("Google Photos: Error details:", {
      statusCode: httpError.statusCode,
      status: httpError.status,
      errorData: httpError.data,
      responseData: httpError.response?._data,
    });

    const statusCode = httpError.statusCode || httpError.status;

    if (statusCode === 401 || statusCode === 403) {
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

      // Check for specific permission errors
      const errorMessage = httpError.data?.error?.message || "";
      const errorStatus = httpError.data?.error?.status || "";

      if (errorMessage.includes("insufficient") || errorStatus === "PERMISSION_DENIED") {
        consola.error("Google Photos: Permission denied - likely missing photoslibrary.readonly scope in OAuth consent screen");
        throw createError({
          statusCode: 403,
          message: "Google Photos permission denied. Please ensure the Photos Library API scope is added to your Google Cloud OAuth consent screen, then reconnect.",
        });
      }

      throw createError({
        statusCode: 401,
        message: "Google Photos authentication expired. Please reconnect.",
      });
    }

    throw createError({
      statusCode: 502,
      message: "Failed to fetch albums from Google Photos",
    });
  }
});
