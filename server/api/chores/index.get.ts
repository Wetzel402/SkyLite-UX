import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const assignedUserId = query.assignedUserId as string | undefined;
    const status = query.status as string | undefined;

    const whereClause: Record<string, unknown> = {};

    // Filter by assigned user
    if (assignedUserId) {
      whereClause.assignedUserId = assignedUserId;
    }

    // Filter by status - available means no assignment and no active completions
    if (status === "available") {
      whereClause.assignedUserId = null;
    }

    const chores = await prisma.chore.findMany({
      where: whereClause,
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

    // Helper to check if a recurring chore should reset based on completion date
    const shouldResetRecurringChore = (
      recurrence: string,
      completedAt: Date | null,
    ): boolean => {
      if (!completedAt || recurrence === "NONE")
        return false;

      const now = new Date();
      const completionDate = new Date(completedAt);

      // Reset times to start of day for comparison
      const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const completionStart = new Date(
        completionDate.getFullYear(),
        completionDate.getMonth(),
        completionDate.getDate(),
      );

      switch (recurrence) {
        case "DAILY":
          // Reset if completed on a different day
          return nowStart.getTime() > completionStart.getTime();
        case "WEEKLY": {
          // Reset if completed in a different week (week starts on Sunday)
          const nowWeekStart = new Date(nowStart.getTime() - (now.getDay() * 24 * 60 * 60 * 1000));
          const completionWeekStart = new Date(completionStart.getTime() - (completionDate.getDay() * 24 * 60 * 60 * 1000));
          return nowWeekStart.getTime() > completionWeekStart.getTime();
        }
        case "MONTHLY":
          // Reset if completed in a different month
          return nowStart.getMonth() !== completionStart.getMonth()
            || nowStart.getFullYear() !== completionStart.getFullYear();
        default:
          return false;
      }
    };

    // Transform chores to include status based on completions
    const choreWithStatus = chores.map((chore) => {
      const latestCompletion = chore.completions[0];
      let status: "available" | "in-progress" | "pending-approval" | "completed" = "available";

      if (latestCompletion) {
        if (latestCompletion.status === "APPROVED") {
          // Check if it's a recurring chore that should reset
          if (shouldResetRecurringChore(chore.recurrence, latestCompletion.completedAt)) {
            status = "available";
          }
          else {
            status = "completed";
          }
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
