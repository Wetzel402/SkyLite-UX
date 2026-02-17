import { consola } from "consola";
import { createError, defineEventHandler, getQuery } from "h3";

import type { CalendarEvent } from "~/types/calendar";

import prisma from "~/lib/prisma";

import { expandShiftsToEvents } from "../../../integrations/shifts/expandShifts";

export default defineEventHandler(async (event) => {
  const integrationId = getQuery(event).integrationId as string;

  if (!integrationId || typeof integrationId !== "string") {
    throw createError({
      statusCode: 400,
      message: "integrationId is required",
    });
  }

  const integration = await prisma.integration.findFirst({
    where: {
      id: integrationId,
      type: "calendar",
      service: "shifts",
      enabled: true,
    },
  });

  if (!integration) {
    throw createError({
      statusCode: 404,
      message: "Shifts integration not found or not enabled",
    });
  }

  const now = new Date();
  const startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const endDate = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());

  try {
    const settings = integration.settings as Record<string, unknown> | null;
    const events: CalendarEvent[] = await expandShiftsToEvents(
      integrationId,
      settings as Parameters<typeof expandShiftsToEvents>[1],
      startDate,
      endDate,
    );
    return { events };
  }
  catch (err) {
    consola.error("Shifts API: Failed to expand shift events:", err);
    throw createError({
      statusCode: 500,
      message: err instanceof Error ? err.message : "Failed to fetch shift events",
    });
  }
});
