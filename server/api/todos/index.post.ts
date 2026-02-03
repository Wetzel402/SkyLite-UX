import { Prisma } from "@prisma/client";

import prisma from "~/lib/prisma";

import type { ICalEvent } from "../../integrations/iCal/types";

import { calculateNextDueDate } from "../../utils/rrule";

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

    let rrule: ICalEvent["rrule"] | null = null;
    let dueDate: Date | null = null;
    let recurringGroupId: string | null = null;

    if (body.rrule) {
      rrule = body.rrule as ICalEvent["rrule"];
      recurringGroupId = crypto.randomUUID();

      if (body.dueDate) {
        dueDate = new Date(body.dueDate);
      }
      else {
        const referenceDate = body.clientDate
          ? new Date(body.clientDate)
          : new Date();
        referenceDate.setHours(0, 0, 0, 0);

        const firstOccurrence = calculateNextDueDate(
          rrule,
          referenceDate,
          null,
          referenceDate,
        );
        dueDate = firstOccurrence;
      }
    }
    else if (body.dueDate) {
      dueDate = new Date(body.dueDate);
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
        rrule: rrule ?? Prisma.JsonNull,
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
  }
  catch (error) {
    throw createError({
      statusCode: 500,
      message: `Failed to create todo: ${error}`,
    });
  }
});
