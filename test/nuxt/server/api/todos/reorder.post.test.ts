import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";

const { defineEventHandler } = useH3TestUtils();

vi.mock("@prisma/client", async () => {
  const actual = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
  return {
    ...actual,
    PrismaClient: vi.fn(() => prisma),
  };
});

import handler from "~~/server/api/todos/reorder.post";

vi.mock("~/lib/prisma");

describe("pOST /api/todos/reorder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createBaseTodo = (overrides = {}) => ({
    id: "todo-1",
    title: "Test Todo",
    description: null,
    completed: false,
    priority: "MEDIUM" as const,
    dueDate: null,
    order: 0,
    todoColumnId: "column-1",
    recurringGroupId: null,
    rrule: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  describe("reorders todo successfully", () => {
    it("moves todo up", async () => {
      const currentTodo = createBaseTodo({ id: "todo-2", order: 1 });
      const todos = [
        createBaseTodo({ id: "todo-1", order: 0 }),
        currentTodo,
        createBaseTodo({ id: "todo-3", order: 2 }),
      ];

      prisma.todo.findUnique.mockResolvedValue(currentTodo as Awaited<ReturnType<typeof prisma.todo.findUnique>>);
      prisma.todo.findMany.mockResolvedValue(todos as Awaited<ReturnType<typeof prisma.todo.findMany>>);
      prisma.$transaction.mockImplementation(async (args) => {
        if (Array.isArray(args)) {
          return await Promise.all(args);
        }
        return await args(prisma);
      });
      prisma.todo.findUnique.mockResolvedValueOnce(currentTodo);
      prisma.todo.findUnique.mockResolvedValueOnce({
        ...currentTodo,
        order: 0,
        todoColumn: {
          id: "column-1",
          name: "Test Column",
          order: 0,
          isDefault: false,
          user: {
            id: "user-1",
            name: "Test User",
            avatar: null,
          },
        },
      } as Awaited<ReturnType<typeof prisma.todo.findUnique>>);

      const event = createMockH3Event({
        method: "POST",
        body: { todoId: "todo-2", direction: "up", todoColumnId: "column-1" },
      });

      const response = await handler(event);

      expect(prisma.todo.findUnique).toHaveBeenCalledWith({ where: { id: "todo-2" } });
      expect(prisma.todo.findMany).toHaveBeenCalledWith({
        where: {
          todoColumnId: "column-1",
          completed: false,
        },
        orderBy: { order: "asc" },
      });
      expect(response).toBeDefined();
    });

    it("moves todo down", async () => {
      const currentTodo = createBaseTodo({ id: "todo-2", order: 1 });
      const todos = [
        createBaseTodo({ id: "todo-1", order: 0 }),
        currentTodo,
        createBaseTodo({ id: "todo-3", order: 2 }),
      ];

      prisma.todo.findUnique.mockResolvedValue(currentTodo as Awaited<ReturnType<typeof prisma.todo.findUnique>>);
      prisma.todo.findMany.mockResolvedValue(todos as Awaited<ReturnType<typeof prisma.todo.findMany>>);
      prisma.$transaction.mockImplementation(async (args) => {
        if (Array.isArray(args)) {
          return await Promise.all(args);
        }
        return await args(prisma);
      });
      prisma.todo.findUnique.mockResolvedValueOnce(currentTodo);
      prisma.todo.findUnique.mockResolvedValueOnce({
        ...currentTodo,
        order: 2,
        todoColumn: {
          id: "column-1",
          name: "Test Column",
          order: 0,
          isDefault: false,
          user: {
            id: "user-1",
            name: "Test User",
            avatar: null,
          },
        },
      } as Awaited<ReturnType<typeof prisma.todo.findUnique>>);

      const event = createMockH3Event({
        method: "POST",
        body: { todoId: "todo-2", direction: "down", todoColumnId: "column-1" },
      });

      const response = await handler(event);

      expect(response).toBeDefined();
    });

    it("returns current todo when already at top", async () => {
      const currentTodo = createBaseTodo({ id: "todo-1", order: 0 });
      const todos = [
        currentTodo,
        createBaseTodo({ id: "todo-2", order: 1 }),
      ];

      prisma.todo.findUnique.mockResolvedValue(currentTodo as Awaited<ReturnType<typeof prisma.todo.findUnique>>);
      prisma.todo.findMany.mockResolvedValue(todos as Awaited<ReturnType<typeof prisma.todo.findMany>>);

      const event = createMockH3Event({
        method: "POST",
        body: { todoId: "todo-1", direction: "up", todoColumnId: "column-1" },
      });

      const response = await handler(event);

      expect(response).toEqual(currentTodo);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("throws 400 when todoId is missing", async () => {
      const event = createMockH3Event({
        method: "POST",
        body: { direction: "up" },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 400 when direction is missing", async () => {
      const event = createMockH3Event({
        method: "POST",
        body: { todoId: "todo-1" },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 404 when todo not found", async () => {
      prisma.todo.findUnique.mockResolvedValue(null);

      const event = createMockH3Event({
        method: "POST",
        body: { todoId: "nonexistent", direction: "up" },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("handles database errors", async () => {
      prisma.todo.findUnique.mockRejectedValue(new Error("Database error"));

      const event = createMockH3Event({
        method: "POST",
        body: { todoId: "todo-1", direction: "up" },
      });

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
