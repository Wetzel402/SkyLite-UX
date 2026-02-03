import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import handler from "~~/server/api/shopping-list-items/[id].delete";

const { defineEventHandler } = useH3TestUtils();

vi.mock("~/lib/prisma");

describe("dELETE /api/shopping-list-items/[id]", () => {
  it("is registered as an event handler", () =>
    expect(defineEventHandler).toHaveBeenCalled());

  describe("deletes item successfully", () => {
    it("deletes shopping list item", async () => {
      prisma.shoppingListItem.delete.mockResolvedValue({
        id: "item-1",
        name: "Deleted Item",
        order: 0,
        shoppingListId: "list-1",
        checked: false,
        notes: null,
        quantity: 1,
        unit: null,
      });

      const event = createMockH3Event({
        params: { id: "item-1" },
      });

      const response = await handler(event);

      expect(prisma.shoppingListItem.delete).toHaveBeenCalledWith({
        where: { id: "item-1" },
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

    it("handles database errors", async () => {
      prisma.shoppingListItem.delete.mockRejectedValue(
        new Error("Database error"),
      );

      const event = createMockH3Event({
        params: { id: "item-1" },
      });

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
