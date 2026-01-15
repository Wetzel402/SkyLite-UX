import prisma from "~/lib/prisma";

type UpdateRewardBody = {
  name?: string;
  description?: string;
  pointCost?: number;
  quantityAvailable?: number | null;
  expiresAt?: string | null;
  icon?: string | null;
};

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const body = await readBody<UpdateRewardBody>(event);

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Reward ID is required",
    });
  }

  // Check if reward exists
  const existing = await prisma.reward.findUnique({ where: { id } });
  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: "Reward not found",
    });
  }

  // Validate fields if provided
  if (body.name !== undefined && (typeof body.name !== "string" || body.name.trim() === "")) {
    throw createError({
      statusCode: 400,
      statusMessage: "Name cannot be empty",
    });
  }

  if (body.pointCost !== undefined && (typeof body.pointCost !== "number" || body.pointCost < 1)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Point cost must be at least 1",
    });
  }

  const reward = await prisma.reward.update({
    where: { id },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.description !== undefined && { description: body.description?.trim() || null }),
      ...(body.pointCost !== undefined && { pointCost: body.pointCost }),
      ...(body.quantityAvailable !== undefined && { quantityAvailable: body.quantityAvailable }),
      ...(body.expiresAt !== undefined && { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null }),
      ...(body.icon !== undefined && { icon: body.icon }),
    },
  });

  return reward;
});
