import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const userId = query.userId as string | undefined;
  const status = query.status as string | undefined;

  const where: Record<string, unknown> = {};
  if (userId) {
    where.userId = userId;
  }
  if (status) {
    where.status = status;
  }

  const redemptions = await prisma.rewardRedemption.findMany({
    where,
    include: {
      reward: true,
      user: {
        select: { id: true, name: true, avatar: true, color: true },
      },
      approvedBy: {
        select: { id: true, name: true },
      },
    },
    orderBy: { redeemedAt: "desc" },
  });

  return redemptions;
});
