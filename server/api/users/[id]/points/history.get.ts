import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  const userId = getRouterParam(event, "id");

  if (!userId) {
    throw createError({
      statusCode: 400,
      statusMessage: "User ID is required",
    });
  }

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true },
  });

  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: "User not found",
    });
  }

  // Get chore completions (points earned)
  const choreCompletions = await prisma.choreCompletion.findMany({
    where: {
      userId,
      status: "APPROVED",
    },
    include: {
      chore: {
        select: { id: true, name: true },
      },
    },
    orderBy: { completedAt: "desc" },
  });

  // Get reward redemptions (points spent)
  const redemptions = await prisma.rewardRedemption.findMany({
    where: {
      userId,
      status: "APPROVED",
    },
    include: {
      reward: {
        select: { id: true, name: true },
      },
    },
    orderBy: { redeemedAt: "desc" },
  });

  // Combine and sort history
  const history = [
    ...choreCompletions.map(c => ({
      id: c.id,
      type: "earned" as const,
      description: `Completed: ${c.chore.name}`,
      points: c.pointsAwarded,
      date: c.completedAt,
    })),
    ...redemptions.map(r => ({
      id: r.id,
      type: "spent" as const,
      description: `Redeemed: ${r.reward.name}`,
      points: -r.pointsSpent,
      date: r.redeemedAt,
    })),
  ].sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return dateB - dateA;
  });

  return {
    userId,
    userName: user.name,
    history,
  };
});
