import { getRouterParam, readBody } from "h3";

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
  const body = await readBody(event);
  const { weekIndex, dayOfWeek, startTime, endTime, label, order } = body;
  if (typeof weekIndex !== "number" || weekIndex < 0)
    throw createError({ statusCode: 400, message: "weekIndex is required and must be >= 0" });
  if (typeof dayOfWeek !== "number" || dayOfWeek < 0 || dayOfWeek > 6)
    throw createError({ statusCode: 400, message: "dayOfWeek must be 0-6" });
  if (typeof startTime !== "string" || typeof endTime !== "string")
    throw createError({ statusCode: 400, message: "startTime and endTime are required" });
  const slot = await prisma.shiftSlot.create({
    data: {
      shiftRotationId: rotationId,
      weekIndex,
      dayOfWeek,
      startTime: String(startTime).trim(),
      endTime: String(endTime).trim(),
      label: typeof label === "string" ? label.trim() || null : null,
      order: typeof order === "number" ? order : 0,
    },
  });
  return slot;
});
