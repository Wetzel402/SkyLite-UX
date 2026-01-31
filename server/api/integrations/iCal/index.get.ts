import { PrismaClient } from "@prisma/client";
import { consola } from "consola";
import { createError, defineEventHandler, getQuery } from "h3";

import type { CalendarEvent } from "~/types/calendar";
import type { ICalSettings, UserWithColor } from "~/types/integrations";

import { DEFAULT_LOCAL_EVENT_COLOR } from "~/types/global";

import type { ICalEvent } from "../../../integrations/iCal/types";

import { ICalServerService } from "../../../integrations/iCal/client";

const prisma = new PrismaClient();

function convertToCalendarEvent(
  event: ICalEvent,
  integrationId: string,
  eventColor: string,
  users: UserWithColor[],
  useUserColors: boolean,
): CalendarEvent {
  // Parse iCal date/time format properly
  // DATE format: "20250130" -> need to insert separators
  // DATETIME format: "20250130T120000Z" -> ISO 8601 compatible
  const isDateOnly = !event.dtstart.includes("T") && !event.dtstart.includes("Z");

  let start: Date;
  let end: Date;

  if (isDateOnly) {
    // DATE format: "20250130" -> "2025-01-30"
    const startStr = event.dtstart.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3");
    const endStr = event.dtend.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3");
    start = new Date(startStr);
    end = new Date(endStr);
  }
  else {
    // DATETIME format: "20250130T120000Z" -> "2025-01-30T12:00:00Z"
    const startStr = event.dtstart.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(.*)$/, "$1-$2-$3T$4:$5:$6$7");
    const endStr = event.dtend.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(.*)$/, "$1-$2-$3T$4:$5:$6$7");
    start = new Date(startStr);
    end = new Date(endStr);
  }

  // Check if this is a midnight-to-midnight event (timed event spanning exactly 24 hours)
  const isMidnightToMidnight = start.getUTCHours() === 0
    && start.getUTCMinutes() === 0
    && start.getUTCSeconds() === 0
    && end.getUTCHours() === 0
    && end.getUTCMinutes() === 0
    && end.getUTCSeconds() === 0
    && end.getTime() - start.getTime() === 24 * 60 * 60 * 1000;

  const isAllDay = isDateOnly || isMidnightToMidnight;

  let color: string | string[] | undefined = eventColor || DEFAULT_LOCAL_EVENT_COLOR;
  if (useUserColors && users.length > 0) {
    const userColors = users.map((user: UserWithColor) => user.color).filter((color): color is string => color !== null);
    if (userColors.length > 0) {
      color = userColors.length === 1 ? userColors[0] : userColors;
    }
    else {
      color = eventColor || DEFAULT_LOCAL_EVENT_COLOR;
    }
  }
  else {
    color = eventColor || DEFAULT_LOCAL_EVENT_COLOR;
  }

  // Make event ID unique across all iCal integrations by combining integrationId + UID
  // This prevents conflicts when multiple iCal feeds have events with the same UID
  const uniqueId = `${integrationId}-${event.uid}`;

  return {
    id: uniqueId,
    title: event.summary,
    description: event.description || "",
    start,
    end,
    allDay: isAllDay,
    color,
    location: event.location,
    ical_event: event,
    integrationId,
    calendarId: integrationId, // Add calendarId to track which feed this came from
    users: useUserColors ? users : undefined,
  };
}

export default defineEventHandler(async (event) => {
  const integrationId = getQuery(event).integrationId as string;
  const baseUrl = getQuery(event).baseUrl as string;

  if (!integrationId || typeof integrationId !== "string") {
    throw createError({
      statusCode: 400,
      message: "integrationId is required",
    });
  }

  let integration;
  let icalUrl: string;
  let eventColor = DEFAULT_LOCAL_EVENT_COLOR;
  let userIds: string[] = [];
  let useUserColors = false;

  if (integrationId === "temp" || integrationId.startsWith("temp-")) {
    if (!baseUrl || typeof baseUrl !== "string") {
      throw createError({
        statusCode: 400,
        message: "baseUrl is required for temporary integration testing",
      });
    }
    icalUrl = baseUrl;
  }
  else {
    integration = await prisma.integration.findFirst({
      where: {
        id: integrationId,
        type: "calendar",
        service: "iCal",
        enabled: true,
      },
    });

    if (!integration || !integration.baseUrl) {
      throw createError({
        statusCode: 404,
        message: "iCal integration not found or not configured",
      });
    }

    if (integration.type !== "calendar" || integration.service !== "iCal") {
      throw createError({
        statusCode: 400,
        message: "Invalid integration type for iCal API",
      });
    }

    icalUrl = integration.baseUrl;

    // Get settings from integration
    const settings = (integration.settings as ICalSettings) || {};
    eventColor = settings.eventColor || DEFAULT_LOCAL_EVENT_COLOR;
    useUserColors = settings.useUserColors || false;

    if (typeof settings.user === "string") {
      userIds = [settings.user];
    }
    else if (Array.isArray(settings.user)) {
      userIds = settings.user;
    }
  }

  // Fetch users if needed
  let users: UserWithColor[] = [];
  if (useUserColors && userIds.length > 0) {
    try {
      const allUsers = await prisma.user.findMany({
        where: {
          id: {
            in: userIds,
          },
        },
        select: {
          id: true,
          name: true,
          color: true,
        },
      });
      users = allUsers;
    }
    catch (error) {
      consola.warn("Integrations iCal Index: Failed to fetch users for iCal integration:", error);
    }
  }

  const service = new ICalServerService(integrationId, icalUrl);
  try {
    const rawEvents = await service.fetchEventsFromUrl(icalUrl);

    const calendarEvents = rawEvents.map(event =>
      convertToCalendarEvent(event, integrationId, eventColor, users, useUserColors),
    );

    return { events: calendarEvents };
  }
  catch (error) {
    consola.error("Integrations iCal Index: Failed to fetch iCal events:", error);
    throw createError({
      statusCode: 400,
      message: error instanceof Error ? error.message : "Failed to fetch iCal events",
    });
  }
});
