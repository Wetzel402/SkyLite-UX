import { consola } from "consola";
import { Buffer } from "node:buffer";

import prisma from "~/lib/prisma";

import { GooglePhotosServerService } from "../../../integrations/google_photos";
import { getGoogleOAuthConfig } from "../../../utils/googleOAuthConfig";

// Allowed Google Photos domains for SSRF protection
const ALLOWED_DOMAINS = [
  "lh3.googleusercontent.com",
  "photos.google.com",
  "photospicker.googleapis.com",
  "lh4.googleusercontent.com",
  "lh5.googleusercontent.com",
  "lh6.googleusercontent.com",
];

function isValidGooglePhotosUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:"
      && ALLOWED_DOMAINS.some(
        domain =>
          parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`),
      )
    );
  }
  catch {
    return false;
  }
}

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const photoId = query.photoId as string;
    const width = Number(query.width) || 1920;
    const height = Number(query.height) || 1080;

    if (!photoId) {
      throw createError({
        statusCode: 400,
        message: "photoId is required",
      });
    }

    // Find the photo in database to get its baseUrl
    const photo = await prisma.selectedAlbum.findFirst({
      where: {
        albumId: photoId,
      },
    });

    if (!photo || !photo.coverPhotoUrl) {
      throw createError({
        statusCode: 404,
        message: "Photo not found",
      });
    }

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

    // Guard against null/missing settings
    if (!integration.settings) {
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
      throw createError({
        statusCode: 401,
        message: "No refresh token available. Please re-authorize the integration.",
      });
    }

    // Validate URL to prevent SSRF attacks
    let imageUrl = photo.coverPhotoUrl;
    if (!isValidGooglePhotosUrl(imageUrl)) {
      consola.error("Invalid image URL domain:", imageUrl);
      throw createError({
        statusCode: 400,
        message: "Invalid image URL domain",
      });
    }

    // Append size parameters to get high-resolution image
    imageUrl = `${imageUrl}=w${width}-h${height}`;

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

    // Fetch image (handles token refresh automatically)
    const { buffer, contentType } = await service.fetchImage(imageUrl);

    // Set response headers
    setHeader(event, "Content-Type", contentType);
    setHeader(event, "Cache-Control", "public, max-age=86400"); // Cache for 1 day

    return Buffer.from(buffer);
  }
  catch (error: any) {
    if (error.statusCode) {
      throw error;
    }

    consola.error("Error in proxy-image:", error);
    throw createError({
      statusCode: 500,
      message: `Failed to proxy image: ${error.message || error}`,
    });
  }
});
