import prisma from "~/lib/prisma";
import type { RecurrencePattern } from "~/types/database";
import { calculateNextDueDate } from "../../utils/recurrence";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    const maxOrder = await prisma.todo.aggregate({
      where: {
        todoColumnId: body.todoColumnId || null,
        completed: false,
      },
      _max: {
        order: true,
      },
    });

    // Generate recurringGroupId if recurrence pattern is provided
    const recurringGroupId = body.recurrencePattern
      ? crypto.randomUUID()
      : null;

    // Calculate due date: use provided date, or calculate from pattern if recurring
    let dueDate: Date | null = null;
    if (body.dueDate) {
      dueDate = new Date(body.dueDate);
    } else if (body.recurrencePattern) {
      // For new recurring todos, use client's "today" if provided, otherwise server's today
      // This handles timezone differences between client and server
      const referenceDate = body.clientDate
        ? new Date(body.clientDate)
        : new Date();
      referenceDate.setHours(0, 0, 0, 0);

      const firstOccurrence = calculateNextDueDate(
        body.recurrencePattern as RecurrencePattern,
        null,
        referenceDate,
      );
      firstOccurrence.setHours(23, 59, 59, 999);
      dueDate = firstOccurrence;
    }

    const todo = await prisma.todo.create({
      data: {
        title: body.title,
        description: body.description,
        priority: body.priority || "MEDIUM",
        dueDate,
        todoColumnId: body.todoColumnId,
        order: (maxOrder._max.order || 0) + 1,
        recurringGroupId,
        recurrencePattern: body.recurrencePattern
          ? (body.recurrencePattern as RecurrencePattern)
          : null,
      },
      include: {
        todoColumn: {
          select: {
            id: true,
            name: true,
            order: true,
            isDefault: true,
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

    return todo;
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to create todo: ${error}`,
    });
  }
});
