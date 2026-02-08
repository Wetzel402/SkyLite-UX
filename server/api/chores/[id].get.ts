import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, "id");

    if (!id) {
      throw createError({
        statusCode: 400,
        message: "Chore ID is required",
      });
    }

    const chore = await prisma.chore.findUnique({
      where: { id },
      include: {
        assignedUser: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        completions: {
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
    });

    if (!chore) {
      throw createError({
        statusCode: 404,
        message: "Chore not found",
      });
    }

    const latestCompletion = chore.completions[0];
    let status: "available" | "in-progress" | "pending-approval" | "completed" = "available";

    if (latestCompletion) {
      if (latestCompletion.status === "APPROVED") {
        status = "completed";
      }
      else if (latestCompletion.status === "PENDING_APPROVAL") {
        status = "pending-approval";
      }
    }
    else if (chore.assignedUserId) {
      status = "in-progress";
    }

    return {
      ...chore,
      status,
      claimedBy: latestCompletion?.user || null,
    };
  }
  catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      message: `Failed to fetch chore: ${error}`,
    });
  }
});
