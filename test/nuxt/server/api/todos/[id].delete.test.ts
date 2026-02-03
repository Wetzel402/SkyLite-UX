import { Prisma } from "@prisma/client";
import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import handler from "~~/server/api/todos/[id].delete";

import type { ICalEvent } from "~~/server/integrations/iCal/types";
import { calculateNextDueDate } from "~~/server/utils/rrule";
import type { PrismaTransactionMock } from "~~/test/types/mocks";

const { defineEventHandler } = useH3TestUtils();

vi.mock("~/lib/prisma");

vi.mock("~~/server/utils/rrule", () => ({
  calculateNextDueDate: vi.fn(
    (_rrule, originalDTSTART, _previousDueDate, referenceDate) => {
      const nextDate = new Date(referenceDate || originalDTSTART || new Date());
      nextDate.setDate(nextDate.getDate() + 1);
      return nextDate;
    },
  ),
}));

describe("dELETE /api/todos/[id]", () => {

  it("is registered as an event handler", () =>
    expect(defineEventHandler).toHaveBeenCalled());

  const createBaseTodo = (overrides = {}) => ({
    id: "todo-1",
    title: "Test Todo",
    description: "Test Description",
    priority: "MEDIUM" as const,
    dueDate: new Date("2025-11-25"),
    todoColumnId: "column-1",
    order: 1,
    completed: false,
    recurringGroupId: null,
    rrule: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  describe("deletes todo successfully", () => {
    it.each([
      {
        name: "non-recurring todo",
        params: { id: "todo-1" },
        query: {},
        mockTodo: createBaseTodo(),
      },
      {
        name: "recurring todo with stopRecurrence=true",
        params: { id: "todo-1" },
        query: { stopRecurrence: "true" },
        mockTodo: createBaseTodo({
          recurringGroupId: "group-1",
          rrule: { freq: "DAILY", interval: 1 } as ICalEvent["rrule"],
        }),
      },
      {
        name: "recurring todo and creates next instance",
        params: { id: "todo-1" },
        query: { clientDate: "2025-11-25" },
        mockTodo: createBaseTodo({
          recurringGroupId: "group-1",
          rrule: { freq: "DAILY", interval: 1 } as ICalEvent["rrule"],
        }),
      },
    ])("$name", async ({ params, query, mockTodo }) => {
      const maxOrder = 5;
      const expectRecurrence
        = query.stopRecurrence !== "true" && mockTodo.recurringGroupId !== null;

      prisma.todo.findUnique.mockResolvedValue(mockTodo);
      prisma.todo.delete.mockResolvedValue(mockTodo);

      const txMock: PrismaTransactionMock = {
        todo: {
          aggregate: vi.fn().mockResolvedValue({ _max: { order: maxOrder } }),
          delete: vi.fn().mockResolvedValue(mockTodo),
          create: vi.fn().mockResolvedValue({ ...mockTodo, id: "todo-2" }),
          findFirst: vi.fn().mockResolvedValue(
            createBaseTodo({
              id: "todo-0",
              dueDate: new Date("2025-11-25"),
            }),
          ),
          findMany: vi.fn().mockResolvedValue([]),
          update: vi.fn().mockResolvedValue(mockTodo),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      };

      if (expectRecurrence) {
        prisma.todo.findFirst.mockResolvedValue(
          createBaseTodo({
            id: "todo-0",
            dueDate: new Date("2025-11-25"),
          }),
        );
        prisma.$transaction.mockImplementation(async (callback) => {
          return await callback(txMock as unknown as Parameters<Parameters<typeof prisma.$transaction>[0]>[0]);
        });
      }

      const event = createMockH3Event({
        params,
        query,
      });

      const response = await handler(event);

      expect(prisma.todo.findUnique).toHaveBeenCalledWith({
        where: { id: params.id },
      });

      if (expectRecurrence) {
        expect(txMock.todo.aggregate).toHaveBeenCalledWith({
          where: {
            todoColumnId: mockTodo.todoColumnId,
            completed: false,
          },
          _max: {
            order: true,
          },
        });
        expect(txMock.todo.delete).toHaveBeenCalledWith({
          where: { id: params.id },
        });
        expect(txMock.todo.create).toHaveBeenCalledWith({
          data: {
            title: mockTodo.title,
            description: mockTodo.description,
            priority: mockTodo.priority,
            dueDate: expect.any(Date),
            todoColumnId: mockTodo.todoColumnId,
            order: maxOrder + 1,
            recurringGroupId: mockTodo.recurringGroupId,
            rrule: mockTodo.rrule,
            completed: false,
          },
        });
      }
      else {
        expect(prisma.todo.delete).toHaveBeenCalledWith({
          where: { id: params.id },
        });
      }

      expect(response).toEqual({ success: true });
    });
  });

  it("recurring todo with until - last occurrence does not create next", async () => {
    vi.mocked(calculateNextDueDate).mockReturnValueOnce(null);

    const mockTodo = createBaseTodo({
      recurringGroupId: "group-1",
      rrule: {
        freq: "DAILY",
        interval: 1,
        until: "2025-11-30",
      } as ICalEvent["rrule"],
      dueDate: new Date("2025-11-30"),
    });

    const txMock: PrismaTransactionMock = {
      todo: {
        aggregate: vi.fn().mockResolvedValue({ _max: { order: 5 } }),
        delete: vi.fn().mockResolvedValue(mockTodo),
        create: vi.fn().mockResolvedValue({ ...mockTodo, id: "todo-2" }),
        findFirst: vi.fn().mockResolvedValue(
          createBaseTodo({
            id: "todo-0",
            dueDate: new Date("2025-11-25"),
          }),
        ),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue(mockTodo),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };

    prisma.todo.findUnique.mockResolvedValue(mockTodo);
    prisma.todo.findFirst.mockResolvedValue(
      createBaseTodo({
        id: "todo-0",
        dueDate: new Date("2025-11-25"),
      }),
    );
    prisma.$transaction.mockImplementation(async (callback) => {
      return await callback(txMock as unknown as Parameters<Parameters<typeof prisma.$transaction>[0]>[0]);
    });

    const event = createMockH3Event({
      params: { id: "todo-1" },
      query: {},
    });

    const response = await handler(event);

    expect(prisma.todo.findUnique).toHaveBeenCalledWith({
      where: { id: "todo-1" },
    });
    expect(txMock.todo.delete).toHaveBeenCalledWith({
      where: { id: "todo-1" },
    });
    expect(txMock.todo.create).not.toHaveBeenCalled();
    expect(response).toEqual({ success: true });
  });

  describe("error handling", () => {
    it("throws 400 when id is missing", async () => {
      const event = createMockH3Event({
        params: {},
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 404 when todo not found", async () => {
      prisma.todo.findUnique.mockResolvedValue(null);

      const event = createMockH3Event({
        params: { id: "nonexistent" },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("returns 500 when recurring todo has no first todo or first todo has no dueDate", async () => {
      const recurringTodo = createBaseTodo({
        recurringGroupId: "group-1",
        rrule: { freq: "DAILY", interval: 1 } as ICalEvent["rrule"],
      });
      prisma.todo.findUnique.mockResolvedValue(recurringTodo);
      prisma.todo.findFirst.mockResolvedValue(null);

      const event = createMockH3Event({
        params: { id: "todo-1" },
        query: {},
      });

      await expect(handler(event)).rejects.toThrow(
        "Failed to find original DTSTART for recurring todo",
      );
    });
  });
});
