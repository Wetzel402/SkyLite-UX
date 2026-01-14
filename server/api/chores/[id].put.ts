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

    // Check if chore exists
    const existingChore = await prisma.chore.findUnique({
      where: { id },
    });

    if (!existingChore) {
      throw createError({
        statusCode: 404,
        message: "Chore not found",
      });
    }

    // Validate fields if provided
    if (body.name !== undefined && (typeof body.name !== "string" || body.name.trim() === "")) {
      throw createError({
        statusCode: 400,
        message: "Chore name cannot be empty",
      });
    }

    if (body.pointValue !== undefined && (typeof body.pointValue !== "number" || body.pointValue < 0)) {
      throw createError({
        statusCode: 400,
        message: "Point value must be a non-negative number",
      });
    }

    const chore = await prisma.chore.update({
      where: { id },
      data: {
        name: body.name?.trim() ?? existingChore.name,
        description: body.description !== undefined ? (body.description?.trim() || null) : existingChore.description,
        pointValue: body.pointValue ?? existingChore.pointValue,
        recurrence: body.recurrence ?? existingChore.recurrence,
        assignedUserId: body.assignedUserId !== undefined ? (body.assignedUserId || null) : existingChore.assignedUserId,
        dueDate: body.dueDate !== undefined ? (body.dueDate ? new Date(body.dueDate) : null) : existingChore.dueDate,
        icon: body.icon !== undefined ? (body.icon || null) : existingChore.icon,
      },
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
      message: `Failed to update chore: ${error}`,
    });
  }
});
