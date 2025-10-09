import { PrismaClient } from '@prisma/client';
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
  
  const prisma = new PrismaClient();
  
  try {
    const sources = await prisma.calendarSource.findMany({
      select: {
        id: true,
        type: true,
        name: true,
        color: true,
        serverUrl: true,
        username: true,
        writePolicy: true,
        lastSyncAt: true,
        errorCount: true,
        lastErrorAt: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });
    
    // Mask usernames for security
    const maskedSources = sources.map(source => ({
      ...source,
      username: source.username ? maskUsername(source.username) : null
    }));
    
    consola.debug(`Admin API: Listed ${sources.length} calendar sources`);
    
    return {
      sources: maskedSources,
      count: sources.length,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    consola.error('Admin API: Failed to list sources:', error);
    
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
      statusMessage: 'Failed to fetch calendar sources'
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
