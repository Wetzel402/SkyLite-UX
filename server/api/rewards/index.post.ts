import prisma from "~/lib/prisma";

type CreateRewardBody = {
  name: string;
  description?: string;
  pointCost: number;
  quantityAvailable?: number;
  expiresAt?: string;
  icon?: string;
};

export default defineEventHandler(async (event) => {
  const body = await readBody<CreateRewardBody>(event);

  if (!body.name || typeof body.name !== "string" || body.name.trim() === "") {
    throw createError({
      statusCode: 400,
      statusMessage: "Name is required",
    });
  }

  if (!body.pointCost || typeof body.pointCost !== "number" || body.pointCost < 1) {
    throw createError({
      statusCode: 400,
      statusMessage: "Point cost must be at least 1",
    });
  }

  const reward = await prisma.reward.create({
    data: {
      name: body.name.trim(),
      description: body.description?.trim() || null,
      pointCost: body.pointCost,
      quantityAvailable: body.quantityAvailable ?? null,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      icon: body.icon || null,
    },
  });

  return reward;
});
