import { consola } from "consola";
import { readFile, stat } from "node:fs/promises";

import prisma from "~/lib/prisma";

import { GooglePhotosServerService } from "../../../integrations/google_photos";
import { getGoogleOAuthConfig } from "../../../utils/googleOAuthConfig";
import { downloadAndSavePhoto, getPhotoPath } from "../../../utils/photoStorage";

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

/**
 * Clamps a dimension to safe bounds
 */
function clampDimension(value: number, min: number = 1, max: number = 4096): number {
  return Math.max(min, Math.min(max, value));
}

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const photoId = query.photoId as string;

    // Parse and clamp dimensions to safe bounds (1-4096)
    const requestedWidth = Number(query.width) || 1920;
    const requestedHeight = Number(query.height) || 1080;
    const width = clampDimension(requestedWidth);
    const height = clampDimension(requestedHeight);

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
      tokenExpiry?: number;
    };

    if (!integration.apiKey) {
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
      integration.apiKey,
      settings.accessToken,
      settings.tokenExpiry,
      integration.id,
      async (integrationId, accessToken, expiry) => {
        // Persist refreshed token to database
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

    // Check if we have a local copy that matches the requested size
    if (photo.localImagePath && photo.cachedWidth && photo.cachedHeight) {
      // Only serve cached file if size matches (or no specific size requested)
      const sizeMatches = (photo.cachedWidth === width && photo.cachedHeight === height);

      if (sizeMatches) {
        try {
          const localPath = getPhotoPath(photo.localImagePath);

          // Check if file exists
          await stat(localPath);

          // Serve from local storage
          const buffer = await readFile(localPath);

          setHeader(event, "Content-Type", "image/jpeg");
          setHeader(event, "Cache-Control", "public, max-age=31536000"); // Cache for 1 year (local file won't change)

          consola.info(`Serving photo from local storage: ${photo.localImagePath} (${width}x${height})`);
          return buffer;
        }
        catch (fileError) {
          consola.warn(`Local file not found, will download: ${photo.localImagePath}`, fileError);
          // Fall through to download
        }
      }
      else {
        consola.info(`Cached size (${photo.cachedWidth}x${photo.cachedHeight}) doesn't match requested (${width}x${height}), downloading fresh`);
      }
    }

    // No local copy or file missing - download and save it
    try {
      consola.info(`Downloading and saving photo: ${photoId}`);

      // Get access token
      const accessToken = await service.getAccessToken();

      // Download and save
      const filename = `album-${photoId}.jpg`;
      const localPath = await downloadAndSavePhoto(
        photo.coverPhotoUrl!,
        accessToken,
        filename,
        width,
        height,
      );

      // Update database with size metadata
      await prisma.selectedAlbum.update({
        where: { id: photo.id },
        data: {
          localImagePath: localPath,
          cachedWidth: width,
          cachedHeight: height,
          downloadedAt: new Date(),
        },
      });

      // Serve the newly downloaded file
      const buffer = await readFile(getPhotoPath(localPath));

      setHeader(event, "Content-Type", "image/jpeg");
      setHeader(event, "Cache-Control", "public, max-age=31536000"); // Cache for 1 year

      return buffer;
    }
    catch (fetchError: any) {
      // Check if it's a token/auth error
      const errorMessage = fetchError.message || String(fetchError);
      const isAuthError = errorMessage.includes("invalid_grant")
        || errorMessage.includes("unauthorized")
        || errorMessage.includes("401")
        || errorMessage.includes("403")
        || fetchError.code === 401
        || fetchError.code === 403;

      if (isAuthError) {
        consola.error("Google Photos auth error, refresh token may be invalid:", fetchError);
        throw createError({
          statusCode: 401,
          message: "Google Photos authorization expired. Please re-authorize the integration in settings.",
        });
      }

      // Check if it's a URL expiration error
      if (errorMessage.includes("404") || errorMessage.includes("410")) {
        consola.warn("Google Photos URL expired for photo:", photoId);
        throw createError({
          statusCode: 410,
          message: "Photo URL expired. Album URLs need to be refreshed.",
        });
      }

      throw fetchError;
    }
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
