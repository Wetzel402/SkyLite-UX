import { consola } from "consola";

import prisma from "~/lib/prisma";
import { getStorageDir } from "../../utils/photoStorage";

/**
 * Resets all photo cache references in the database
 * This forces photos to be re-downloaded to the correct storage location
 *
 * POST /api/system/reset-photo-cache
 * REQUIRES: Admin/system authorization
 */
export default defineEventHandler(async (event) => {
  // Authorization guard - this is a destructive system-level operation
  // TODO: Implement proper authentication/authorization based on your auth system
  // For now, check for a simple admin token or session
  const authHeader = getHeader(event, "authorization");
  const adminToken = getHeader(event, "x-admin-token");

  // eslint-disable-next-line node/no-process-env
  const validAdminToken = process.env.ADMIN_TOKEN || process.env.NUXT_ADMIN_TOKEN;

  // Check if request is authorized
  const isAuthorized = (adminToken && validAdminToken && adminToken === validAdminToken)
    || (authHeader && authHeader.startsWith("Bearer ") && authHeader.substring(7) === validAdminToken);

  if (!isAuthorized) {
    consola.warn("Unauthorized attempt to reset photo cache from:", event.node.req.socket.remoteAddress);
    throw createError({
      statusCode: 401,
      message: "Unauthorized: Admin token required for system operations",
    });
  }

  try {
    const storageLocation = getStorageDir();
    consola.info(`Resetting photo cache. New storage location: ${storageLocation}`);

    // Clear all localImagePath references - photos will be re-downloaded
    const result = await prisma.selectedAlbum.updateMany({
      where: {
        localImagePath: {
          not: null,
        },
      },
      data: {
        localImagePath: null,
        cachedWidth: null,
        cachedHeight: null,
        downloadedAt: null,
      },
    });

    consola.success(`Reset complete: Cleared ${result.count} album photo cache entries`);

    return {
      success: true,
      clearedCount: result.count,
      storageLocation,
      message: `Cleared ${result.count} album photo cache entry(ies). Photos will be re-downloaded to ${storageLocation} on next view.`,
    };
  }
  catch (error: any) {
    consola.error("Error during photo cache reset:", error);
    throw createError({
      statusCode: 500,
      message: `Reset failed: ${error.message || error}`,
    });
  }
});
