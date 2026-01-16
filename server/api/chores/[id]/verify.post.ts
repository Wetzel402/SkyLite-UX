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

    if (!body.verifiedByUserId) {
      throw createError({
        statusCode: 400,
        message: "Verified by user ID is required",
      });
    }

    if (!body.completionId) {
      throw createError({
        statusCode: 400,
        message: "Completion ID is required",
      });
    }

    // Default to approve if not specified
    const approve = body.approve !== false;

    const result = await prisma.$transaction(async (tx) => {
      // Verify the verifying user is a parent
      const verifier = await tx.user.findUnique({
        where: { id: body.verifiedByUserId },
      });

      if (!verifier) {
        throw createError({
          statusCode: 404,
          message: "Verifying user not found",
        });
      }

      if (verifier.role !== "PARENT") {
        throw createError({
          statusCode: 403,
          message: "Only parents can verify chore completions",
        });
      }

      // Get the chore and the specific completion
      const chore = await tx.chore.findUnique({
        where: { id },
      });

      if (!chore) {
        throw createError({
          statusCode: 404,
          message: "Chore not found",
        });
      }

      const completion = await tx.choreCompletion.findUnique({
        where: { id: body.completionId },
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

      if (!completion) {
        throw createError({
          statusCode: 404,
          message: "Chore completion record not found",
        });
      }

      if (completion.choreId !== id) {
        throw createError({
          statusCode: 400,
          message: "Completion does not belong to this chore",
        });
      }

      if (completion.status !== "PENDING_APPROVAL") {
        throw createError({
          statusCode: 400,
          message: `Chore completion has already been ${completion.status.toLowerCase()}`,
        });
      }

      if (approve) {
        // Approve the completion and award points
        const updatedCompletion = await tx.choreCompletion.update({
          where: { id: completion.id },
          data: {
            status: "APPROVED",
            verifiedAt: new Date(),
            verifiedByUserId: body.verifiedByUserId,
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
            verifiedBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        // Update user points
        await tx.userPoints.upsert({
          where: { userId: completion.userId },
          create: {
            userId: completion.userId,
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
          status: "approved" as const,
          message: `Chore approved! ${completion.user.name} earned ${chore.pointValue} points.`,
          pointsAwarded: chore.pointValue,
        };
      }
      else {
        // Reject the completion
        const updatedCompletion = await tx.choreCompletion.update({
          where: { id: completion.id },
          data: {
            status: "REJECTED",
            verifiedAt: new Date(),
            verifiedByUserId: body.verifiedByUserId,
            pointsAwarded: 0,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
            verifiedBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        // Clear assignment so chore can be claimed again
        await tx.chore.update({
          where: { id },
          data: {
            assignedUserId: null,
          },
        });

        return {
          chore,
          completion: updatedCompletion,
          status: "rejected" as const,
          message: "Chore completion was rejected. No points awarded.",
          pointsAwarded: 0,
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
      message: `Failed to verify chore: ${error}`,
    });
  }
});
