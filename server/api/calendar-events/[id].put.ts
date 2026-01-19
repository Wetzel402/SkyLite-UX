import prisma from "~/lib/prisma";

import { broadcastNativeDataChange } from "../../plugins/02.syncManager";

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, "id");
    const body = await readBody(event);
    const { title, description, start, end, allDay, color, location, ical_event, users } = body;

    if (!id) {
      throw createError({
        statusCode: 400,
        message: "Calendar event ID is required",
      });
    }

    const utcStart = new Date(start);
    const utcEnd = new Date(end);

    const calendarEvent = await prisma.calendarEvent.update({
      where: { id },
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
          deleteMany: {},
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
    broadcastNativeDataChange("calendar-events", "update", calendarEvent.id);

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
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to update calendar event: ${error}`,
    });
  }
});
