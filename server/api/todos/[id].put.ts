import prisma from "~/lib/prisma";

import type { ICalEvent } from "../../integrations/iCal/types";

import { calculateNextDueDate } from "../../utils/rrule";

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

    let rrule: ICalEvent["rrule"] | null = null;
    if (body.rrule !== undefined) {
      rrule = body.rrule as ICalEvent["rrule"] | null;
    }
    else if (currentTodo.rrule) {
      rrule = currentTodo.rrule as ICalEvent["rrule"];
    }

    const recurringGroupId = rrule
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
        rrule,
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

    if (
      body.completed
      && !currentTodo.completed
      && todo.recurringGroupId
      && todo.rrule
    ) {
      const todoRrule = todo.rrule as ICalEvent["rrule"];

      const firstTodo = await prisma.todo.findFirst({
        where: {
          recurringGroupId: todo.recurringGroupId,
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      if (!firstTodo || !firstTodo.dueDate) {
        throw createError({
          statusCode: 500,
          message: "Failed to find original DTSTART for recurring todo",
        });
      }

      const originalDTSTART = new Date(firstTodo.dueDate);
      originalDTSTART.setHours(0, 0, 0, 0);

      const referenceDate = body.clientDate ? new Date(body.clientDate) : null;
      if (referenceDate) {
        referenceDate.setHours(0, 0, 0, 0);
      }

      const nextDueDate = calculateNextDueDate(
        todoRrule,
        originalDTSTART,
        todo.dueDate,
        referenceDate,
      );

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
          rrule: todo.rrule,
          completed: false,
        },
      });
    }

    return todo;
  }
  catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      message: `Failed to update todo: ${error}`,
    });
  }
});
