import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: "Reward ID is required",
    });
  }

  const reward = await prisma.reward.findUnique({
    where: { id },
    include: {
      redemptions: {
        include: {
          user: {
            select: { id: true, name: true, avatar: true },
          },
          approvedBy: {
            select: { id: true, name: true },
          },
        },
        orderBy: { redeemedAt: "desc" },
      },
    },
  });

  if (!reward) {
    throw createError({
      statusCode: 404,
      statusMessage: "Reward not found",
    });
  }

  return reward;
});
