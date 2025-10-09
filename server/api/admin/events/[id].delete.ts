import { PrismaClient } from '@prisma/client';
import { getHeader, createError, getRouterParam } from 'h3';
import { consola } from 'consola';
import { CalDAVAdapter } from '../../../services/calendar/adapters/caldav';
import { ConflictError, WriteNotAllowedError, QuotaExceededError } from '../../../services/calendar/errors';
import { quotaManager, retryManager } from '../../../services/calendar/quota-manager';

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

  const prisma = new PrismaClient();
  
  try {
    const eventId = getRouterParam(event, 'id');
    if (!eventId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Event ID is required'
      });
    }

    // Get the existing event
    const existingEvent = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
      include: { source: true }
    });

    if (!existingEvent) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Event not found'
      });
    }

    // Check if writes are allowed for this source
    if (process.env.CALDAV_WRITE_ENABLED !== 'true' || existingEvent.source.writePolicy !== 'WRITE') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Write operations not allowed for this source'
      });
    }

    // Check quota
    if (!quotaManager.canWrite(existingEvent.sourceId)) {
      throw createError({
        statusCode: 429,
        statusMessage: 'Quota exceeded - too many write operations for this source'
      });
    }

    // Store the before state for audit
    const beforeState = {
      id: existingEvent.id,
      title: existingEvent.title,
      description: existingEvent.description,
      location: existingEvent.location,
      start: existingEvent.start,
      end: existingEvent.end,
      allDay: existingEvent.allDay,
      status: existingEvent.status,
      version: existingEvent.version,
      lastRemoteEtag: existingEvent.lastRemoteEtag
    };

    // Create tombstone record for soft delete
    await prisma.calendarTombstone.create({
      data: {
        eventId: existingEvent.id,
        sourceId: existingEvent.sourceId
      }
    });

    // Update local event status to cancelled
    await prisma.calendarEvent.update({
      where: { id: eventId },
      data: { status: 'cancelled' }
    });

    // Create audit entry
    await prisma.calendarAudit.create({
      data: {
        eventId: existingEvent.id,
        sourceId: existingEvent.sourceId,
        op: 'delete',
        actor: 'user',
        before: beforeState,
        after: {
          status: 'cancelled',
          deletedAt: new Date()
        }
      }
    });

    // Try to delete on remote server if CalDAV
    if (existingEvent.source.type === 'caldav') {
      try {
        // Consume quota token
        if (!quotaManager.consumeToken(existingEvent.sourceId)) {
          throw new QuotaExceededError('Quota exceeded - too many write operations for this source');
        }

        const adapter = new CalDAVAdapter();
        await retryManager.executeWithRetry(
          () => adapter.deleteEvent(existingEvent.source, existingEvent),
          'deleteEvent',
          existingEvent.sourceId
        );

        consola.info(`Admin API: Deleted event "${existingEvent.title}" on remote server`);
      } catch (error) {
        consola.error(`Admin API: Failed to delete event on remote server:`, error);
        
        // Create audit entry for failure
        await prisma.calendarAudit.create({
          data: {
            eventId: existingEvent.id,
            sourceId: existingEvent.sourceId,
            op: 'delete',
            actor: 'system',
            before: beforeState,
            after: {
              error: error instanceof Error ? error.message : 'Unknown error',
              status: 'cancelled'
            }
          }
        });

        // Note: We don't throw here because the local delete was successful
        // The event is marked as cancelled locally even if remote delete fails
        consola.warn(`Admin API: Event "${existingEvent.title}" was cancelled locally but remote delete failed`);
      }
    }

    consola.info(`Admin API: Deleted event "${existingEvent.title}" for source ${existingEvent.source.name}`);
    
    return {
      success: true,
      event: {
        id: existingEvent.id,
        title: existingEvent.title,
        status: 'cancelled',
        deletedAt: new Date()
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    consola.error('Admin API: Failed to delete event:', error);
    
    if (error instanceof ConflictError) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Conflict - Event was modified by another client',
        data: {
          before: error.before,
          attempted: error.attempted,
          remoteSummary: error.remoteSummary
        }
      });
    }
    
    if (error instanceof WriteNotAllowedError) {
      throw createError({
        statusCode: 403,
        statusMessage: error.message
      });
    }
    
    if (error instanceof QuotaExceededError) {
      throw createError({
        statusCode: 429,
        statusMessage: error.message
      });
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    });
  } finally {
    await prisma.$disconnect();
  }
});
