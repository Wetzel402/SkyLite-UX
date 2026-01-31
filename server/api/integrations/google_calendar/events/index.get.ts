import { consola } from "consola";
import { createError, defineEventHandler, getQuery } from "h3";
import ical from "ical.js";

import type { CalendarEvent } from "~/types/calendar";

import prisma from "~/lib/prisma";

import type { GoogleCalendarEvent } from "../../../../integrations/google_calendar/types";
import type { ICalEvent } from "../../../../integrations/iCal/types";

import { GoogleCalendarServerService } from "../../../../integrations/google_calendar/client";
import { getGoogleOAuthConfig } from "../../../../utils/googleOAuthConfig";
import { expandRecurringEvents, parseRRuleString } from "../../../../utils/rrule";

function convertToCalendarEvent(
  event: GoogleCalendarEvent,
  integrationId: string,
): CalendarEvent {
  const startDateTime = event.start.dateTime || event.start.date;
  const endDateTime = event.end.dateTime || event.end.date;

  const start = new Date(startDateTime || "");
  const end = new Date(endDateTime || "");
  const isAllDay = !event.start.dateTime && !!event.start.date;

  const rrule = event.recurrence && event.recurrence.length > 0
    ? parseRRuleString(event.recurrence[0] || "")
    : undefined;

  let icalEvent: ICalEvent | undefined;

  if (rrule) {
    const startTime = ical.Time.fromJSDate(start, true);
    const endTime = ical.Time.fromJSDate(end, true);

    icalEvent = {
      type: "VEVENT",
      uid: event.id,
      summary: event.summary,
      description: event.description,
      location: event.location,
      dtstart: startTime.toString(),
      dtend: endTime.toString(),
      rrule,
    };
  }

  return {
    id: event.id,
    title: event.summary,
    description: event.description || "",
    start,
    end,
    allDay: isAllDay,
    location: event.location,
    integrationId,
    calendarId: event.calendarId,
    ical_event: icalEvent,
  };
}

export default defineEventHandler(async (event) => {
  const integrationId = getQuery(event).integrationId as string;

  if (!integrationId || typeof integrationId !== "string") {
    throw createError({
      statusCode: 400,
      message: "integrationId is required",
    });
  }

  if (integrationId === "temp") {
    throw createError({
      statusCode: 400,
      message: "Cannot fetch events for temporary integration. Please complete OAuth authentication first.",
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
  const calendars = (settings.calendars as { id: string; enabled: boolean }[]) || [];
  const selectedCalendars = calendars.filter(c => c.enabled).map(c => c.id);

  if (selectedCalendars.length === 0) {
    return { events: [], calendars: [] };
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

  try {
    const events = await service.fetchEvents(selectedCalendars);
    const calendarEvents = events.map(event => convertToCalendarEvent(event, integrationId));
    const now = new Date();
    const startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const endDate = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
    const expandedEvents = expandRecurringEvents(calendarEvents, startDate, endDate);

    return { events: expandedEvents, calendars: settings.calendars || [] };
  }
  catch (error: unknown) {
    const err = error as {
      code?: number;
      statusCode?: number;
      message?: string;
      response?: { status?: number; data?: { error?: string; error_description?: string } };
    };

    consola.error("Integrations Google Calendar Events: Error details:", {
      code: err?.code,
      statusCode: err?.statusCode,
      message: err?.message,
      responseStatus: err?.response?.status,
      responseData: err?.response?.data,
    });

    // Check for authentication/authorization errors
    // Per Google OAuth2 docs, invalid_grant means refresh token is expired/revoked
    const isAuthError = err?.code === 401
      || err?.statusCode === 401
      || err?.response?.status === 401
      || err?.message?.includes("invalid_grant")
      || err?.message?.includes("Invalid Credentials")
      || err?.message?.includes("Refresh token expired")
      || err?.message?.includes("Token has been expired or revoked")
      || err?.response?.data?.error === "invalid_grant";

    if (isAuthError) {
      consola.warn(`Google Calendar integration ${integration.name} needs re-authorization`);

      // Mark integration as needing reauth and clear tokens
      await prisma.integration.update({
        where: { id: integrationId },
        data: {
          apiKey: null,
          settings: {
            ...(integration.settings as object),
            needsReauth: true,
            accessToken: null,
            tokenExpiry: null,
          },
        },
      });

      throw createError({
        statusCode: 401,
        message: "Google Calendar authentication expired. Please re-authorize in Settings.",
      });
    }

    // For non-auth errors, throw as 500 (server error)
    consola.error("Integrations Google Calendar Events: Failed to fetch events:", error);
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : "Failed to fetch Google Calendar events",
    });
  }
});
