import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

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

  await prisma.reward.delete({ where: { id } });

  return { success: true };
});
