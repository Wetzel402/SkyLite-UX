import { getRouterParam } from "h3";

import prisma from "~/lib/prisma";

import { ensureShiftsIntegration } from "../../../../../utils/shiftsIntegration";

export default defineEventHandler(async (event) => {
  const integrationId = getRouterParam(event, "id");
  const rotationId = getRouterParam(event, "rotationId");
  if (!integrationId || !rotationId)
    throw createError({ statusCode: 400, message: "id and rotationId required" });
  await ensureShiftsIntegration(integrationId);
  const result = await prisma.shiftRotation.deleteMany({
    where: { id: rotationId, integrationId },
  });
  if (result.count === 0)
    throw createError({ statusCode: 404, message: "Rotation not found" });
  return { ok: true };
});
