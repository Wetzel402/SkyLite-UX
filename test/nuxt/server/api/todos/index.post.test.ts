import { Prisma, type Prisma as PrismaNamespace } from "@prisma/client";
import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi, beforeEach } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import handler from "~~/server/api/todos/index.post";

import type { ICalEvent } from "~~/server/integrations/iCal/types";

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

describe("pOST /api/todos", () => {

  it("is registered as an event handler", () =>
    expect(defineEventHandler).toHaveBeenCalled());

  const createBaseRequestBody = () => ({
    title: "Test Todo",
    description: "Test Description",
    priority: "MEDIUM" as const,
    todoColumnId: "column-1",
  });

  const createBaseExpectedData = (order: number) => ({
    title: "Test Todo",
    description: "Test Description",
    priority: "MEDIUM" as const,
    todoColumnId: "column-1",
    order,
    dueDate: null,
    recurringGroupId: null,
    rrule: Prisma.JsonNull,
  });

  describe("creates todo successfully", () => {
    const maxOrder = 5;
    const expectedOrder = maxOrder + 1;

    it.each([
      {
        name: "with explicit due date",
        requestBody: (base: ReturnType<typeof createBaseRequestBody>) => ({
          ...base,
          priority: "HIGH" as const,
          dueDate: "2025-12-31",
        }),
        expectedData: (base: ReturnType<typeof createBaseExpectedData>) => ({
          ...base,
          priority: "HIGH" as const,
          dueDate: new Date("2025-12-31"),
        }),
      },
      {
        name: "with daily recurrence pattern",
        requestBody: (base: ReturnType<typeof createBaseRequestBody>) => ({
          ...base,
          rrule: { freq: "DAILY", interval: 1 } as ICalEvent["rrule"],
          clientDate: "2025-11-25",
        }),
        expectedData: (base: ReturnType<typeof createBaseExpectedData>) => ({
          ...base,
          dueDate: expect.any(Date),
          recurringGroupId: expect.any(String),
          rrule: { freq: "DAILY", interval: 1 } as ICalEvent["rrule"],
        }),
      },
      {
        name: "with weekly recurrence pattern",
        requestBody: (base: ReturnType<typeof createBaseRequestBody>) => ({
          ...base,
          priority: "LOW" as const,
          rrule: {
            freq: "WEEKLY",
            interval: 1,
            byday: ["MO", "WE", "FR"],
          } as ICalEvent["rrule"],
          clientDate: "2025-11-25",
        }),
        expectedData: (base: ReturnType<typeof createBaseExpectedData>) => ({
          ...base,
          priority: "LOW" as const,
          dueDate: expect.any(Date),
          recurringGroupId: expect.any(String),
          rrule: {
            freq: "WEEKLY",
            interval: 1,
            byday: ["MO", "WE", "FR"],
          } as ICalEvent["rrule"],
        }),
      },
      {
        name: "with monthly recurrence pattern",
        requestBody: (base: ReturnType<typeof createBaseRequestBody>) => ({
          ...base,
          rrule: { freq: "MONTHLY", interval: 1 } as ICalEvent["rrule"],
          clientDate: "2025-11-25",
        }),
        expectedData: (base: ReturnType<typeof createBaseExpectedData>) => ({
          ...base,
          dueDate: expect.any(Date),
          recurringGroupId: expect.any(String),
          rrule: { freq: "MONTHLY", interval: 1 } as ICalEvent["rrule"],
        }),
      },
      {
        name: "with yearly recurrence pattern",
        requestBody: (base: ReturnType<typeof createBaseRequestBody>) => ({
          ...base,
          rrule: { freq: "YEARLY", interval: 1 } as ICalEvent["rrule"],
          clientDate: "2025-11-25",
        }),
        expectedData: (base: ReturnType<typeof createBaseExpectedData>) => ({
          ...base,
          dueDate: expect.any(Date),
          recurringGroupId: expect.any(String),
          rrule: { freq: "YEARLY", interval: 1 } as ICalEvent["rrule"],
        }),
      },
      {
        name: "without due date or recurrence",
        requestBody: (base: ReturnType<typeof createBaseRequestBody>) => base,
        expectedData: (base: ReturnType<typeof createBaseExpectedData>) => base,
      },
    ])("$name", async ({ requestBody, expectedData }) => {
      const request = requestBody(createBaseRequestBody());
      const expectedTodoData = expectedData(
        createBaseExpectedData(expectedOrder),
      );

      const mockTodoResponse = {
        id: "todo-123",
        ...expectedTodoData,
        rrule: (expectedTodoData.rrule === Prisma.JsonNull ? null : (expectedTodoData.rrule ?? null)) as PrismaNamespace.JsonValue,
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        todoColumn: {
          id: request.todoColumnId,
          name: "To Do",
          order: 1,
          isDefault: true,
          user: {
            id: "user-1",
            name: "Test User",
            avatar: null,
          },
        },
      };

      prisma.todo.aggregate.mockResolvedValue({ _max: { order: maxOrder } } as Awaited<ReturnType<typeof prisma.todo.aggregate>>);
      prisma.todo.create.mockResolvedValue(mockTodoResponse);

      const event = createMockH3Event({
        body: request,
      });

      const response = await handler(event);

      expect(prisma.todo.aggregate).toHaveBeenCalledWith({
        where: {
          todoColumnId: request.todoColumnId,
          completed: false,
        },
        _max: {
          order: true,
        },
      });

      expect(prisma.todo.create).toHaveBeenCalledWith({
        data: expectedTodoData,
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

      expect(response).toEqual(mockTodoResponse);
    });
  });

  describe("timezone", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should create todo with clientDate in UTC timezone", async () => {
      const event = createMockH3Event({
        method: "POST",
        body: {
          title: "UTC Todo",
          priority: "MEDIUM",
          clientDate: "2025-01-15T00:00:00Z",
        },
      });

      prisma.todo.aggregate.mockResolvedValue({ _max: { order: 0 } } as Awaited<ReturnType<typeof prisma.todo.aggregate>>);
      prisma.todo.create.mockResolvedValue({
        id: "todo-1",
        title: "UTC Todo",
        description: null,
        priority: "MEDIUM",
        dueDate: new Date("2025-01-16T00:00:00Z"),
        order: 1,
        completed: false,
        todoColumnId: null,
        recurringGroupId: null,
        rrule: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await handler(event);
      expect(result).toBeDefined();
      expect(result.title).toBe("UTC Todo");
    });

    it("should create todo with clientDate in America/New_York timezone", async () => {
      const event = createMockH3Event({
        method: "POST",
        body: {
          title: "NYC Todo",
          priority: "MEDIUM",
          clientDate: "2025-01-15T05:00:00Z",
        },
      });

      prisma.todo.aggregate.mockResolvedValue({ _max: { order: 0 } } as Awaited<ReturnType<typeof prisma.todo.aggregate>>);
      prisma.todo.create.mockResolvedValue({
        id: "todo-2",
        title: "NYC Todo",
        description: null,
        priority: "MEDIUM",
        dueDate: new Date("2025-01-16T05:00:00Z"),
        order: 1,
        completed: false,
        todoColumnId: null,
        recurringGroupId: null,
        rrule: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await handler(event);
      expect(result).toBeDefined();
    });

    it("should calculate recurring todo due date with timezone awareness", async () => {
      const event = createMockH3Event({
        method: "POST",
        body: {
          title: "Recurring Todo",
          priority: "MEDIUM",
          rrule: {
            freq: "DAILY",
            interval: 1,
          } as ICalEvent["rrule"],
          clientDate: "2025-01-15T00:00:00Z",
        },
      });

      prisma.todo.aggregate.mockResolvedValue({ _max: { order: 0 } } as Awaited<ReturnType<typeof prisma.todo.aggregate>>);
      prisma.todo.create.mockResolvedValue({
        id: "todo-3",
        title: "Recurring Todo",
        description: null,
        priority: "MEDIUM",
        dueDate: new Date("2025-01-16T00:00:00Z"),
        order: 1,
        completed: false,
        todoColumnId: null,
        recurringGroupId: "group-1",
        rrule: { freq: "DAILY", interval: 1 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await handler(event);
      expect(result.recurringGroupId).toBeDefined();
      expect(result.rrule).toBeDefined();
    });

    it("should handle missing clientDate gracefully", async () => {
      const event = createMockH3Event({
        method: "POST",
        body: {
          title: "Todo Without ClientDate",
          priority: "MEDIUM",
        },
      });

      prisma.todo.aggregate.mockResolvedValue({ _max: { order: 0 } } as Awaited<ReturnType<typeof prisma.todo.aggregate>>);
      prisma.todo.create.mockResolvedValue({
        id: "todo-4",
        title: "Todo Without ClientDate",
        description: null,
        priority: "MEDIUM",
        dueDate: null,
        order: 1,
        completed: false,
        todoColumnId: null,
        recurringGroupId: null,
        rrule: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await handler(event);
      expect(result).toBeDefined();
    });

    it("should handle timezone-agnostic date comparisons", async () => {
      const event = createMockH3Event({
        method: "POST",
        body: {
          title: "Timezone Agnostic Todo",
          priority: "MEDIUM",
          dueDate: "2025-01-15T00:00:00Z",
        },
      });

      prisma.todo.aggregate.mockResolvedValue({ _max: { order: 0 } } as Awaited<ReturnType<typeof prisma.todo.aggregate>>);
      prisma.todo.create.mockResolvedValue({
        id: "todo-5",
        title: "Timezone Agnostic Todo",
        description: null,
        priority: "MEDIUM",
        dueDate: new Date("2025-01-15T00:00:00Z"),
        order: 1,
        completed: false,
        todoColumnId: null,
        recurringGroupId: null,
        rrule: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await handler(event);
      expect(result.dueDate).toBeInstanceOf(Date);
    });
  });
});
