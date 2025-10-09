import { consola } from "consola";
import { createError, defineEventHandler } from "h3";
import { PrismaClient } from '@prisma/client';

import { syncManager } from "../../plugins/02.syncManager";

export default defineEventHandler(async () => {
  try {
    const prisma = new PrismaClient();
    
    // Check if there are any calendar sources
    const sourceCount = await prisma.calendarSource.count().catch(() => 0);
    await prisma.$disconnect();
    
    if (sourceCount === 0) {
      return {
        status: "no-sources",
        connectedClients: syncManager.getConnectedClientsCount(),
        activeSyncIntervals: [],
        timestamp: new Date(),
      };
    }
    
    const status = {
      connectedClients: syncManager.getConnectedClientsCount(),
      activeSyncIntervals: syncManager.getActiveSyncIntervals(),
      timestamp: new Date(),
    };

    return status;
  }
  catch (error) {
    consola.error("Sync Status: Error getting sync status:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to get sync status",
    });
  }
});
