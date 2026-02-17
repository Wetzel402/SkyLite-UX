import { getRouterParam, readBody } from "h3";

import prisma from "~/lib/prisma";

import { ensureShiftsIntegration } from "../../../../../utils/shiftsIntegration";

export default defineEventHandler(async (event) => {
  const integrationId = getRouterParam(event, "id");
  const rotationId = getRouterParam(event, "rotationId");
  if (!integrationId || !rotationId)
    throw createError({ statusCode: 400, message: "id and rotationId required" });
  await ensureShiftsIntegration(integrationId);
  const body = await readBody(event);
  const { name, cycleWeeks, color, order } = body;
  const rotation = await prisma.shiftRotation.updateMany({
    where: { id: rotationId, integrationId },
    data: {
      ...(typeof name === "string" && { name: name.trim() }),
      ...(typeof cycleWeeks === "number" && cycleWeeks >= 1 && { cycleWeeks }),
      ...(color !== undefined && { color: color ?? null }),
      ...(typeof order === "number" && { order }),
    },
  });
  if (rotation.count === 0)
    throw createError({ statusCode: 404, message: "Rotation not found" });
  return prisma.shiftRotation.findUniqueOrThrow({
    where: { id: rotationId },
  });
});
