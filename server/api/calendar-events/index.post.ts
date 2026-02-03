import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { title, description, start, end, allDay, color, location, ical_event, users } = body;

    const utcStart = new Date(start);
    const utcEnd = new Date(end);

    const calendarEvent = await prisma.calendarEvent.create({
      data: {
        title,
        description,
        start: utcStart,
        end: utcEnd,
        allDay: allDay || false,
        color: color || null,
        location: location || null,
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
      users: (calendarEvent.users || []).map(ce => ce.user),
    };
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to create calendar event: ${error}`,
    });
  }
});
