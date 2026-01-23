import { consola } from "consola";
import { GoogleCalendarServerService } from "../../../integrations/google_calendar";
import prisma from "~/lib/prisma";
import { getGoogleOAuthConfig } from "../../../utils/googleOAuthConfig";

export default defineEventHandler(async () => {
  const integration = await prisma.integration.findFirst({
    where: {
      type: "calendar",
      service: "google",
      enabled: true,
    },
  });

  if (!integration || !integration.apiKey) {
    return { reminders: [] };
  }

  const oauthConfig = getGoogleOAuthConfig();
  if (!oauthConfig) {
    return { reminders: [] };
  }

  const settings = integration.settings as {
    accessToken?: string;
    expiryDate?: number;
    selectedCalendarIds?: string[];
  };

  const service = new GoogleCalendarServerService(
    oauthConfig.clientId,
    oauthConfig.clientSecret,
    integration.apiKey,
    settings.accessToken,
    settings.expiryDate,
    integration.id,
    async (integrationId, accessToken, expiry) => {
      await prisma.integration.update({
        where: { id: integrationId },
        data: {
          settings: {
            ...settings,
            accessToken,
            expiryDate: expiry,
          },
        },
      });
    }
  );

  try {
    const calendarIds = settings.selectedCalendarIds || [];
    if (calendarIds.length === 0) {
      return { reminders: [] };
    }

    const events = await service.fetchEvents(calendarIds);

    // Filter for short events that act as reminders (1 hour or less)
    const reminders = events.filter(event => {
      const start = new Date(event.start?.dateTime || event.start?.date || "");
      const end = new Date(event.end?.dateTime || event.end?.date || "");
      const duration = end.getTime() - start.getTime();
      return duration <= 3600000; // 1 hour or less
    });

    return {
      reminders: reminders.map(event => ({
        id: event.id,
        title: event.summary,
        description: event.description,
        dueDate: event.start?.dateTime || event.start?.date,
      })),
    };
  } catch (error: any) {
    consola.error("Failed to fetch calendar reminders:", error);
    return { reminders: [] };
  }
});
