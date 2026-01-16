import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);

    // Optional filters
    const userId = query.userId as string | undefined;
    const status = query.status as string | undefined;
    const limit = query.limit ? Number.parseInt(query.limit as string, 10) : 50;
    const offset = query.offset ? Number.parseInt(query.offset as string, 10) : 0;

    const whereClause: Record<string, unknown> = {};

    if (userId) {
      whereClause.userId = userId;
    }

    if (status) {
      if (!["PENDING_APPROVAL", "APPROVED", "REJECTED"].includes(status)) {
        throw createError({
          statusCode: 400,
          message: "Invalid status. Must be one of: PENDING_APPROVAL, APPROVED, REJECTED",
        });
      }
      whereClause.status = status;
    }
    else {
      // By default, show only approved completions for history
      whereClause.status = "APPROVED";
    }

    const [completions, total] = await Promise.all([
      prisma.choreCompletion.findMany({
        where: whereClause,
        include: {
          chore: {
            select: {
              id: true,
              name: true,
              description: true,
              icon: true,
              pointValue: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
              color: true,
            },
          },
          verifiedBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          completedAt: "desc",
        },
        take: limit,
        skip: offset,
      }),
      prisma.choreCompletion.count({
        where: whereClause,
      }),
    ]);

    return {
      completions,
      total,
      limit,
      offset,
      hasMore: offset + completions.length < total,
    };
  }
  catch (error: unknown) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      message: `Failed to fetch chore history: ${error}`,
    });
  }
});
