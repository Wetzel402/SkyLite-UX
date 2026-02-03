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

import handler from "~~/server/api/todo-columns/[id]/todos/clear-completed.post";

vi.mock("~/lib/prisma");

describe("pOST /api/todo-columns/[id]/todos/clear-completed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("clears completed todos successfully", () => {
    it("deletes all completed todos from todo column", async () => {
      prisma.todo.deleteMany.mockResolvedValue({ count: 5 });

      const event = createMockH3Event({
        method: "POST",
        params: { id: "column-1" },
        body: { action: "delete" },
      });

      const response = await handler(event);

      expect(prisma.todo.deleteMany).toHaveBeenCalledWith({
        where: {
          todoColumnId: "column-1",
          completed: true,
        },
      });
      expect(response).toEqual({ success: true });
    });

    it("returns success when no completed todos exist", async () => {
      prisma.todo.deleteMany.mockResolvedValue({ count: 0 });

      const event = createMockH3Event({
        method: "POST",
        params: { id: "column-1" },
        body: { action: "delete" },
      });

      const response = await handler(event);

      expect(response).toEqual({ success: true });
    });
  });

  describe("error handling", () => {
    it("throws 400 when column id is missing", async () => {
      const event = createMockH3Event({
        method: "POST",
        params: {},
        body: { action: "delete" },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 400 when action is invalid", async () => {
      const event = createMockH3Event({
        method: "POST",
        params: { id: "column-1" },
        body: { action: "invalid" },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("handles database errors", async () => {
      prisma.todo.deleteMany.mockRejectedValue(new Error("Database error"));

      const event = createMockH3Event({
        method: "POST",
        params: { id: "column-1" },
        body: { action: "delete" },
      });

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
