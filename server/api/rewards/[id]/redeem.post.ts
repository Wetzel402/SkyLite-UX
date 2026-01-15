import prisma from "~/lib/prisma";

type RedeemRewardBody = {
  userId: string;
};

export default defineEventHandler(async (event) => {
  const rewardId = getRouterParam(event, "id");
  const body = await readBody<RedeemRewardBody>(event);

  if (!rewardId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Reward ID is required",
    });
  }

  if (!body.userId) {
    throw createError({
      statusCode: 400,
      statusMessage: "User ID is required",
    });
  }

  // Get reward and validate
  const reward = await prisma.reward.findUnique({ where: { id: rewardId } });
  if (!reward) {
    throw createError({
      statusCode: 404,
      statusMessage: "Reward not found",
    });
  }

  // Check quantity availability
  if (reward.quantityAvailable !== null && reward.quantityAvailable <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "Reward is out of stock",
    });
  }

  // Check expiration
  if (reward.expiresAt && new Date(reward.expiresAt) < new Date()) {
    throw createError({
      statusCode: 400,
      statusMessage: "Reward has expired",
    });
  }

  // Get user points
  const userPoints = await prisma.userPoints.findUnique({
    where: { userId: body.userId },
  });

  if (!userPoints || userPoints.currentBalance < reward.pointCost) {
    throw createError({
      statusCode: 400,
      statusMessage: "Insufficient points",
    });
  }

  // Get household settings to check approval threshold
  const householdSettings = await prisma.householdSettings.findFirst();
  const requiresApproval = householdSettings?.rewardApprovalThreshold !== null
    && reward.pointCost >= (householdSettings?.rewardApprovalThreshold ?? 0);

  // Determine initial status based on approval requirement
  const initialStatus = requiresApproval ? "PENDING" : "APPROVED";

  // Use transaction to ensure atomicity
  const result = await prisma.$transaction(async (tx) => {
    // Create redemption record
    const redemption = await tx.rewardRedemption.create({
      data: {
        rewardId,
        userId: body.userId,
        pointsSpent: reward.pointCost,
        status: initialStatus,
      },
      include: {
        reward: true,
        user: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    // If auto-approved, deduct points and update quantity
    if (!requiresApproval) {
      await tx.userPoints.update({
        where: { userId: body.userId },
        data: {
          currentBalance: { decrement: reward.pointCost },
          totalSpent: { increment: reward.pointCost },
        },
      });

      // Decrement quantity if applicable
      if (reward.quantityAvailable !== null) {
        await tx.reward.update({
          where: { id: rewardId },
          data: {
            quantityAvailable: { decrement: 1 },
          },
        });
      }
    }

    return redemption;
  });

  return {
    ...result,
    requiresApproval,
    message: requiresApproval
      ? "Redemption submitted for parent approval"
      : "Reward redeemed successfully!",
  };
});
