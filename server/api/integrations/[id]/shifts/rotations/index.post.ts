import { getRouterParam, readBody } from "h3";

import prisma from "~/lib/prisma";

import { ensureShiftsIntegration } from "../../../../../utils/shiftsIntegration";

export default defineEventHandler(async (event) => {
  const integrationId = getRouterParam(event, "id");
  if (!integrationId)
    throw createError({ statusCode: 400, message: "integration id required" });
  await ensureShiftsIntegration(integrationId);
  const body = await readBody(event);
  const { name, cycleWeeks, color, order } = body;
  if (!name || typeof name !== "string")
    throw createError({ statusCode: 400, message: "name is required" });
  if (typeof cycleWeeks !== "number" || cycleWeeks < 1)
    throw createError({ statusCode: 400, message: "cycleWeeks must be a positive number" });
  const rotation = await prisma.shiftRotation.create({
    data: {
      integrationId,
      name: name.trim(),
      cycleWeeks,
      color: color ?? null,
      order: typeof order === "number" ? order : 0,
    },
  });
  return rotation;
});
