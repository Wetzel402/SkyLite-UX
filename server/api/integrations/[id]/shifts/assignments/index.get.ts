import { getRouterParam } from "h3";

import prisma from "~/lib/prisma";

import { ensureShiftsIntegration } from "../../../../../utils/shiftsIntegration";

export default defineEventHandler(async (event) => {
  const integrationId = getRouterParam(event, "id");
  if (!integrationId)
    throw createError({ statusCode: 400, message: "integration id required" });
  await ensureShiftsIntegration(integrationId);
  const assignments = await prisma.shiftAssignment.findMany({
    where: {
      shiftRotation: { integrationId },
    },
    include: {
      user: { select: { id: true, name: true, avatar: true, color: true } },
      shiftRotation: { select: { id: true, name: true, cycleWeeks: true, color: true } },
    },
    orderBy: { startDate: "asc" },
  });
  return assignments;
});
