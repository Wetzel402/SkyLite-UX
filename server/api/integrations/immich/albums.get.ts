import { consola } from "consola";
import { createError, defineEventHandler, getQuery } from "h3";

import prisma from "~/lib/prisma";
// eslint-disable-next-line perfectionist/sort-imports
import { decryptToken } from "../../../integrations/google-calendar/oauth";

/**
 * Immich Album type from Immich API
 */
type ImmichAlbum = {
  id: string;
  albumName: string;
  description: string;
  assetCount: number;
  albumThumbnailAssetId: string | null;
  createdAt: string;
  updatedAt: string;
  shared: boolean;
  ownerId: string;
};

/**
 * GET /api/integrations/immich/albums
 * Fetches available Immich albums
 *
 * Query params:
 * - integrationId: Required - the ID of the Immich integration
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const integrationId = query.integrationId as string;

  if (!integrationId) {
    throw createError({
      statusCode: 400,
      message: "integrationId query parameter is required",
    });
  }

  // Look up the integration
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });

  if (!integration) {
    throw createError({
      statusCode: 404,
      message: "Integration not found",
    });
  }

  if (integration.type !== "photos" || integration.service !== "immich") {
    throw createError({
      statusCode: 400,
      message: "Invalid integration type - expected Immich photos integration",
    });
  }

  // Get and decrypt credentials
  const encryptedApiKey = integration.apiKey;
  const baseUrl = integration.baseUrl;

  if (!encryptedApiKey || !baseUrl) {
    throw createError({
      statusCode: 400,
      message: "Immich integration is missing required configuration (API key or URL)",
    });
  }

  let apiKey: string;
  try {
    apiKey = decryptToken(encryptedApiKey);
  }
  catch (error) {
    consola.error("Failed to decrypt Immich API key:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to decrypt API credentials",
    });
  }

  try {
    // Fetch albums from Immich API
    const response = await fetch(`${baseUrl}/api/albums`, {
      headers: {
        "x-api-key": apiKey,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      let errorMessage: string;
      switch (response.status) {
        case 401:
          errorMessage = "Authentication failed - check your API key";
          break;
        case 403:
          errorMessage = "Access denied - API key may lack required permissions";
          break;
        case 404:
          errorMessage = "Immich API endpoint not found - check your server URL";
          break;
        case 500:
        case 502:
        case 503:
          errorMessage = "Immich server error - try again later";
          break;
        default:
          errorMessage = `Immich server responded with status ${response.status}`;
      }
      throw createError({
        statusCode: response.status,
        message: errorMessage,
      });
    }

    const albums: ImmichAlbum[] = await response.json();

    consola.info(`Fetched ${albums.length} Immich albums for integration ${integrationId}`);

    // Transform to a standardized format
    return {
      albums: albums.map(album => ({
        id: album.id,
        title: album.albumName,
        description: album.description,
        assetCount: album.assetCount,
        thumbnailAssetId: album.albumThumbnailAssetId,
        shared: album.shared,
        createdAt: album.createdAt,
        updatedAt: album.updatedAt,
      })),
    };
  }
  catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error; // Re-throw HTTP errors
    }

    consola.error("Error fetching Immich albums:", error);

    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : "Failed to fetch albums from Immich",
    });
  }
});
