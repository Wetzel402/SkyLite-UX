import { consola } from "consola";
import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const photoId = query.photoId as string;

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

    // Fetch the image with OAuth token
    const imageUrl = photo.coverPhotoUrl;
    const response = await fetch(imageUrl, {
      headers: {
        "Authorization": `Bearer ${settings.accessToken}`,
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
