import { PrismaClient } from '@prisma/client';
import { getHeader, createError, readBody } from 'h3';
import { consola } from 'consola';
import { CalDAVAdapter } from '../../services/calendar/adapters/caldav';
import { ConflictError, WriteNotAllowedError, QuotaExceededError } from '../../services/calendar/errors';
import { quotaManager, retryManager } from '../../services/calendar/quota-manager';

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
    const body = await readBody(event);
    
    // Validate required fields
    if (!body.title || !body.start || !body.end || !body.sourceId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: title, start, end, sourceId'
      });
    }

    // Get the source
    const source = await prisma.calendarSource.findUnique({
      where: { id: body.sourceId }
    });

    if (!source) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Calendar source not found'
      });
    }

    // Check if writes are allowed for this source
    if (process.env.CALDAV_WRITE_ENABLED !== 'true' || source.writePolicy !== 'WRITE') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Write operations not allowed for this source'
      });
    }

    // Check quota
    if (!quotaManager.canWrite(source.id)) {
      throw createError({
        statusCode: 429,
        statusMessage: 'Quota exceeded - too many write operations for this source'
      });
    }

    // Create local event first (status: pending)
    const localEvent = await prisma.calendarEvent.create({
      data: {
        sourceId: source.id,
        title: body.title,
        description: body.description || null,
        location: body.location || null,
        start: new Date(body.start),
        end: new Date(body.end),
        allDay: body.allDay || false,
        status: 'pending',
        version: 1,
        uid: body.uid || null,
        recurrenceId: body.recurrenceId || null
      }
    });

    // Create audit entry
    await prisma.calendarAudit.create({
      data: {
        eventId: localEvent.id,
        sourceId: source.id,
        op: 'create',
        actor: 'user',
        before: null,
        after: {
          id: localEvent.id,
          title: localEvent.title,
          description: localEvent.description,
          location: localEvent.location,
          start: localEvent.start,
          end: localEvent.end,
          allDay: localEvent.allDay,
          status: localEvent.status,
          version: localEvent.version
        }
      }
    });

    // Try to create on remote server if CalDAV
    if (source.type === 'caldav') {
      try {
        // Consume quota token
        if (!quotaManager.consumeToken(source.id)) {
          throw new QuotaExceededError('Quota exceeded - too many write operations for this source');
        }

        const adapter = new CalDAVAdapter();
        const result = await retryManager.executeWithRetry(
          () => adapter.createEvent(source, {
            title: body.title,
            description: body.description,
            location: body.location,
            start: new Date(body.start),
            end: new Date(body.end),
            allDay: body.allDay || false,
            uid: body.uid,
            recurrenceId: body.recurrenceId
          }),
          'createEvent',
          source.id
        );

        // Update local event with remote details
        await prisma.calendarEvent.update({
          where: { id: localEvent.id },
          data: {
            uid: result.uid,
            lastRemoteEtag: result.etag,
            status: 'confirmed'
          }
        });

        consola.info(`Admin API: Created event "${body.title}" on remote server with UID ${result.uid}`);
      } catch (error) {
        consola.error(`Admin API: Failed to create event on remote server:`, error);
        
        // Update event status to failed
        await prisma.calendarEvent.update({
          where: { id: localEvent.id },
          data: { status: 'failed' }
        });

        // Create audit entry for failure
        await prisma.calendarAudit.create({
          data: {
            eventId: localEvent.id,
            sourceId: source.id,
            op: 'create',
            actor: 'system',
            before: null,
            after: {
              error: error instanceof Error ? error.message : 'Unknown error',
              status: 'failed'
            }
          }
        });

        throw createError({
          statusCode: 500,
          statusMessage: 'Failed to create event on remote server'
        });
      }
    }

    consola.info(`Admin API: Created event "${body.title}" for source ${source.name}`);
    
    return {
      success: true,
      event: {
        id: localEvent.id,
        title: localEvent.title,
        description: localEvent.description,
        location: localEvent.location,
        start: localEvent.start,
        end: localEvent.end,
        allDay: localEvent.allDay,
        status: localEvent.status,
        version: localEvent.version,
        uid: localEvent.uid
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    consola.error('Admin API: Failed to create event:', error);
    
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
