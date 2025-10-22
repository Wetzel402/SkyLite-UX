import { PrismaClient } from "@prisma/client";
import { consola } from "consola";
import { createError, defineEventHandler, getRouterParam, readBody } from "h3";

import type { CalendarEvent } from "~/types/calendar";

import { GoogleCalendarServerService } from "../../../../integrations/google_calendar/client";

const prisma = new PrismaClient();

function rruleObjectToString(rrule: {
  freq: string;
  interval?: number;
  byday?: string[];
  bymonth?: number[];
  count?: number;
  until?: string;
}): string {
  const parts = [`FREQ=${rrule.freq.toUpperCase()}`];

  if (rrule.interval && rrule.interval > 1) {
    parts.push(`INTERVAL=${rrule.interval}`);
  }

  if (rrule.count) {
    parts.push(`COUNT=${rrule.count}`);
  }

  if (rrule.until) {
    parts.push(`UNTIL=${rrule.until}`);
  }

  if (rrule.byday && rrule.byday.length > 0) {
    parts.push(`BYDAY=${rrule.byday.join(",")}`);
  }

  if (rrule.bymonth && rrule.bymonth.length > 0) {
    parts.push(`BYMONTH=${rrule.bymonth.join(",")}`);
  }

  return `RRULE:${parts.join(";")}`;
}

export default defineEventHandler(async (event) => {
  try {
    const eventId = getRouterParam(event, "eventId");
    const body = await readBody(event);
    const { integrationId, calendarId, ...eventData }: { integrationId: string; calendarId: string } & CalendarEvent = body;

    if (!eventId) {
      throw createError({
        statusCode: 400,
        message: "Event ID is required",
      });
    }

    if (!integrationId || !calendarId) {
      throw createError({
        statusCode: 400,
        message: "integrationId and calendarId are required",
      });
    }

    const baseEventId = eventId.includes("-") ? eventId.split("-")[0] : eventId;

    const integration = await prisma.integration.findFirst({
      where: {
        id: integrationId,
        type: "calendar",
        service: "google",
        enabled: true,
      },
    });

    if (!integration) {
      throw createError({
        statusCode: 404,
        message: "Google Calendar integration not found or not configured",
      });
    }

    if (!integration.apiKey) {
      throw createError({
        statusCode: 400,
        message: "Google Calendar integration is not authenticated. Please complete OAuth flow.",
      });
    }

    const settings = integration.settings as Record<string, unknown> || {};
    const clientId = settings.clientId as string;
    const clientSecret = settings.clientSecret as string || "";
    const accessToken = settings.accessToken as string;
    const tokenExpiry = settings.tokenExpiry as number;

    if (!clientId) {
      throw createError({
        statusCode: 400,
        message: "Google Calendar integration is not properly configured",
      });
    }

    const service = new GoogleCalendarServerService(clientId, clientSecret, integration.apiKey, accessToken, tokenExpiry);

    const startDate = new Date(eventData.start);
    const endDate = new Date(eventData.end);

    const googleEventData = {
      summary: eventData.title,
      description: eventData.description,
      location: eventData.location,
      start: eventData.allDay
        ? { date: startDate.toISOString().split("T")[0] }
        : { dateTime: startDate.toISOString(), timeZone: "UTC" },
      end: eventData.allDay
        ? { date: endDate.toISOString().split("T")[0] }
        : { dateTime: endDate.toISOString(), timeZone: "UTC" },
      recurrence: eventData.ical_event?.rrule ? [rruleObjectToString(eventData.ical_event.rrule)] : undefined,
    };

    const updatedEvent = await service.updateEvent(calendarId as string, baseEventId as string, googleEventData);

    return {
      id: updatedEvent.id,
      title: updatedEvent.summary,
      description: updatedEvent.description || "",
      start: updatedEvent.start.dateTime ? new Date(updatedEvent.start.dateTime) : new Date(`${updatedEvent.start.date}T00:00:00Z`),
      end: updatedEvent.end.dateTime ? new Date(updatedEvent.end.dateTime) : new Date(`${updatedEvent.end.date}T00:00:00Z`),
      allDay: !updatedEvent.start.dateTime,
      location: updatedEvent.location,
      integrationId,
      calendarId,
      ical_event: updatedEvent.recurrence
        ? {
            rrule: updatedEvent.recurrence[0]?.replace("RRULE:", "") || undefined,
          }
        : undefined,
    };
  }
  catch (error: unknown) {
    const err = error as { code?: number; message?: string; response?: { data?: unknown } };

    consola.error("Integrations Google Calendar Event Update: Error details:", {
      code: err?.code,
      message: err?.message,
      response: err?.response?.data,
    });

    if (err?.code === 401 || err?.code === 400 || err?.message?.includes("invalid_grant") || err?.message?.includes("invalid_request") || err?.message?.includes("Invalid Credentials")) {
      const integrationId = (await readBody(event)).integrationId;
      if (integrationId) {
        await prisma.integration.update({
          where: { id: integrationId },
          data: {
            apiKey: null,
            settings: {
              ...((await prisma.integration.findUnique({ where: { id: integrationId } }))?.settings as object),
              needsReauth: true,
            },
          },
        });
      }

      throw createError({
        statusCode: 401,
        message: "Google Calendar authentication expired. Please re-authorize in Settings.",
      });
    }

    consola.error("Integrations Google Calendar Event Update: Failed to update event:", error);
    throw createError({
      statusCode: 400,
      message: error instanceof Error ? error.message : "Failed to update Google Calendar event",
    });
  }
});
