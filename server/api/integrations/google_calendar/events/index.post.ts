import { PrismaClient } from "@prisma/client";
import { consola } from "consola";
import { createError, defineEventHandler, readBody } from "h3";
import ical from "ical.js";

import type { CalendarEvent } from "~/types/calendar";

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
    const body = await readBody(event);
    const { integrationId, calendarId, ...eventData }: { integrationId: string; calendarId: string } & CalendarEvent = body;

    if (!integrationId || !calendarId) {
      throw createError({
        statusCode: 400,
        message: "integrationId and calendarId are required",
      });
    }

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
        message: "Google Calendar integration not found",
      });
    }

    if (!integration.apiKey) {
      throw createError({
        statusCode: 400,
        message: "Google Calendar integration is not authenticated",
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
        message: "Client ID not found in integration settings",
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

    const createdEvent = await service.addEvent(calendarId, googleEventData);

    const start = createdEvent.start.dateTime ? new Date(createdEvent.start.dateTime) : new Date(`${createdEvent.start.date}T00:00:00Z`);
    const end = createdEvent.end.dateTime ? new Date(createdEvent.end.dateTime) : new Date(`${createdEvent.end.date}T00:00:00Z`);
    const isAllDay = !createdEvent.start.dateTime;

    const rrule = createdEvent.recurrence && createdEvent.recurrence.length > 0
      ? parseRRuleString(createdEvent.recurrence[0] || "")
      : undefined;

    let icalEvent: ICalEvent | undefined;

    if (rrule) {
      const startTime = ical.Time.fromJSDate(start, true);
      const endTime = ical.Time.fromJSDate(end, true);

      icalEvent = {
        type: "VEVENT",
        uid: createdEvent.id,
        summary: createdEvent.summary,
        description: createdEvent.description,
        location: createdEvent.location,
        dtstart: startTime.toString(),
        dtend: endTime.toString(),
        rrule,
      };
    }

    return {
      id: createdEvent.id,
      title: createdEvent.summary,
      description: createdEvent.description || "",
      start,
      end,
      allDay: isAllDay,
      location: createdEvent.location,
      integrationId,
      calendarId,
      ical_event: icalEvent,
    };
  }
  catch (error: unknown) {
    const err = error as { code?: number; message?: string; response?: { data?: unknown } };

    consola.error("Integrations Google Calendar Event Creation: Error details:", {
      code: err?.code,
      message: err?.message,
      response: err?.response?.data,
    });

    if (err?.code === 401 || err?.message?.includes("invalid_grant") || err?.message?.includes("Invalid Credentials")) {
      const body = await readBody(event);
      const integrationId = (body as { integrationId?: string }).integrationId;
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

    consola.error("Integrations Google Calendar Event Creation: Failed to create event:", error);
    throw createError({
      statusCode: 400,
      message: error instanceof Error ? error.message : "Failed to create Google Calendar event",
    });
  }
});
