import { consola } from "consola";
import { Buffer } from "node:buffer";

import prisma from "~/lib/prisma";

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

    // Get access token
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
    // Google Photos baseUrls accept =w{width}-h{height} parameters
    imageUrl = `${imageUrl}=w${width}-h${height}`;

    // Fetch the image with OAuth token
    const response = await fetch(imageUrl, {
      headers: {
        Authorization: `Bearer ${settings.accessToken}`,
      },
    });

    if (!response.ok) {
      consola.error("Failed to fetch image:", {
        status: response.status,
        photoId,
      });
      throw createError({
        statusCode: response.status,
        message: "Failed to fetch image from Google Photos",
      });
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/jpeg";

    // Set response headers
    setHeader(event, "Content-Type", contentType);
    setHeader(event, "Cache-Control", "public, max-age=86400"); // Cache for 1 day

    return Buffer.from(imageBuffer);
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
