import type { Integration } from "@prisma/client";

import { createError } from "h3";

import prisma from "~/lib/prisma";

export async function ensureShiftsIntegration(
  integrationId: string,
): Promise<Integration> {
  const integration = await prisma.integration.findUnique({
    where: { id: integrationId },
  });
  if (!integration) {
    throw createError({
      statusCode: 404,
      message: "Integration not found",
    });
  }
  if (integration.type !== "calendar" || integration.service !== "shifts") {
    throw createError({
      statusCode: 400,
      message: "Integration is not a shifts integration",
    });
  }
  return integration;
}
