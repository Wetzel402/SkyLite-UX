import { getHeader, createError } from 'h3';
import { consola } from 'consola';

export default defineEventHandler(async (event) => {
  // Check admin token
  const adminToken = getHeader(event, 'x-admin-token');
  const expectedToken = process.env.ADMIN_API_TOKEN;
  
  if (!expectedToken) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Admin API not configured'
    });
  }
  
  if (!adminToken || adminToken !== expectedToken) {
    consola.warn(`Admin API: Invalid admin token attempt from ${getClientIP(event)}`);
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized - Invalid admin token'
    });
  }
  
  try {
    // Get the persistent sync service from the nitro app context
    const persistentSync = await $fetch('/api/sync/status').catch(() => null);
    
    if (!persistentSync) {
      throw createError({
        statusCode: 503,
        statusMessage: 'Sync service not available'
      });
    }
    
    consola.info('Admin API: Triggering manual sync for all sources');
    
    // Trigger sync for all sources
    const syncResult = await triggerSyncAll();
    
    consola.success(`Admin API: Sync completed - ${syncResult.sources} sources, ${syncResult.fetched} fetched, ${syncResult.upserts} upserts, ${syncResult.errors} errors`);
    
    return {
      success: true,
      summary: syncResult,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    consola.error('Admin API: Failed to trigger sync:', error);
    
    // Check if it's a database connection error
    if (error instanceof Error && (error.message.includes('database') || error.message.includes('connection'))) {
      throw createError({
        statusCode: 503,
        statusMessage: 'Database unavailable',
        data: {
          error: 'db_unavailable',
          hint: 'Start local Postgres (npm run db:up) and run migrations (npm run db:migrate).'
        }
      });
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to trigger sync'
    });
  }
});

async function triggerSyncAll() {
  try {
    // Import the persistent sync service
    const { PersistentCalendarSyncService } = await import('../../services/calendar/persistent-sync');
    const { PrismaClient } = await import('@prisma/client');
    
    const prisma = new PrismaClient();
    const syncService = new PersistentCalendarSyncService(prisma);
    
    const results = await syncService.syncAll();
    
    // Calculate summary
    const summary = {
      sources: results.length,
      fetched: results.reduce((sum, r) => sum + r.eventsCount, 0),
      upserts: results.reduce((sum, r) => sum + r.newEvents + r.updatedEvents, 0),
      errors: results.reduce((sum, r) => sum + r.errors.length, 0),
      details: results.map(r => ({
        sourceId: r.sourceId,
        success: r.success,
        eventsCount: r.eventsCount,
        newEvents: r.newEvents,
        updatedEvents: r.updatedEvents,
        errors: r.errors.length,
        duration: r.duration
      }))
    };
    
    await prisma.$disconnect();
    return summary;
  } catch (error) {
    consola.error('Admin API: Failed to trigger sync:', error);
    return {
      sources: 0,
      fetched: 0,
      upserts: 0,
      errors: 1,
      details: [{ error: error instanceof Error ? error.message : String(error) }]
    };
  }
}
