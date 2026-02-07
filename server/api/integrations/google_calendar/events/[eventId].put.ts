import { PrismaClient } from "@prisma/client";
import { consola } from "consola";
import { createError, defineEventHandler, getRouterParam, readBody } from "h3";
import ical from "ical.js";

import type { CalendarEvent } from "~/types/calendar";

import { isGoogleApiError } from "~/types/errors";

import type { ICalEvent } from "../../../../integrations/iCal/types";

import { GoogleCalendarServerService } from "../../../../integrations/google_calendar/client";
import { parseRRuleString } from "../../../../utils/rrule";

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

    const onTokenRefresh = async (id: string, newAccessToken: string, newExpiry: number) => {
      try {
        const existingIntegration = await prisma.integration.findUnique({ where: { id } });
        if (!existingIntegration)
          return;

        const currentSettings = (existingIntegration.settings as Record<string, unknown>) || {};
        await prisma.integration.update({
          where: { id },
          data: {
            settings: {
              ...currentSettings,
              accessToken: newAccessToken,
              tokenExpiry: newExpiry,
            },
          },
        });
      }
      catch (error) {
        consola.error(`Failed to save refreshed token for integration ${id}:`, error);
      }
    };

    const service = new GoogleCalendarServerService(
      clientId,
      clientSecret,
      integration.apiKey,
      accessToken,
      tokenExpiry,
      integrationId,
      onTokenRefresh,
    );

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

    const start = updatedEvent.start.dateTime ? new Date(updatedEvent.start.dateTime) : new Date(`${updatedEvent.start.date}T00:00:00Z`);
    const end = updatedEvent.end.dateTime ? new Date(updatedEvent.end.dateTime) : new Date(`${updatedEvent.end.date}T00:00:00Z`);
    const isAllDay = !updatedEvent.start.dateTime;

    const rrule = updatedEvent.recurrence && updatedEvent.recurrence.length > 0
      ? parseRRuleString(updatedEvent.recurrence[0] || "")
      : undefined;

    let icalEvent: ICalEvent | undefined;

    if (rrule) {
      const startTime = ical.Time.fromJSDate(start, true);
      const endTime = ical.Time.fromJSDate(end, true);

      icalEvent = {
        type: "VEVENT",
        uid: updatedEvent.id,
        summary: updatedEvent.summary,
        description: updatedEvent.description,
        location: updatedEvent.location,
        dtstart: startTime.toString(),
        dtend: endTime.toString(),
        rrule,
      };
    }

    return {
      id: updatedEvent.id,
      title: updatedEvent.summary,
      description: updatedEvent.description || "",
      start,
      end,
      allDay: isAllDay,
      location: updatedEvent.location,
      integrationId,
      calendarId,
      ical_event: icalEvent,
    };
  }
  catch (error: unknown) {
    const err = isGoogleApiError(error) ? error : { message: String(error) };

    consola.error("Integrations Google Calendar Event Update: Error details:", {
      code: err?.code,
      message: err?.message,
      response: err?.response?.data,
    });

    if (err?.code === 401 || err?.message?.includes("invalid_grant") || err?.message?.includes("Invalid Credentials")) {
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
