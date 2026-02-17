import { getRouterParam, readBody } from "h3";

import prisma from "~/lib/prisma";

import { ensureShiftsIntegration } from "../../../../../utils/shiftsIntegration";

export default defineEventHandler(async (event) => {
  const integrationId = getRouterParam(event, "id");
  const assignmentId = getRouterParam(event, "assignmentId");
  if (!integrationId || !assignmentId)
    throw createError({ statusCode: 400, message: "id and assignmentId required" });
  await ensureShiftsIntegration(integrationId);
  const body = await readBody(event);
  const { startDate, endDate } = body;
  const updateData: Record<string, unknown> = {};
  if (startDate !== undefined)
    updateData.startDate = new Date(startDate);
  if (endDate !== undefined)
    updateData.endDate = endDate ? new Date(endDate) : null;
  const result = await prisma.shiftAssignment.updateMany({
    where: {
      id: assignmentId,
      shiftRotation: { integrationId },
    },
    data: updateData,
  });
  if (result.count === 0)
    throw createError({ statusCode: 404, message: "Assignment not found" });
  return prisma.shiftAssignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: {
      user: { select: { id: true, name: true, avatar: true, color: true } },
      shiftRotation: { select: { id: true, name: true, cycleWeeks: true } },
    },
  });
});
