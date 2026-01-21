import prisma from "~/lib/prisma";
import { calculateNextDueDate } from "../../utils/recurrence";
import type { RecurrencePattern } from "~/types/database";

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, "id");
    const body = await readBody(event);

    if (!id) {
      throw createError({
        statusCode: 400,
        message: "Todo ID is required",
      });
    }

    // Fetch the current todo to check if it was previously incomplete
    const currentTodo = await prisma.todo.findUnique({
      where: { id },
    });

    if (!currentTodo) {
      throw createError({
        statusCode: 404,
        message: "Todo not found",
      });
    }

    // Determine the final recurrence pattern (from body or preserve existing)
    const finalRecurrencePattern =
      body.recurrencePattern !== undefined
        ? body.recurrencePattern
        : currentTodo.recurrencePattern;

    // Determine recurringGroupId: keep existing, generate new if pattern exists, or null if no pattern
    const recurringGroupId = finalRecurrencePattern
      ? currentTodo.recurringGroupId || crypto.randomUUID()
      : null;

    const todo = await prisma.todo.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description,
        completed: body.completed,
        priority: body.priority,
        dueDate:
          body.dueDate !== undefined
            ? body.dueDate
              ? new Date(body.dueDate)
              : null
            : currentTodo.dueDate,
        todoColumnId: body.todoColumnId,
        order: body.order,
        recurrencePattern: finalRecurrencePattern as RecurrencePattern | null,
        recurringGroupId,
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

    // If todo is being marked complete (was incomplete before) and has a recurring pattern, create next instance
    if (
      body.completed &&
      !currentTodo.completed &&
      todo.recurringGroupId &&
      todo.recurrencePattern
    ) {
      const pattern = todo.recurrencePattern as RecurrencePattern;

      // Use client's date if provided for timezone-aware recurrence calculation
      const referenceDate = body.clientDate ? new Date(body.clientDate) : null;
      if (referenceDate) {
        referenceDate.setHours(0, 0, 0, 0);
      }

      const nextDueDate = calculateNextDueDate(
        pattern,
        todo.dueDate,
        referenceDate,
      );
      nextDueDate.setHours(23, 59, 59, 999);

      const maxOrder = await prisma.todo.aggregate({
        where: {
          todoColumnId: todo.todoColumnId || null,
          completed: false,
        },
        _max: {
          order: true,
        },
      });

      await prisma.todo.create({
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
    }

    return todo;
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      message: `Failed to update todo: ${error}`,
    });
  }
});
