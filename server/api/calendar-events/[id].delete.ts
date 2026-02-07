import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, "id");

    if (!id) {
      throw createError({
        statusCode: 400,
        message: "Calendar event ID is required",
      });
    }

    const dashCount = (id.match(/-/g) || []).length;
    const isExpandedEvent = dashCount > 1;
    let actualId = id;

    if (isExpandedEvent) {
      const parts = id.split("-");
      actualId = parts[0] || id; // Fallback to full ID if split fails
    }

    const existingEvent = await prisma.calendarEvent.findUnique({
      where: { id: actualId },
    });

    if (!existingEvent) {
      throw createError({
        statusCode: 404,
        message: "Calendar event not found",
      });
    }

    await prisma.calendarEvent.delete({
      where: { id: actualId },
    });

    return {
      success: true,
      message: isExpandedEvent
        ? "Entire recurring series deleted"
        : "Event deleted successfully",
    };
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to delete calendar event: ${error}`,
    });
  }
});
