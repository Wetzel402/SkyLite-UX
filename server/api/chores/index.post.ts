import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    // Validate required fields
    if (!body.name || typeof body.name !== "string" || body.name.trim() === "") {
      throw createError({
        statusCode: 400,
        message: "Chore name is required",
      });
    }

    if (body.pointValue !== undefined && (typeof body.pointValue !== "number" || body.pointValue < 0)) {
      throw createError({
        statusCode: 400,
        message: "Point value must be a non-negative number",
      });
    }

    const chore = await prisma.chore.create({
      data: {
        name: body.name.trim(),
        description: body.description?.trim() || null,
        pointValue: body.pointValue || 1,
        recurrence: body.recurrence || "NONE",
        assignedUserId: body.assignedUserId || null,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        icon: body.icon || null,
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
    });

    return {
      ...chore,
      status: chore.assignedUserId ? "in-progress" : "available",
      claimedBy: null,
    };
  }
  catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      message: `Failed to create chore: ${error}`,
    });
  }
});
