import prisma from "~/lib/prisma";

export default defineEventHandler(async () => {
  const rewards = await prisma.reward.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { redemptions: true },
      },
    },
  });

  return rewards;
});
