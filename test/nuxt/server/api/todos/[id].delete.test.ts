import { describe, expect, vi, it } from "vitest";
import prisma from "~/lib/__mocks__/prisma";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { createMockH3Event } from "~~/test/nuxt/mocks/h3-event";

const { defineEventHandler } = useH3TestUtils();

vi.mock("~/lib/prisma");

// Mock the recurrence utility
vi.mock("~~/server/utils/recurrence", () => ({
  calculateNextDueDate: vi.fn((pattern, _lastDate, referenceDate) => {
    const nextDate = new Date(referenceDate || new Date());
    nextDate.setDate(nextDate.getDate() + 1);
    return nextDate;
  }),
}));

describe("DELETE /api/todos/[id]", async () => {
  const handler = await import("~~/server/api/todos/[id].delete");

  it("is registered as an event handler", () =>
    expect(defineEventHandler).toHaveBeenCalled());

  // Test data factories
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
    recurrencePattern: null,
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
          recurrencePattern: { type: "DAILY", interval: 1 },
        }),
      },
      {
        name: "recurring todo and creates next instance",
        params: { id: "todo-1" },
        query: { clientDate: "2025-11-25" },
        mockTodo: createBaseTodo({
          recurringGroupId: "group-1",
          recurrencePattern: { type: "DAILY", interval: 1 },
        }),
      },
    ])("$name", async ({ params, query, mockTodo }) => {
      const maxOrder = 5;
      const expectRecurrence =
        query.stopRecurrence != "true" && mockTodo.recurringGroupId != null;

      prisma.todo.findUnique.mockResolvedValue(mockTodo);
      prisma.todo.delete.mockResolvedValue(mockTodo);

      let txMock: any;
      if (expectRecurrence) {
        prisma.$transaction.mockImplementation(async (callback) => {
          txMock = {
            todo: {
              aggregate: vi
                .fn()
                .mockResolvedValue({ _max: { order: maxOrder } }),
              delete: vi.fn().mockResolvedValue(mockTodo),
              create: vi.fn().mockResolvedValue({ ...mockTodo, id: "todo-2" }),
            },
          };
          return await callback(txMock as any);
        });
      }

      const event = createMockH3Event({
        params,
        query,
      });

      const response = await handler.default(event);

      // Verify findUnique was called
      expect(prisma.todo.findUnique).toHaveBeenCalledWith({
        where: { id: params.id },
      });

      if (expectRecurrence) {
        // Verify transaction was used for recurring todos
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
            recurrencePattern: mockTodo.recurrencePattern,
            completed: false,
          },
        });
      } else {
        // Verify simple delete for non-recurring todos
        expect(prisma.todo.delete).toHaveBeenCalledWith({
          where: { id: params.id },
        });
      }

      expect(response).toEqual({ success: true });
    });
  });

  describe("error handling", () => {
    it("throws 400 when id is missing", async () => {
      const event = createMockH3Event({
        params: {},
      });

      await expect(handler.default(event)).rejects.toThrow();
    });

    it("throws 404 when todo not found", async () => {
      prisma.todo.findUnique.mockResolvedValue(null);

      const event = createMockH3Event({
        params: { id: "nonexistent" },
      });

      await expect(handler.default(event)).rejects.toThrow();
    });
  });
});
