import { getRouterParam } from "h3";

import prisma from "~/lib/prisma";

import { ensureShiftsIntegration } from "../../../../../utils/shiftsIntegration";

export default defineEventHandler(async (event) => {
  const integrationId = getRouterParam(event, "id");
  if (!integrationId)
    throw createError({ statusCode: 400, message: "integration id required" });
  await ensureShiftsIntegration(integrationId);
  const rotations = await prisma.shiftRotation.findMany({
    where: { integrationId },
    include: {
      _count: { select: { slots: true, assignments: true } },
    },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  return rotations;
});
