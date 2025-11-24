import { describe, expect, vi, it } from "vitest";
import prisma from "~/lib/__mocks__/prisma";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { createMockH3Event } from "~~/test/nuxt/mocks/h3-event";

const { defineEventHandler } = useH3TestUtils();

vi.mock("~/lib/prisma");

describe("GET /api/todos", async () => {
  const handler = await import("~~/server/api/todos/index.get");

  it("is registered as an event handler", () =>
    expect(defineEventHandler).toHaveBeenCalled());

  // Test data factories
  const createBaseTodo = (overrides = {}) => ({
    id: "todo-1",
    title: "Test Todo",
    description: "Test Description",
    priority: "MEDIUM" as const,
    dueDate: null,
    todoColumnId: "column-1",
    order: 1,
    completed: false,
    recurringGroupId: null,
    recurrencePattern: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    todoColumn: {
      id: "column-1",
      name: "To Do",
      order: 1,
      isDefault: true,
      user: {
        id: "user-1",
        name: "Test User",
        avatar: null,
      },
    },
    ...overrides,
  });

  describe("fetches todos successfully", () => {
    it.each([
      {
        name: "without todoColumnId filter",
        query: {},
        expectedWhere: undefined,
        mockTodos: [
          createBaseTodo({ id: "todo-1", title: "Todo 1", order: 1 }),
          createBaseTodo({
            id: "todo-2",
            title: "Todo 2",
            order: 2,
            completed: true,
          }),
          createBaseTodo({
            id: "todo-3",
            title: "Todo 3",
            order: 1,
            todoColumnId: "column-2",
            todoColumn: {
              id: "column-2",
              name: "In Progress",
              order: 2,
              isDefault: false,
              user: {
                id: "user-1",
                name: "Test User",
                avatar: null,
              },
            },
          }),
        ],
      },
      {
        name: "with todoColumnId filter",
        query: { todoColumnId: "column-1" },
        expectedWhere: { todoColumnId: "column-1" },
        mockTodos: [
          createBaseTodo({ id: "todo-1", title: "Todo 1", order: 1 }),
          createBaseTodo({ id: "todo-2", title: "Todo 2", order: 2 }),
        ],
      },
      {
        name: "with no todos",
        query: {},
        expectedWhere: undefined,
        mockTodos: [],
      },
    ])("$name", async ({ query, expectedWhere, mockTodos }) => {
      prisma.todo.findMany.mockResolvedValue(mockTodos);

      const event = createMockH3Event({ query });

      const response = await handler.default(event);

      expect(prisma.todo.findMany).toHaveBeenCalledWith({
        where: expectedWhere,
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
        orderBy: [
          { todoColumnId: "asc" },
          { completed: "asc" },
          { order: "asc" },
        ],
      });

      expect(response).toEqual(mockTodos);
    });
  });
});
