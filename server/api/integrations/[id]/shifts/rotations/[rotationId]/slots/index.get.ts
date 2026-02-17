import { getRouterParam } from "h3";

import prisma from "~/lib/prisma";

import { ensureShiftsIntegration } from "../../../../../../../utils/shiftsIntegration";

export default defineEventHandler(async (event) => {
  const integrationId = getRouterParam(event, "id");
  const rotationId = getRouterParam(event, "rotationId");
  if (!integrationId || !rotationId)
    throw createError({ statusCode: 400, message: "id and rotationId required" });
  await ensureShiftsIntegration(integrationId);
  const rotation = await prisma.shiftRotation.findFirst({
    where: { id: rotationId, integrationId },
  });
  if (!rotation)
    throw createError({ statusCode: 404, message: "Rotation not found" });
  const slots = await prisma.shiftSlot.findMany({
    where: { shiftRotationId: rotationId },
    orderBy: { order: "asc" },
  });
  return slots;
});
