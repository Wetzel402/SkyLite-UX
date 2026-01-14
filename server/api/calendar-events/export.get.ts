import consola from "consola";
import ical from "ical.js";

import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    // Fetch all calendar events from the database
    const events = await prisma.calendarEvent.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        start: true,
        end: true,
        allDay: true,
        location: true,
        ical_event: true,
        users: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        start: "asc",
      },
    });

    // Create a new iCalendar component
    const calendar = new ical.Component(["vcalendar", [], []]);
    calendar.updatePropertyWithValue("prodid", "-//SkyLite-UX//Calendar//EN");
    calendar.updatePropertyWithValue("version", "2.0");
    calendar.updatePropertyWithValue("calscale", "GREGORIAN");
    calendar.updatePropertyWithValue("method", "PUBLISH");
    calendar.updatePropertyWithValue("x-wr-calname", "SkyLite-UX Calendar");

    // Add each event to the calendar
    for (const dbEvent of events) {
      const vevent = new ical.Component("vevent");

      // Generate UID - use existing UID from ical_event if available, otherwise create one
      const uid = (dbEvent.ical_event as Record<string, unknown>)?.uid as string
        || `${dbEvent.id}@skylite-ux`;
      vevent.updatePropertyWithValue("uid", uid);

      // Add summary (title)
      vevent.updatePropertyWithValue("summary", dbEvent.title);

      // Add description if present
      if (dbEvent.description) {
        vevent.updatePropertyWithValue("description", dbEvent.description);
      }

      // Add location if present
      if (dbEvent.location) {
        vevent.updatePropertyWithValue("location", dbEvent.location);
      }

      // Add start time
      const startDate = new Date(dbEvent.start);
      if (dbEvent.allDay) {
        const dtstart = ical.Time.fromJSDate(startDate, true);
        dtstart.isDate = true;
        vevent.updatePropertyWithValue("dtstart", dtstart);
      }
      else {
        const dtstart = ical.Time.fromJSDate(startDate, false);
        vevent.updatePropertyWithValue("dtstart", dtstart);
      }

      // Add end time
      const endDate = new Date(dbEvent.end);
      if (dbEvent.allDay) {
        const dtend = ical.Time.fromJSDate(endDate, true);
        dtend.isDate = true;
        vevent.updatePropertyWithValue("dtend", dtend);
      }
      else {
        const dtend = ical.Time.fromJSDate(endDate, false);
        vevent.updatePropertyWithValue("dtend", dtend);
      }

      // Add timestamp (DTSTAMP - required by iCal spec)
      const dtstamp = ical.Time.fromJSDate(new Date(), false);
      vevent.updatePropertyWithValue("dtstamp", dtstamp);

      // Add attendees (users assigned to the event)
      if (dbEvent.users && dbEvent.users.length > 0) {
        for (const assignment of dbEvent.users) {
          if (assignment.user) {
            const attendee = new ical.Property("attendee");
            attendee.setValue(`mailto:${assignment.user.name.toLowerCase().replace(/\s+/g, ".")}@skylite-ux.local`);
            attendee.setParameter("cn", assignment.user.name);
            attendee.setParameter("partstat", "ACCEPTED");
            vevent.addProperty(attendee);
          }
        }
      }

      // Add recurrence rule if present in ical_event
      const icalEvent = dbEvent.ical_event as Record<string, unknown>;
      if (icalEvent?.rrule) {
        const rrule = new ical.Property("rrule", vevent);
        rrule.setValue(icalEvent.rrule as string);
        vevent.addProperty(rrule);
      }

      calendar.addSubcomponent(vevent);
    }

    // Generate ICS content
    const icsContent = calendar.toString();

    // Set response headers for file download
    setResponseHeaders(event, {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"skylite-calendar.ics\"",
      "Cache-Control": "no-cache",
    });

    consola.info(`Exported ${events.length} calendar events to ICS format`);

    return icsContent;
  }
  catch (error) {
    consola.error("Failed to export calendar events:", error);
    throw createError({
      statusCode: 500,
      message: `Failed to export calendar events: ${error}`,
    });
  }
});
