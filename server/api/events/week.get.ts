import { PrismaClient } from '@prisma/client';
import { defineEventHandler, getQuery, setHeader } from 'h3';
import { consola } from 'consola';

export default defineEventHandler(async (event) => {
  consola.info('Events API: /api/events/week handler called');
  
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    },
    // Add timeout for this specific route
    log: ['error']
  });
  
  try {
    const query = getQuery(event);
    const from = query.from as string;
    const to = query.to as string;
    
    // Add timeout for database operations (500ms max)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database timeout')), 500);
    });

    // Parse date range
    let startDate: Date;
    let endDate: Date;

    if (from && to) {
      startDate = new Date(from);
      endDate = new Date(to);
      
      // Validate dates
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        consola.warn('Events API: Invalid date format, using current week');
        const today = new Date();
        const currentDay = today.getDay();
        startDate = new Date(today);
        startDate.setDate(today.getDate() - currentDay);
        startDate.setHours(0, 0, 0, 0);
        
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
      }
    } else {
      // Default to current week
      const today = new Date();
      const currentDay = today.getDay();
      startDate = new Date(today);
      startDate.setDate(today.getDate() - currentDay);
      startDate.setHours(0, 0, 0, 0);
      
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    }

    consola.debug(`Events API: Fetching events from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Query database for events with proper overlap predicate and timeout
    // Events overlap if: start <= to && end >= from
    const events = await Promise.race([
      prisma.calendarEvent.findMany({
      where: {
        AND: [
          {
            start: {
              lte: endDate  // start <= to
            }
          },
          {
            end: {
              gte: startDate  // end >= from
            }
          }
        ],
        status: {
          not: 'cancelled'
        }
      },
      select: {
        id: true,
        title: true,
        start: true,
        end: true,
        allDay: true,
        source: {
          select: {
            type: true,
            name: true,
            color: true
          }
        }
      },
      orderBy: [
        { start: 'asc' },
        { title: 'asc' }
      ]
    }),
      timeoutPromise
    ]);

    // Add cache headers
    setHeader(event, 'Cache-Control', 'public, max-age=15');
    setHeader(event, 'Content-Type', 'application/json');

    consola.debug(`Events API: Returning ${events.length} events`);

    return events.map(event => ({
      id: event.id,
      title: event.title,
      start: event.start.toISOString(),
      end: event.end.toISOString(),
      allDay: event.allDay,
      source: {
        type: event.source.type,
        name: event.source.name,
        color: event.source.color
      }
    }));

  } catch (error) {
    consola.error('Events API: Error fetching events:', error);
    
    // Always return 200 with empty result for robustness
    setHeader(event, 'Cache-Control', 'public, max-age=15');
    setHeader(event, 'Content-Type', 'application/json');
    
    return [];
  } finally {
    await prisma.$disconnect();
  }
});