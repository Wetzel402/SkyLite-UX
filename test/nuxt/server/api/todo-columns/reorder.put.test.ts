import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import handler from "~~/server/api/todo-columns/reorder.put";

const { defineEventHandler } = useH3TestUtils();

vi.mock("~/lib/prisma");

describe("pUT /api/todo-columns/reorder", () => {
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
    _count: {
      todos: 0,
    },
    ...overrides,
  });

  describe("reorders columns successfully", () => {
    it("reorders multiple columns", async () => {
      const reorders = [
        { id: "column-1", order: 0 },
        { id: "column-2", order: 1 },
        { id: "column-3", order: 2 },
      ];

      const mockColumns = [
        createBaseTodoColumn({ id: "column-1", order: 0 }),
        createBaseTodoColumn({ id: "column-2", order: 1 }),
        createBaseTodoColumn({ id: "column-3", order: 2 }),
      ];

      const firstColumn = mockColumns[0];
      if (!firstColumn) {
        throw new Error("First column not found");
      }
      prisma.todoColumn.update.mockResolvedValue(firstColumn);

      const txMock = {
        todoColumn: {
          update: vi.fn().mockResolvedValue(mockColumns[0]),
        },
      };

      prisma.$transaction.mockImplementation(async (args) => {
        if (Array.isArray(args)) {
          return await Promise.all(args);
        }
        const updates = reorders.map((reorder) =>
          txMock.todoColumn.update({
            where: { id: reorder.id },
            data: { order: reorder.order },
          }),
        );
        return await args(updates as unknown as Parameters<Parameters<typeof prisma.$transaction>[0]>[0]);
      });

      prisma.todoColumn.findMany.mockResolvedValue(mockColumns);

      const event = createMockH3Event({
        body: { reorders },
      });

      const response = await handler(event);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.todoColumn.findMany).toHaveBeenCalledWith({
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
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
      prisma.$transaction.mockRejectedValue(new Error("Database error"));

      const event = createMockH3Event({
        body: { reorders: [{ id: "column-1", order: 0 }] },
      });

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
