import { consola } from "consola";
import { createError, defineEventHandler, getQuery, setHeader } from "h3";

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

    // Get event merger service from context
    const eventMergerService = event.context.eventMergerService;
    if (!eventMergerService) {
      throw createError({
        statusCode: 503,
        statusMessage: 'Event merger service not available'
      });
    }

    // Get merged events from all sources (local + ICS + CalDAV)
    const mergedEvents = await eventMergerService.getMergedEvents(weekStart, weekEnd);

    // Transform events for kiosk display
    const transformedEvents: CalendarEvent[] = mergedEvents.map(event => ({
      id: event.id,
      title: event.title,
      description: event.description,
      start: new Date(event.start),
      end: new Date(event.end),
      allDay: event.allDay,
      color: event.color,
      location: event.location,
      users: event.users,
    }));

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
