import { Prisma } from "@prisma/client";

import prisma from "~/lib/prisma";

import type { ICalEvent } from "../../integrations/iCal/types";

import { calculateNextDueDate } from "../../utils/rrule";

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

    const todo = await prisma.todo.findUnique({
      where: { id },
    });

    if (!todo) {
      throw createError({
        statusCode: 404,
        message: "Todo not found",
      });
    }

    if (todo.recurringGroupId && todo.rrule && !stopRecurrence) {
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

      const referenceDate = clientDate ? new Date(clientDate) : null;
      if (referenceDate) {
        referenceDate.setHours(0, 0, 0, 0);
      }

      const nextDueDate = calculateNextDueDate(
        todoRrule,
        originalDTSTART,
        todo.dueDate,
        referenceDate,
      );

      await prisma.$transaction(async (tx) => {
        await tx.todo.delete({ where: { id } });
        if (nextDueDate !== null) {
          const maxOrder = await tx.todo.aggregate({
            where: {
              todoColumnId: todo.todoColumnId || null,
              completed: false,
            },
            _max: {
              order: true,
            },
          });
          await tx.todo.create({
            data: {
              title: todo.title,
              description: todo.description,
              priority: todo.priority,
              dueDate: nextDueDate,
              todoColumnId: todo.todoColumnId,
              order: (maxOrder._max.order || 0) + 1,
              recurringGroupId: todo.recurringGroupId,
              rrule: todo.rrule ?? Prisma.JsonNull,
              completed: false,
            },
          });
        }
      });
    }
    else {
      await prisma.todo.delete({
        where: { id },
      });
    }

    return { success: true };
  }
  catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      message: `Failed to delete todo: ${error}`,
    });
  }
});
