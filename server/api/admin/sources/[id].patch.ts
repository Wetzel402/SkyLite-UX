import { PrismaClient } from '@prisma/client';
import { getHeader, createError, readBody, getRouterParam } from 'h3';
import { consola } from 'consola';
import { quotaManager } from '../../../services/calendar/quota-manager';

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
    const sourceId = getRouterParam(event, 'id');
    if (!sourceId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Source ID is required'
      });
    }

    const body = await readBody(event);
    
    // Validate input
    const allowedFields = ['writePolicy', 'color', 'name'];
    const updateData: any = {};
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }
    
    // Validate writePolicy if provided
    if (updateData.writePolicy !== undefined) {
      if (!['NONE', 'WRITE'].includes(updateData.writePolicy)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'writePolicy must be either "NONE" or "WRITE"'
        });
      }
    }
    
    // Validate color if provided
    if (updateData.color !== undefined) {
      if (typeof updateData.color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(updateData.color)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'color must be a valid hex color (e.g., #FF0000)'
        });
      }
    }
    
    // Validate name if provided
    if (updateData.name !== undefined) {
      if (typeof updateData.name !== 'string' || updateData.name.trim().length === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'name must be a non-empty string'
        });
      }
      updateData.name = updateData.name.trim();
    }

    // Check quota
    if (!quotaManager.canWrite(sourceId)) {
      throw createError({
        statusCode: 429,
        statusMessage: 'Quota exceeded - too many operations for this source'
      });
    }

    // Get existing source for audit
    const existingSource = await prisma.calendarSource.findUnique({
      where: { id: sourceId }
    });

    if (!existingSource) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Calendar source not found'
      });
    }

    // Store before state for audit
    const beforeState = {
      id: existingSource.id,
      name: existingSource.name,
      color: existingSource.color,
      writePolicy: existingSource.writePolicy,
      updatedAt: existingSource.updatedAt
    };

    // Update the source
    const updatedSource = await prisma.calendarSource.update({
      where: { id: sourceId },
      data: {
        ...updateData,
        updatedAt: new Date()
      }
    });

    // Consume quota token
    quotaManager.consumeToken(sourceId);

    // Create audit entry
    await prisma.calendarAudit.create({
      data: {
        sourceId: sourceId,
        op: 'source_update',
        actor: 'user',
        before: beforeState,
        after: {
          id: updatedSource.id,
          name: updatedSource.name,
          color: updatedSource.color,
          writePolicy: updatedSource.writePolicy,
          updatedAt: updatedSource.updatedAt
        }
      }
    });

    consola.info(`Admin API: Updated source "${updatedSource.name}" (${sourceId})`);
    
    // Mask sensitive data for response
    const maskedSource = {
      id: updatedSource.id,
      type: updatedSource.type,
      name: updatedSource.name,
      color: updatedSource.color,
      writePolicy: updatedSource.writePolicy,
      serverUrl: updatedSource.serverUrl,
      username: updatedSource.username ? maskUsername(updatedSource.username) : null,
      lastSyncAt: updatedSource.lastSyncAt,
      errorCount: updatedSource.errorCount,
      lastErrorAt: updatedSource.lastErrorAt,
      createdAt: updatedSource.createdAt,
      updatedAt: updatedSource.updatedAt
    };
    
    return {
      success: true,
      source: maskedSource,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    consola.error('Admin API: Failed to update source:', error);
    
    if (error instanceof Error && error.message.includes('quota')) {
      throw createError({
        statusCode: 429,
        statusMessage: 'Quota exceeded - too many operations'
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

function maskUsername(username: string): string {
  if (!username) return '';
  if (username.length <= 2) return '*'.repeat(username.length);
  return username.charAt(0) + '*'.repeat(username.length - 2) + username.charAt(username.length - 1);
}
