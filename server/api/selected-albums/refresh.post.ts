import { consola } from "consola";

import prisma from "~/lib/prisma";

/**
 * NOTE: As of March 31, 2025, Google Photos Library API no longer allows
 * access to user's existing albums. Photos are now downloaded and stored
 * locally when selected via the Picker API, so there's no need to refresh URLs.
 *
 * This endpoint verifies that local copies exist and reports their status.
 * Missing photos are downloaded on-demand when first requested (not by this endpoint).
 */
export default defineEventHandler(async () => {
  try {
    // Get all selected albums
    const selectedAlbums = await prisma.selectedAlbum.findMany();

    if (selectedAlbums.length === 0) {
      return {
        success: true,
        refreshed: 0,
        message: "No albums to refresh",
        note: "No albums selected. Use the photo picker to add albums.",
      };
    }

    // Count how many have local copies
    const albumsWithLocalCopy = selectedAlbums.filter(a => a.localImagePath).length;
    const albumsMissingLocal = selectedAlbums.length - albumsWithLocalCopy;

    consola.info(`Albums with local copy: ${albumsWithLocalCopy}/${selectedAlbums.length}`);

    if (albumsMissingLocal > 0) {
      consola.warn(`${albumsMissingLocal} albums missing local copy. They will be downloaded when requested.`);
    }

    return {
      success: true,
      refreshed: albumsWithLocalCopy,
      message: `${albumsWithLocalCopy} albums have local copies. Photos are downloaded from Google Photos Picker and stored locally.`,
      note: "As of March 31, 2025, Google Photos Library API restrictions mean albums can only be accessed via Picker API. Local storage is used for long-term display.",
    };
  }
  catch (error: any) {
    consola.error("Error checking albums:", error);
    throw createError({
      statusCode: 500,
      message: `Failed to check albums: ${error.message || error}`,
    });
  }
});
