import prisma from "~/lib/prisma";

export default defineEventHandler(async () => {
  try {
    const chores = await prisma.chore.findMany({
      include: {
        assignedUser: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        completions: {
          where: {
            status: {
              in: ["PENDING_APPROVAL", "APPROVED"],
            },
          },
          orderBy: {
            completedAt: "desc",
          },
          take: 1,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
      },
      orderBy: [
        { createdAt: "desc" },
      ],
    });

    // Transform chores to include status based on completions
    const choreWithStatus = chores.map((chore) => {
      const latestCompletion = chore.completions[0];
      let status: "available" | "in-progress" | "pending-approval" | "completed" = "available";

      if (latestCompletion) {
        if (latestCompletion.status === "APPROVED") {
          // Check if it's a recurring chore that should reset
          status = "completed";
        }
        else if (latestCompletion.status === "PENDING_APPROVAL") {
          status = "pending-approval";
        }
      }
      else if (chore.assignedUserId) {
        // Chore is assigned but not yet completed
        status = "in-progress";
      }

      return {
        ...chore,
        status,
        claimedBy: latestCompletion?.user || null,
      };
    });

    return choreWithStatus;
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to fetch chores: ${error}`,
    });
  }
});
