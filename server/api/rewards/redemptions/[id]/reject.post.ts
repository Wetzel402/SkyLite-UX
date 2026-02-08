import prisma from "~/lib/prisma";

type RejectRedemptionBody = {
  rejectedByUserId: string;
};

export default defineEventHandler(async (event) => {
  const redemptionId = getRouterParam(event, "id");
  const body = await readBody<RejectRedemptionBody>(event);

  if (!redemptionId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Redemption ID is required",
    });
  }

  if (!body.rejectedByUserId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Rejecting user ID is required",
    });
  }

  // Verify rejecting user is a parent
  const rejectingUser = await prisma.user.findUnique({
    where: { id: body.rejectedByUserId },
  });

  if (!rejectingUser || rejectingUser.role !== "PARENT") {
    throw createError({
      statusCode: 403,
      statusMessage: "Only parents can reject redemptions",
    });
  }

  // Get redemption
  const redemption = await prisma.rewardRedemption.findUnique({
    where: { id: redemptionId },
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

  // Update redemption status to rejected (points are NOT deducted since this was pending)
  const updatedRedemption = await prisma.rewardRedemption.update({
    where: { id: redemptionId },
    data: {
      status: "REJECTED",
      approvedByUserId: body.rejectedByUserId, // Store who rejected it
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

  return updatedRedemption;
});
