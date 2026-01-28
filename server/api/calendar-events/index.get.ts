import { Prisma } from "@prisma/client";
import consola from "consola";
import ical from "ical.js";

import type { CalendarEvent } from "~/types/calendar";

import prisma from "~/lib/prisma";

import type { ICalEvent } from "../../integrations/iCal/types";

function expandRecurringEvent(event: CalendarEvent, startDate: Date, endDate: Date): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  try {
    if (!event.ical_event?.rrule) {
      return [event];
    }

    const vevent = new ical.Component(["vevent", [], []]);
    vevent.addPropertyWithValue("uid", event.id);
    vevent.addPropertyWithValue("summary", event.title);
    vevent.addPropertyWithValue("description", event.description);
    vevent.addPropertyWithValue("location", event.location);

    const dtstart = ical.Time.fromJSDate(new Date(event.start), true);
    vevent.addPropertyWithValue("dtstart", dtstart);
    const dtend = ical.Time.fromJSDate(new Date(event.end), true);
    vevent.addPropertyWithValue("dtend", dtend);

    const rrule = new ical.Property("rrule", vevent);
    rrule.setValue(event.ical_event.rrule);
    vevent.addProperty(rrule);

    const expansion = new ical.RecurExpansion({
      component: vevent,
      dtstart,
    });

    let count = 0;
    const maxInstances = 1000;

    while (count < maxInstances) {
      const currentTime = expansion.next();

      if (!currentTime) {
        break;
      }

      const currentDate = currentTime.toJSDate();

      if (currentDate > endDate) {
        break;
      }

      if (currentDate >= startDate) {
        const duration = new Date(event.end).getTime() - new Date(event.start).getTime();
        const newEnd = new Date(currentDate.getTime() + duration);

        events.push({
          ...event,
          id: `${event.id}-${currentTime.toICALString()}`,
          start: currentDate,
          end: newEnd,
          ical_event: {
            ...event.ical_event,
            dtstart: ical.Time.fromJSDate(currentDate, true).toString(),
            dtend: ical.Time.fromJSDate(newEnd, true).toString(),
          },
        });
      }
      count++;
    }
  }
  catch (error) {
    consola.warn("Failed to expand recurring event:", error);
    return [event];
  }

  return events;
}

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const now = new Date();
    const startDate = query.start ? new Date(query.start as string) : new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const endDate = query.end ? new Date(query.end as string) : new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());

    const events = await prisma.calendarEvent.findMany({
      where: {
        AND: [
          { start: { lte: endDate } },
          {
            OR: [
              { ical_event: { not: Prisma.DbNull } },
              { end: { gte: startDate } },
            ],
          },
        ],
      },
      select: {
        id: true,
        title: true,
        description: true,
        start: true,
        end: true,
        allDay: true,
        color: true,
        location: true,
        ical_event: true,
        users: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
                color: true,
              },
            },
          },
        },
      },
      orderBy: {
        start: "asc",
      },
    });

    const mappedEvents: CalendarEvent[] = events.map(event => ({
      id: event.id,
      title: event.title,
      description: event.description || undefined,
      start: event.start,
      end: event.end,
      allDay: event.allDay,
      color: event.color as string | string[] | undefined,
      location: event.location || undefined,
      ical_event: event.ical_event as ICalEvent | undefined,
      users: event.users.map(ce => ce.user),
    }));

    const expandedEvents = mappedEvents.flatMap(event =>
      expandRecurringEvent(event, startDate, endDate),
    );

    return expandedEvents.sort((a, b) =>
      new Date(a.start).getTime() - new Date(b.start).getTime(),
    );
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to fetch calendar events: ${error}`,
    });
  }
});
