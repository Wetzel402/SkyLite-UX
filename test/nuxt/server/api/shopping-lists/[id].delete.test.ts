import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import handler from "~~/server/api/shopping-lists/[id].delete";

const { defineEventHandler } = useH3TestUtils();

vi.mock("~/lib/prisma");

describe("dELETE /api/shopping-lists/[id]", () => {
  it("is registered as an event handler", () =>
    expect(defineEventHandler).toHaveBeenCalled());

  describe("deletes shopping list successfully", { timeout: 15_000 }, () => {
    it("deletes list with cascade deletion of items", async () => {
      prisma.shoppingList.delete.mockResolvedValue({
        id: "list-1",
        name: "Deleted List",
        createdAt: new Date(),
        updatedAt: new Date(),
        order: 0,
      });

      const event = createMockH3Event({
        params: { id: "list-1" },
      });

      const response = await handler(event);

      expect(prisma.shoppingList.delete).toHaveBeenCalledWith({
        where: { id: "list-1" },
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
      prisma.shoppingList.delete.mockRejectedValue(
        new Error("Database error"),
      );

      const event = createMockH3Event({
        params: { id: "list-1" },
      });

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
