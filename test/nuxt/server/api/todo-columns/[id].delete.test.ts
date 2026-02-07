import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import handler from "~~/server/api/todo-columns/[id].delete";

const { defineEventHandler } = useH3TestUtils();

vi.mock("~/lib/prisma");

describe("dELETE /api/todo-columns/[id]", () => {
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
    todos: [],
    ...overrides,
  });

  describe("deletes column successfully", () => {
    it.each([
      {
        name: "column without todos",
        mockColumn: createBaseTodoColumn({
          todos: [],
        }),
      },
      {
        name: "column with todos",
        mockColumn: createBaseTodoColumn({
          todos: [
            { id: "todo-1" },
            { id: "todo-2" },
          ],
        }),
      },
    ])("$name", async ({ mockColumn }) => {
      prisma.todoColumn.findUnique.mockResolvedValue(mockColumn);

      const txMock = {
        todo: {
          deleteMany: vi.fn().mockResolvedValue({ count: mockColumn.todos.length }),
        },
        todoColumn: {
          delete: vi.fn().mockResolvedValue(mockColumn),
        },
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        return await callback(txMock as unknown as Parameters<Parameters<typeof prisma.$transaction>[0]>[0]);
      });

      const event = createMockH3Event({
        params: { id: "column-1" },
      });

      const response = await handler(event);

      expect(prisma.todoColumn.findUnique).toHaveBeenCalledWith({
        where: { id: "column-1" },
        include: {
          todos: true,
        },
      });

      expect(txMock.todo.deleteMany).toHaveBeenCalledWith({
        where: { todoColumnId: "column-1" },
      });

      expect(txMock.todoColumn.delete).toHaveBeenCalledWith({
        where: { id: "column-1" },
      });

      expect(response).toEqual({ success: true });
    });
  });

  describe("error handling", () => {
    it("throws 400 when id is missing", async () => {
      const event = createMockH3Event({
        params: {},
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 404 when column not found", async () => {
      prisma.todoColumn.findUnique.mockResolvedValue(null);

      const event = createMockH3Event({
        params: { id: "nonexistent" },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 400 when trying to delete user column", async () => {
      prisma.todoColumn.findUnique.mockResolvedValue(
        createBaseTodoColumn({
          userId: "user-1",
        }),
      );

      const event = createMockH3Event({
        params: { id: "column-1" },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("handles database errors", async () => {
      prisma.todoColumn.findUnique.mockResolvedValue(createBaseTodoColumn());
      prisma.$transaction.mockRejectedValue(new Error("Database error"));

      const event = createMockH3Event({
        params: { id: "column-1" },
      });

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
