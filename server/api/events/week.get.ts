import { consola } from "consola";
import { createError, defineEventHandler, getQuery } from "h3";

import type { CalendarEvent } from "../../../app/types/calendar";

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const startDate = query.startDate as string;
    const endDate = query.endDate as string;

    // If no dates provided, get current week
    let weekStart: Date;
    let weekEnd: Date;

    if (startDate && endDate) {
      weekStart = new Date(startDate);
      weekEnd = new Date(endDate);
    } else {
      const today = new Date();
      const currentDay = today.getDay();
      weekStart = new Date(today);
      weekStart.setDate(today.getDate() - currentDay);
      weekStart.setHours(0, 0, 0, 0);
      
      weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
    }

    consola.debug(`Events API: Fetching events for week ${weekStart.toISOString()} to ${weekEnd.toISOString()}`);

    // Import Prisma client
    const prisma = await import("../../../app/lib/prisma").then(m => m.default);

    // Fetch calendar events for the week
    const events = await prisma.calendarEvent.findMany({
      where: {
        start: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
      },
      orderBy: {
        start: 'asc',
      },
    });

    // Transform events for kiosk display
    const transformedEvents: CalendarEvent[] = events.map(event => {
      // Get primary user color or use event color
      let eventColor = '#3B82F6'; // Default blue
      
      if (event.color) {
        if (typeof event.color === 'string') {
          eventColor = event.color;
        } else if (typeof event.color === 'object' && event.color.primary) {
          eventColor = event.color.primary;
        }
      } else if (event.users.length > 0) {
        // Use first user's color
        const userColor = event.users[0].user.color;
        if (userColor) {
          eventColor = userColor;
        }
      }

      return {
        id: event.id,
        title: event.title,
        description: event.description,
        start: event.start.toISOString(),
        end: event.end.toISOString(),
        allDay: event.allDay,
        color: eventColor,
        location: event.location,
        users: event.users.map(u => ({
          id: u.user.id,
          name: u.user.name,
          color: u.user.color,
        })),
      };
    });

    // Add cache headers for kiosk mode
    setHeader(event, 'Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    setHeader(event, 'X-Kiosk-Mode', 'enabled');
    setHeader(event, 'X-Content-Type-Options', 'nosniff');

    consola.debug(`Events API: Returning ${transformedEvents.length} events for kiosk display`);

    return {
      events: transformedEvents,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      totalEvents: transformedEvents.length,
      lastUpdated: new Date().toISOString(),
    };

  } catch (error) {
    consola.error("Events API: Error fetching weekly events:", error);
    
    // Return empty result instead of throwing error for kiosk mode
    return {
      events: [],
      weekStart: new Date().toISOString(),
      weekEnd: new Date().toISOString(),
      totalEvents: 0,
      lastUpdated: new Date().toISOString(),
      error: "Unable to fetch events",
    };
  }
});
