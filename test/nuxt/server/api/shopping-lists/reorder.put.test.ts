import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import handler from "~~/server/api/shopping-lists/reorder.put";

const { defineEventHandler } = useH3TestUtils();

vi.mock("~/lib/prisma");

describe("pUT /api/shopping-lists/reorder", () => {
  it("is registered as an event handler", () =>
    expect(defineEventHandler).toHaveBeenCalled());

  describe("reorders shopping lists successfully", () => {
    it("reorders multiple lists", async () => {
      const listIds = ["list-1", "list-2", "list-3"];

      prisma.shoppingList.update.mockResolvedValue({
        id: "list-1",
        name: "List 1",
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const event = createMockH3Event({
        body: { listIds },
      });

      const response = await handler(event);

      expect(prisma.shoppingList.update).toHaveBeenCalledTimes(3);
      expect(prisma.shoppingList.update).toHaveBeenCalledWith({
        where: { id: "list-1" },
        data: { order: 0 },
      });
      expect(prisma.shoppingList.update).toHaveBeenCalledWith({
        where: { id: "list-2" },
        data: { order: 1 },
      });
      expect(prisma.shoppingList.update).toHaveBeenCalledWith({
        where: { id: "list-3" },
        data: { order: 2 },
      });

      expect(response).toEqual({ success: true });
    });

    it("handles single list reorder", async () => {
      const listIds = ["list-1"];

      prisma.shoppingList.update.mockResolvedValue({
        id: "list-1",
        name: "List 1",
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const event = createMockH3Event({
        body: { listIds },
      });

      const response = await handler(event);

      expect(prisma.shoppingList.update).toHaveBeenCalledTimes(1);
      expect(response).toEqual({ success: true });
    });
  });

  describe("error handling", () => {
    it("handles database errors", async () => {
      prisma.shoppingList.update.mockRejectedValue(
        new Error("Database error"),
      );

      const event = createMockH3Event({
        body: { listIds: ["list-1"] },
      });

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
