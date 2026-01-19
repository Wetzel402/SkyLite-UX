import { consola } from "consola";
import { createError, defineEventHandler, getQuery, getRouterParam } from "h3";
import ical from "ical.js";

import prisma from "~/lib/prisma";

import type { ICalEvent } from "../../../../integrations/iCal/types";

import { GoogleCalendarServerService } from "../../../../integrations/google_calendar/client";
import { getGoogleOAuthConfig } from "../../../../utils/googleOAuthConfig";
import { parseRRuleString } from "../../../../utils/rrule";

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, "eventId");
  const integrationId = getQuery(event).integrationId as string;
  const calendarId = getQuery(event).calendarId as string;

  if (!eventId || typeof eventId !== "string") {
    throw createError({
      statusCode: 400,
      message: "eventId is required",
    });
  }

  if (!integrationId || typeof integrationId !== "string") {
    throw createError({
      statusCode: 400,
      message: "integrationId is required",
    });
  }

  if (!calendarId || typeof calendarId !== "string") {
    throw createError({
      statusCode: 400,
      message: "calendarId is required",
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
      message: "Google Calendar integration not found or not configured",
    });
  }

  if (!integration.apiKey) {
    throw createError({
      statusCode: 400,
      message: "Google Calendar integration is not authenticated. Please complete OAuth flow.",
    });
  }

  // Get OAuth credentials from runtime config or environment variables
  const oauthConfig = getGoogleOAuthConfig();
  if (!oauthConfig) {
    throw createError({
      statusCode: 500,
      message: "Google Calendar integration is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.",
    });
  }
  const { clientId, clientSecret } = oauthConfig;

  const settings = integration.settings as Record<string, unknown> || {};
  const accessToken = settings.accessToken as string;
  const tokenExpiry = settings.tokenExpiry as number;

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

  try {
    const googleEvent = await service.fetchEvent(calendarId, eventId);

    const startDateTime = googleEvent.start.dateTime || googleEvent.start.date;
    const endDateTime = googleEvent.end.dateTime || googleEvent.end.date;

    const start = new Date(startDateTime || "");
    const end = new Date(endDateTime || "");
    const isAllDay = !googleEvent.start.dateTime && !!googleEvent.start.date;

    const rrule = googleEvent.recurrence && googleEvent.recurrence.length > 0
      ? parseRRuleString(googleEvent.recurrence[0] || "")
      : undefined;

    let icalEvent: ICalEvent | undefined;

    if (rrule) {
      const startTime = ical.Time.fromJSDate(start, true);
      const endTime = ical.Time.fromJSDate(end, true);

      icalEvent = {
        type: "VEVENT",
        uid: googleEvent.id,
        summary: googleEvent.summary,
        description: googleEvent.description,
        location: googleEvent.location,
        dtstart: startTime.toString(),
        dtend: endTime.toString(),
        rrule,
      };
    }

    const calendarEvent = {
      id: googleEvent.id,
      title: googleEvent.summary,
      description: googleEvent.description || "",
      start,
      end,
      allDay: isAllDay,
      location: googleEvent.location,
      integrationId,
      calendarId: googleEvent.calendarId,
      ical_event: icalEvent,
    };

    return calendarEvent;
  }
  catch (error) {
    consola.error(`Failed to fetch Google Calendar event ${eventId}:`, error);
    throw createError({
      statusCode: 500,
      message: `Failed to fetch event: ${error}`,
    });
  }
});
