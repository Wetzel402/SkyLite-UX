import { getRouterParam, readBody } from "h3";

import prisma from "~/lib/prisma";

import { ensureShiftsIntegration } from "../../../../../utils/shiftsIntegration";

export default defineEventHandler(async (event) => {
  const integrationId = getRouterParam(event, "id");
  if (!integrationId)
    throw createError({ statusCode: 400, message: "integration id required" });
  await ensureShiftsIntegration(integrationId);
  const body = await readBody(event);
  const { userId, shiftRotationId, startDate, endDate } = body;
  if (!userId || typeof userId !== "string")
    throw createError({ statusCode: 400, message: "userId is required" });
  if (!shiftRotationId || typeof shiftRotationId !== "string")
    throw createError({ statusCode: 400, message: "shiftRotationId is required" });
  if (!startDate)
    throw createError({ statusCode: 400, message: "startDate is required" });
  const rotation = await prisma.shiftRotation.findFirst({
    where: { id: shiftRotationId, integrationId },
  });
  if (!rotation)
    throw createError({ statusCode: 404, message: "Rotation not found" });
  const assignment = await prisma.shiftAssignment.create({
    data: {
      userId,
      shiftRotationId,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
    },
    include: {
      user: { select: { id: true, name: true, avatar: true, color: true } },
      shiftRotation: { select: { id: true, name: true, cycleWeeks: true } },
    },
  });
  return assignment;
});
