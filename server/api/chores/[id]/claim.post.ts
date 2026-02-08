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
        message: "User ID is required to claim a chore",
      });
    }

    // Use a transaction with serializable isolation to prevent race conditions
    // This ensures that only one user can claim an open chore at a time
    const result = await prisma.$transaction(async (tx) => {
      // First, get the chore with a lock
      const chore = await tx.chore.findUnique({
        where: { id },
        include: {
          completions: {
            where: {
              status: {
                in: ["PENDING_APPROVAL"],
              },
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

      // Check if chore is already assigned to a specific user
      if (chore.assignedUserId && chore.assignedUserId !== body.userId) {
        throw createError({
          statusCode: 409,
          message: "This chore is already assigned to another user",
        });
      }

      // Check if there's already a pending completion (chore already claimed)
      const existingClaim = chore.completions[0];
      if (existingClaim) {
        if (existingClaim.userId === body.userId) {
          throw createError({
            statusCode: 409,
            message: "You have already claimed this chore",
          });
        }
        throw createError({
          statusCode: 409,
          message: "This chore has already been claimed by another user",
        });
      }

      // Verify the user exists
      const user = await tx.user.findUnique({
        where: { id: body.userId },
      });

      if (!user) {
        throw createError({
          statusCode: 404,
          message: "User not found",
        });
      }

      // Claim the chore by:
      // 1. Assigning the user to the chore
      // 2. Creating a pending completion record
      const [updatedChore, completion] = await Promise.all([
        tx.chore.update({
          where: { id },
          data: {
            assignedUserId: body.userId,
          },
          include: {
            assignedUser: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        }),
        tx.choreCompletion.create({
          data: {
            choreId: id,
            userId: body.userId,
            status: "PENDING_APPROVAL",
            pointsAwarded: 0, // Points awarded on verification/approval
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
        }),
      ]);

      return {
        chore: updatedChore,
        completion,
      };
    }, {
      // Use serializable isolation to prevent race conditions
      isolationLevel: "Serializable",
    });

    return {
      ...result.chore,
      status: "in-progress" as const,
      claimedBy: result.completion.user,
      completion: result.completion,
    };
  }
  catch (error: unknown) {
    // Handle Prisma transaction errors (concurrent modifications)
    if (error && typeof error === "object" && "code" in error) {
      const prismaError = error as { code: string };
      if (prismaError.code === "P2034") {
        throw createError({
          statusCode: 409,
          message: "This chore was just claimed by another user. Please try a different chore.",
        });
      }
    }

    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      message: `Failed to claim chore: ${error}`,
    });
  }
});
