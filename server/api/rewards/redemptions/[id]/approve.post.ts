import prisma from "~/lib/prisma";

type ApproveRedemptionBody = {
  approvedByUserId: string;
};

export default defineEventHandler(async (event) => {
  const redemptionId = getRouterParam(event, "id");
  const body = await readBody<ApproveRedemptionBody>(event);

  if (!redemptionId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Redemption ID is required",
    });
  }

  if (!body.approvedByUserId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Approving user ID is required",
    });
  }

  // Verify approving user is a parent
  const approvingUser = await prisma.user.findUnique({
    where: { id: body.approvedByUserId },
  });

  if (!approvingUser || approvingUser.role !== "PARENT") {
    throw createError({
      statusCode: 403,
      statusMessage: "Only parents can approve redemptions",
    });
  }

  // Get redemption with related data
  const redemption = await prisma.rewardRedemption.findUnique({
    where: { id: redemptionId },
    include: { reward: true },
  });

  if (!redemption) {
    throw createError({
      statusCode: 404,
      statusMessage: "Redemption not found",
    });
  }

  if (redemption.status !== "PENDING") {
    throw createError({
      statusCode: 400,
      statusMessage: `Redemption is already ${redemption.status.toLowerCase()}`,
    });
  }

  // Use transaction to update redemption, points, and quantity
  const result = await prisma.$transaction(async (tx) => {
    // Update redemption status
    const updatedRedemption = await tx.rewardRedemption.update({
      where: { id: redemptionId },
      data: {
        status: "APPROVED",
        approvedByUserId: body.approvedByUserId,
      },
      include: {
        reward: true,
        user: {
          select: { id: true, name: true, avatar: true },
        },
        approvedBy: {
          select: { id: true, name: true },
        },
      },
    });

    // Deduct points from user
    await tx.userPoints.update({
      where: { userId: redemption.userId },
      data: {
        currentBalance: { decrement: redemption.pointsSpent },
        totalSpent: { increment: redemption.pointsSpent },
      },
    });

    // Decrement quantity if applicable
    if (redemption.reward.quantityAvailable !== null) {
      await tx.reward.update({
        where: { id: redemption.rewardId },
        data: {
          quantityAvailable: { decrement: 1 },
        },
      });
    }

    return updatedRedemption;
  });

  return result;
});
