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

import handler from "~~/server/api/shopping-list-items/reorder.put";

vi.mock("~/lib/prisma");

describe("pUT /api/shopping-list-items/reorder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("reorders items successfully", () => {
    it("updates order for multiple items", async () => {
      prisma.shoppingListItem.update.mockResolvedValue({
        id: "item-1",
        name: "Test Item",
        checked: false,
        order: 0,
        shoppingListId: "list-1",
        quantity: 1,
        unit: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Awaited<ReturnType<typeof prisma.shoppingListItem.update>>);

      const event = createMockH3Event({
        method: "PUT",
        body: { itemIds: ["item-3", "item-1", "item-2"] },
      });

      const response = await handler(event);

      expect(prisma.shoppingListItem.update).toHaveBeenCalledTimes(3);
      expect(prisma.shoppingListItem.update).toHaveBeenCalledWith({
        where: { id: "item-3" },
        data: { order: 0 },
      });
      expect(prisma.shoppingListItem.update).toHaveBeenCalledWith({
        where: { id: "item-1" },
        data: { order: 1 },
      });
      expect(prisma.shoppingListItem.update).toHaveBeenCalledWith({
        where: { id: "item-2" },
        data: { order: 2 },
      });
      expect(response).toEqual({ success: true });
    });

    it("handles single item reorder", async () => {
      prisma.shoppingListItem.update.mockResolvedValue({
        id: "item-1",
        name: "Test Item",
        checked: false,
        order: 0,
        shoppingListId: "list-1",
        quantity: 1,
        unit: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Awaited<ReturnType<typeof prisma.shoppingListItem.update>>);

      const event = createMockH3Event({
        method: "PUT",
        body: { itemIds: ["item-1"] },
      });

      const response = await handler(event);

      expect(prisma.shoppingListItem.update).toHaveBeenCalledTimes(1);
      expect(prisma.shoppingListItem.update).toHaveBeenCalledWith({
        where: { id: "item-1" },
        data: { order: 0 },
      });
      expect(response).toEqual({ success: true });
    });
  });

  describe("error handling", () => {
    it("throws 400 when itemIds is missing", async () => {
      const event = createMockH3Event({
        method: "PUT",
        body: {},
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 400 when itemIds is not an array", async () => {
      const event = createMockH3Event({
        method: "PUT",
        body: { itemIds: "not-an-array" },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("handles database errors", async () => {
      prisma.shoppingListItem.update.mockRejectedValue(new Error("Database error"));

      const event = createMockH3Event({
        method: "PUT",
        body: { itemIds: ["item-1"] },
      });

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
