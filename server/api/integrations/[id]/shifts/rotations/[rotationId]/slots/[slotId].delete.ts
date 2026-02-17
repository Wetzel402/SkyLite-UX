import { getRouterParam } from "h3";

import prisma from "~/lib/prisma";

import { ensureShiftsIntegration } from "../../../../../../../utils/shiftsIntegration";

export default defineEventHandler(async (event) => {
  const integrationId = getRouterParam(event, "id");
  const rotationId = getRouterParam(event, "rotationId");
  const slotId = getRouterParam(event, "slotId");
  if (!integrationId || !rotationId || !slotId)
    throw createError({ statusCode: 400, message: "id, rotationId and slotId required" });
  await ensureShiftsIntegration(integrationId);
  const rotation = await prisma.shiftRotation.findFirst({
    where: { id: rotationId, integrationId },
  });
  if (!rotation)
    throw createError({ statusCode: 404, message: "Rotation not found" });
  const result = await prisma.shiftSlot.deleteMany({
    where: { id: slotId, shiftRotationId: rotationId },
  });
  if (result.count === 0)
    throw createError({ statusCode: 404, message: "Slot not found" });
  return { ok: true };
});
