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

import handler from "~~/server/api/shopping-lists/[id]/items/clear-completed.post";

vi.mock("~/lib/prisma");

describe("pOST /api/shopping-lists/[id]/items/clear-completed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("clears completed items successfully", () => {
    it("deletes all completed items from shopping list", async () => {
      prisma.shoppingListItem.deleteMany.mockResolvedValue({ count: 3 });

      const event = createMockH3Event({
        method: "POST",
        params: { id: "list-1" },
        body: { action: "delete" },
      });

      const response = await handler(event);

      expect(prisma.shoppingListItem.deleteMany).toHaveBeenCalledWith({
        where: {
          shoppingListId: "list-1",
          checked: true,
        },
      });
      expect(response).toEqual({ success: true });
    });

    it("returns success when no completed items exist", async () => {
      prisma.shoppingListItem.deleteMany.mockResolvedValue({ count: 0 });

      const event = createMockH3Event({
        method: "POST",
        params: { id: "list-1" },
        body: { action: "delete" },
      });

      const response = await handler(event);

      expect(response).toEqual({ success: true });
    });
  });

  describe("error handling", () => {
    it("throws 400 when list id is missing", async () => {
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
        params: { id: "list-1" },
        body: { action: "invalid" },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("handles database errors", async () => {
      prisma.shoppingListItem.deleteMany.mockRejectedValue(new Error("Database error"));

      const event = createMockH3Event({
        method: "POST",
        params: { id: "list-1" },
        body: { action: "delete" },
      });

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
