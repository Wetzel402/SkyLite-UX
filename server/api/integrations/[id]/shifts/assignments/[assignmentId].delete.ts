import { getRouterParam } from "h3";

import prisma from "~/lib/prisma";

import { ensureShiftsIntegration } from "../../../../../utils/shiftsIntegration";

export default defineEventHandler(async (event) => {
  const integrationId = getRouterParam(event, "id");
  const assignmentId = getRouterParam(event, "assignmentId");
  if (!integrationId || !assignmentId)
    throw createError({ statusCode: 400, message: "id and assignmentId required" });
  await ensureShiftsIntegration(integrationId);
  const result = await prisma.shiftAssignment.deleteMany({
    where: {
      id: assignmentId,
      shiftRotation: { integrationId },
    },
  });
  if (result.count === 0)
    throw createError({ statusCode: 404, message: "Assignment not found" });
  return { ok: true };
});
