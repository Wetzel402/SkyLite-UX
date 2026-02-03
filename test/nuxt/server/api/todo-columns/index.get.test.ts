import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import handler from "~~/server/api/todo-columns/index.get";

const { defineEventHandler } = useH3TestUtils();

vi.mock("~/lib/prisma");

describe("gET /api/todo-columns", () => {
  it("is registered as an event handler", () =>
    expect(defineEventHandler).toHaveBeenCalled());

  const createBaseTodoColumn = (overrides = {}) => ({
    id: "column-1",
    name: "Test Column",
    order: 0,
    isDefault: false,
    userId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: null,
    todos: [],
    _count: {
      todos: 0,
    },
    ...overrides,
  });

  describe("fetches todo columns successfully", () => {
    it.each([
      {
        name: "with multiple columns",
        mockColumns: [
          createBaseTodoColumn({ id: "column-1", name: "Column 1", order: 0 }),
          createBaseTodoColumn({ id: "column-2", name: "Column 2", order: 1 }),
          createBaseTodoColumn({ id: "column-3", name: "Column 3", order: 2 }),
        ],
      },
      {
        name: "with columns containing todos",
        mockColumns: [
          createBaseTodoColumn({
            id: "column-1",
            todos: [
              { id: "todo-1", order: 0 },
              { id: "todo-2", order: 1 },
            ],
            _count: {
              todos: 2,
            },
          }),
        ],
      },
      {
        name: "with user columns",
        mockColumns: [
          createBaseTodoColumn({
            id: "column-1",
            userId: "user-1",
            user: {
              id: "user-1",
              name: "Test User",
              avatar: null,
            },
          }),
        ],
      },
      {
        name: "with no columns",
        mockColumns: [],
      },
    ])("$name", async ({ mockColumns }) => {
      prisma.todoColumn.findMany.mockResolvedValue(mockColumns);

      const event = createMockH3Event({});

      const response = await handler(event);

      expect(prisma.todoColumn.findMany).toHaveBeenCalledWith({
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          todos: {
            orderBy: {
              order: "asc",
            },
          },
          _count: {
            select: { todos: true },
          },
        },
        orderBy: {
          order: "asc",
        },
      });

      expect(response).toEqual(mockColumns);
    });
  });

  describe("error handling", () => {
    it("handles database errors", async () => {
      prisma.todoColumn.findMany.mockRejectedValue(
        new Error("Database error"),
      );

      const event = createMockH3Event({});

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
