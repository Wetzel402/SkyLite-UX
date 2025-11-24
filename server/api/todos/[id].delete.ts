import prisma from "~/lib/prisma";
import { calculateNextDueDate } from "../../utils/recurrence";
import type { RecurrencePattern } from "~/types/database";

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, "id");
    const query = getQuery(event);
    const stopRecurrence = query.stopRecurrence === "true";
    const clientDate = query.clientDate as string | undefined;

    if (!id) {
      throw createError({
        statusCode: 400,
        message: "Todo ID is required",
      });
    }

    // Get the todo before deleting to check if it's recurring
    const todo = await prisma.todo.findUnique({
      where: { id },
    });

    if (!todo) {
      throw createError({
        statusCode: 404,
        message: "Todo not found",
      });
    }

    // If it's recurring and we're not stopping recurrence, create the next instance
    if (todo.recurringGroupId && todo.recurrencePattern && !stopRecurrence) {
      const pattern = todo.recurrencePattern as RecurrencePattern;

      // Use client's date if provided for timezone-aware recurrence calculation
      const referenceDate = clientDate ? new Date(clientDate) : null;
      if (referenceDate) {
        referenceDate.setHours(0, 0, 0, 0);
      }

      const nextDueDate = calculateNextDueDate(
        pattern,
        todo.dueDate,
        referenceDate,
      );
      nextDueDate.setHours(23, 59, 59, 999);

      await prisma.$transaction(async (tx) => {
        const maxOrder = await tx.todo.aggregate({
          where: {
            todoColumnId: todo.todoColumnId || null,
            completed: false,
          },
          _max: {
            order: true,
          },
        });
        await tx.todo.delete({ where: { id } });
        await tx.todo.create({
          data: {
            title: todo.title,
            description: todo.description,
            priority: todo.priority,
            dueDate: nextDueDate,
            todoColumnId: todo.todoColumnId,
            order: (maxOrder._max.order || 0) + 1,
            recurringGroupId: todo.recurringGroupId,
            recurrencePattern: todo.recurrencePattern,
            completed: false,
          },
        });
      });
    } else {
      await prisma.todo.delete({
        where: { id },
      });
    }

    return { success: true };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      message: `Failed to delete todo: ${error}`,
    });
  }
});
