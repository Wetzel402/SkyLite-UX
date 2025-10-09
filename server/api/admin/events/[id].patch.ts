import { PrismaClient } from '@prisma/client';
import { getHeader, createError, readBody, getRouterParam } from 'h3';
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

    const body = await readBody(event);
    
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

    // Update local event
    const updatedEvent = await prisma.calendarEvent.update({
      where: { id: eventId },
      data: {
        title: body.title !== undefined ? body.title : existingEvent.title,
        description: body.description !== undefined ? body.description : existingEvent.description,
        location: body.location !== undefined ? body.location : existingEvent.location,
        start: body.start !== undefined ? new Date(body.start) : existingEvent.start,
        end: body.end !== undefined ? new Date(body.end) : existingEvent.end,
        allDay: body.allDay !== undefined ? body.allDay : existingEvent.allDay,
        version: existingEvent.version + 1
      }
    });

    // Create audit entry
    await prisma.calendarAudit.create({
      data: {
        eventId: updatedEvent.id,
        sourceId: existingEvent.sourceId,
        op: 'update',
        actor: 'user',
        before: beforeState,
        after: {
          id: updatedEvent.id,
          title: updatedEvent.title,
          description: updatedEvent.description,
          location: updatedEvent.location,
          start: updatedEvent.start,
          end: updatedEvent.end,
          allDay: updatedEvent.allDay,
          status: updatedEvent.status,
          version: updatedEvent.version
        }
      }
    });

    // Try to update on remote server if CalDAV
    if (existingEvent.source.type === 'caldav') {
      try {
        // Consume quota token
        if (!quotaManager.consumeToken(existingEvent.sourceId)) {
          throw new QuotaExceededError('Quota exceeded - too many write operations for this source');
        }

        // Check for mock conflict header
        const mockConflict = getHeader(event, 'x-mock-conflict') === 'true';
        if (mockConflict && process.env.CALDAV_MOCK === '1') {
          (globalThis as any).__mockConflict = true;
        }

        const adapter = new CalDAVAdapter();
        const result = await retryManager.executeWithRetry(
          () => adapter.updateEvent(existingEvent.source, existingEvent, {
            title: body.title,
            description: body.description,
            location: body.location,
            start: body.start ? new Date(body.start) : undefined,
            end: body.end ? new Date(body.end) : undefined,
            allDay: body.allDay
          }),
          'updateEvent',
          existingEvent.sourceId
        );

        // Update local event with remote details
        await prisma.calendarEvent.update({
          where: { id: updatedEvent.id },
          data: {
            lastRemoteEtag: result.etag,
            status: 'confirmed'
          }
        });

        consola.info(`Admin API: Updated event "${updatedEvent.title}" on remote server with UID ${result.uid}`);
      } catch (error) {
        consola.error(`Admin API: Failed to update event on remote server:`, error);
        
        // Update event status to failed
        await prisma.calendarEvent.update({
          where: { id: updatedEvent.id },
          data: { status: 'failed' }
        });

        // Create audit entry for failure
        await prisma.calendarAudit.create({
          data: {
            eventId: updatedEvent.id,
            sourceId: existingEvent.sourceId,
            op: 'update',
            actor: 'system',
            before: beforeState,
            after: {
              error: error instanceof Error ? error.message : 'Unknown error',
              status: 'failed'
            }
          }
        });

        throw createError({
          statusCode: 500,
          statusMessage: 'Failed to update event on remote server'
        });
      }
    }

    consola.info(`Admin API: Updated event "${updatedEvent.title}" for source ${existingEvent.source.name}`);
    
    return {
      success: true,
      event: {
        id: updatedEvent.id,
        title: updatedEvent.title,
        description: updatedEvent.description,
        location: updatedEvent.location,
        start: updatedEvent.start,
        end: updatedEvent.end,
        allDay: updatedEvent.allDay,
        status: updatedEvent.status,
        version: updatedEvent.version,
        uid: updatedEvent.uid,
        lastRemoteEtag: updatedEvent.lastRemoteEtag
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    consola.error('Admin API: Failed to update event:', error);
    
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
