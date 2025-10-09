import { PrismaClient } from '@prisma/client';
import { getHeader, createError, getRouterParam } from 'h3';
import { consola } from 'consola';
import { CalDAVAdapter } from '../../../../services/calendar/adapters/caldav';

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
    consola.warn(`Admin API: Invalid admin token attempt`);
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized - Invalid admin token'
    });
  }

  const prisma = new PrismaClient();
  
  try {
    const sourceId = getRouterParam(event, 'sourceId');
    if (!sourceId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Source ID is required'
      });
    }

    // Get the source
    const source = await prisma.calendarSource.findUnique({
      where: { id: sourceId }
    });

    if (!source) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Calendar source not found'
      });
    }

    if (source.type !== 'caldav') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Source is not a CalDAV source'
      });
    }

    // Check if we're in mock mode
    const isMockMode = process.env.CALDAV_MOCK === '1';
    
    if (isMockMode) {
      // Return mock health data
      return {
        ok: true,
        server: {
          vendor: 'Mock CalDAV Server',
          supportsEtag: true
        },
        lastSyncAt: source.lastSyncAt?.toISOString() || null,
        errorCount: source.errorCount,
        mock: true
      };
    }

    // Attempt real CalDAV health check
    try {
      const adapter = new CalDAVAdapter(source);
      
      // Perform lightweight PROPFIND to check connectivity
      const healthCheck = await adapter.performHealthCheck();
      
      return {
        ok: true,
        server: {
          vendor: healthCheck.vendor,
          supportsEtag: healthCheck.supportsEtag
        },
        lastSyncAt: source.lastSyncAt?.toISOString() || null,
        errorCount: source.errorCount
      };
    } catch (error) {
      consola.error(`CalDAV health check failed for source ${sourceId}:`, error);
      
      return {
        ok: false,
        code: 'CONNECTION_FAILED',
        hint: 'Unable to connect to CalDAV server',
        lastSyncAt: source.lastSyncAt?.toISOString() || null,
        errorCount: source.errorCount
      };
    }
  } catch (error) {
    consola.error('Admin API: Failed to check CalDAV health:', error);
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    });
  } finally {
    await prisma.$disconnect();
  }
});
