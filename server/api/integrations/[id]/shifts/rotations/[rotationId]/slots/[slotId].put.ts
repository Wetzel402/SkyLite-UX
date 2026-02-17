import { getRouterParam, readBody } from "h3";

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
  const body = await readBody(event);
  const { weekIndex, dayOfWeek, startTime, endTime, label, order } = body;
  const updateData: Record<string, unknown> = {};
  if (typeof weekIndex === "number" && weekIndex >= 0)
    updateData.weekIndex = weekIndex;
  if (typeof dayOfWeek === "number" && dayOfWeek >= 0 && dayOfWeek <= 6)
    updateData.dayOfWeek = dayOfWeek;
  if (typeof startTime === "string")
    updateData.startTime = startTime.trim();
  if (typeof endTime === "string")
    updateData.endTime = endTime.trim();
  if (label !== undefined)
    updateData.label = typeof label === "string" ? (label.trim() || null) : null;
  if (typeof order === "number")
    updateData.order = order;
  const result = await prisma.shiftSlot.updateMany({
    where: { id: slotId, shiftRotationId: rotationId },
    data: updateData,
  });
  if (result.count === 0)
    throw createError({ statusCode: 404, message: "Slot not found" });
  return prisma.shiftSlot.findUniqueOrThrow({ where: { id: slotId } });
});
