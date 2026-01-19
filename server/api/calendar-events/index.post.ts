import prisma from "~/lib/prisma";

import { broadcastNativeDataChange } from "../../plugins/02.syncManager";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { title, description, start, end, allDay, color, location, ical_event, users } = body;

    // Validate required fields
    if (!title || typeof title !== "string" || title.trim() === "") {
      throw createError({
        statusCode: 400,
        message: "Event title is required",
      });
    }

    if (!start || !end) {
      throw createError({
        statusCode: 400,
        message: "Start and end times are required",
      });
    }

    const utcStart = new Date(start);
    const utcEnd = new Date(end);

    if (utcEnd < utcStart) {
      throw createError({
        statusCode: 400,
        message: "End time must be after start time",
      });
    }

    const calendarEvent = await prisma.calendarEvent.create({
      data: {
        title,
        description,
        start: utcStart,
        end: utcEnd,
        allDay: allDay || false,
        color: color || null,
        location,
        ical_event: ical_event || null,
        users: {
          create: users?.map((user: { id: string }) => ({
            userId: user.id,
          })) || [],
        },
      },
      include: {
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
    });

    // Broadcast the change to all connected clients
    broadcastNativeDataChange("calendar-events", "create", calendarEvent.id);

    return {
      id: calendarEvent.id,
      title: calendarEvent.title,
      description: calendarEvent.description,
      start: calendarEvent.start,
      end: calendarEvent.end,
      allDay: calendarEvent.allDay,
      color: calendarEvent.color as string | string[] | undefined,
      location: calendarEvent.location,
      ical_event: calendarEvent.ical_event,
      users: calendarEvent.users.map(ce => ce.user),
    };
  }
  catch (error: unknown) {
    // Re-throw if it's already an H3 error (validation error)
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      message: `Failed to create calendar event: ${error}`,
    });
  }
});
