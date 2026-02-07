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

import handler from "~~/server/api/todos/reorder.put";

vi.mock("~/lib/prisma");

describe("pUT /api/todos/reorder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("reorders todos successfully", () => {
    it("updates order for multiple todos", async () => {
      prisma.todo.update.mockResolvedValue({
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
      } as Awaited<ReturnType<typeof prisma.todo.update>>);

      const event = createMockH3Event({
        method: "PUT",
        body: { todoIds: ["todo-3", "todo-1", "todo-2"] },
      });

      const response = await handler(event);

      expect(prisma.todo.update).toHaveBeenCalledTimes(3);
      expect(prisma.todo.update).toHaveBeenCalledWith({
        where: { id: "todo-3" },
        data: { order: 0 },
      });
      expect(prisma.todo.update).toHaveBeenCalledWith({
        where: { id: "todo-1" },
        data: { order: 1 },
      });
      expect(prisma.todo.update).toHaveBeenCalledWith({
        where: { id: "todo-2" },
        data: { order: 2 },
      });
      expect(response).toEqual({ success: true });
    });

    it("handles single todo reorder", async () => {
      prisma.todo.update.mockResolvedValue({
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
      } as Awaited<ReturnType<typeof prisma.todo.update>>);

      const event = createMockH3Event({
        method: "PUT",
        body: { todoIds: ["todo-1"] },
      });

      const response = await handler(event);

      expect(prisma.todo.update).toHaveBeenCalledTimes(1);
      expect(prisma.todo.update).toHaveBeenCalledWith({
        where: { id: "todo-1" },
        data: { order: 0 },
      });
      expect(response).toEqual({ success: true });
    });
  });

  describe("error handling", () => {
    it("handles database errors", async () => {
      prisma.todo.update.mockRejectedValue(new Error("Database error"));

      const event = createMockH3Event({
        method: "PUT",
        body: { todoIds: ["todo-1"] },
      });

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
