import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, "id");
    const body = await readBody(event);

    if (!id) {
      throw createError({
        statusCode: 400,
        message: "Chore ID is required",
      });
    }

    if (!body.userId) {
      throw createError({
        statusCode: 400,
        message: "User ID is required to complete a chore",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Get the chore
      const chore = await tx.chore.findUnique({
        where: { id },
        include: {
          completions: {
            where: {
              userId: body.userId,
              status: "PENDING_APPROVAL",
            },
            orderBy: {
              completedAt: "desc",
            },
            take: 1,
          },
        },
      });

      if (!chore) {
        throw createError({
          statusCode: 404,
          message: "Chore not found",
        });
      }

      // Check if user has a pending completion for this chore
      if (chore.completions.length === 0) {
        throw createError({
          statusCode: 400,
          message: "You must claim this chore before completing it",
        });
      }

      const completion = chore.completions[0];

      if (!completion) {
        throw createError({
          statusCode: 400,
          message: "Completion record not found",
        });
      }

      // Check if already completed (prevents double-completion)
      if (completion.completedAt !== null) {
        throw createError({
          statusCode: 400,
          message: "This chore has already been completed",
        });
      }

      // Get household settings to check completion mode
      const householdSettings = await tx.householdSettings.findFirst();
      const requiresVerification = householdSettings?.choreCompletionMode === "PARENT_VERIFY";

      if (requiresVerification) {
        // Mark as pending approval - parent needs to verify
        const updatedCompletion = await tx.choreCompletion.update({
          where: { id: completion.id },
          data: {
            completedAt: new Date(),
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        });

        return {
          chore,
          completion: updatedCompletion,
          status: "pending-approval" as const,
          message: "Chore marked as complete. Waiting for parent approval.",
        };
      }
      else {
        // Self-claim mode - auto-approve and award points
        const updatedCompletion = await tx.choreCompletion.update({
          where: { id: completion.id },
          data: {
            completedAt: new Date(),
            verifiedAt: new Date(),
            status: "APPROVED",
            pointsAwarded: chore.pointValue,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        });

        // Update user points
        await tx.userPoints.upsert({
          where: { userId: body.userId },
          create: {
            userId: body.userId,
            currentBalance: chore.pointValue,
            totalEarned: chore.pointValue,
            totalSpent: 0,
          },
          update: {
            currentBalance: { increment: chore.pointValue },
            totalEarned: { increment: chore.pointValue },
          },
        });

        // If it's a one-time chore, clear the assignment
        if (chore.recurrence === "NONE") {
          await tx.chore.update({
            where: { id },
            data: {
              assignedUserId: null,
            },
          });
        }

        return {
          chore,
          completion: updatedCompletion,
          status: "completed" as const,
          message: `Chore completed! You earned ${chore.pointValue} points.`,
          pointsAwarded: chore.pointValue,
        };
      }
    });

    return result;
  }
  catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      message: `Failed to complete chore: ${error}`,
    });
  }
});
