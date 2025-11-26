import { describe, expect, vi, it, beforeEach } from "vitest";
import prisma from "~/lib/__mocks__/prisma";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { createMockH3Event } from "~~/test/nuxt/mocks/h3-event";

const { defineEventHandler } = useH3TestUtils();

vi.mock("~/lib/prisma");

// Mock the recurrence utility
vi.mock("~~/server/utils/recurrence", () => ({
  calculateNextDueDate: vi.fn((pattern, _lastDate, referenceDate) => {
    // Return a date based on the reference date for testing
    const nextDate = new Date(referenceDate || new Date());
    nextDate.setDate(nextDate.getDate() + 1); // Add 1 day for simplicity
    return nextDate;
  }),
}));

describe("POST /api/todos", async () => {
  const handler = await import("~~/server/api/todos/index.post");

  it("is registered as an event handler", () =>
    expect(defineEventHandler).toHaveBeenCalled());

  // Test data factories
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
    recurrencePattern: null,
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
          recurrencePattern: { type: "DAILY", interval: 1 },
          clientDate: "2025-11-25",
        }),
        expectedData: (base: ReturnType<typeof createBaseExpectedData>) => ({
          ...base,
          dueDate: expect.any(Date),
          recurringGroupId: expect.any(String),
          recurrencePattern: { type: "DAILY", interval: 1 },
        }),
      },
      {
        name: "with weekly recurrence pattern",
        requestBody: (base: ReturnType<typeof createBaseRequestBody>) => ({
          ...base,
          priority: "LOW" as const,
          recurrencePattern: {
            type: "WEEKLY",
            interval: 1,
            daysOfWeek: [1, 3, 5],
          },
          clientDate: "2025-11-25",
        }),
        expectedData: (base: ReturnType<typeof createBaseExpectedData>) => ({
          ...base,
          priority: "LOW" as const,
          dueDate: expect.any(Date),
          recurringGroupId: expect.any(String),
          recurrencePattern: {
            type: "WEEKLY",
            interval: 1,
            daysOfWeek: [1, 3, 5],
          },
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

      prisma.todo.aggregate.mockResolvedValue({ _max: { order: maxOrder } });
      prisma.todo.create.mockResolvedValue(mockTodoResponse);

      const event = createMockH3Event({
        body: request,
      });

      const response = await handler.default(event);

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
});
