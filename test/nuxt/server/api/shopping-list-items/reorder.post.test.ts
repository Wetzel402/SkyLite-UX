import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import handler from "~~/server/api/shopping-list-items/reorder.post";

const { defineEventHandler } = useH3TestUtils();

vi.mock("~/lib/prisma");

describe("pOST /api/shopping-list-items/reorder", () => {
  it("is registered as an event handler", () =>
    expect(defineEventHandler).toHaveBeenCalled());

  const createBaseItem = (overrides = {}) => ({
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
    ...overrides,
  });

  describe("reorders item successfully", () => {
    it.each([
      {
        name: "move item up",
        body: { itemId: "item-2", direction: "up" },
        mockItems: [
          createBaseItem({ id: "item-1", order: 0 }),
          createBaseItem({ id: "item-2", order: 1 }),
          createBaseItem({ id: "item-3", order: 2 }),
        ],
        expectedTargetOrder: 0,
      },
      {
        name: "move item down",
        body: { itemId: "item-2", direction: "down" },
        mockItems: [
          createBaseItem({ id: "item-1", order: 0 }),
          createBaseItem({ id: "item-2", order: 1 }),
          createBaseItem({ id: "item-3", order: 2 }),
        ],
        expectedTargetOrder: 2,
      },
    ])("$name", async ({ body, mockItems, expectedTargetOrder }) => {
      const currentItem = mockItems.find(item => item.id === body.itemId);
      if (!currentItem) {
        throw new Error("Current item not found");
      }

      const targetItem = mockItems.find(item => 
        body.direction === "up" 
          ? item.order === expectedTargetOrder 
          : item.order === expectedTargetOrder
      );
      
      prisma.shoppingListItem.findUnique.mockResolvedValueOnce(currentItem);
      prisma.shoppingListItem.findUnique.mockResolvedValueOnce({
        ...currentItem,
        order: expectedTargetOrder,
      } as typeof currentItem);
      
      prisma.shoppingListItem.findMany.mockResolvedValue(mockItems);
      
      const updatedCurrentItem = { ...currentItem, order: expectedTargetOrder };
      const updatedTargetItem = targetItem ? { ...targetItem, order: currentItem.order } : null;
      
      // Type assertion needed due to PrismaPromise type mismatch in test mocks
      // The mockImplementation expects PrismaPromise but we return Promise, so we cast through unknown
      prisma.shoppingListItem.update.mockImplementation((async (args: { where: { id: string } }) => {
        if (args.where.id === body.itemId) {
          return updatedCurrentItem as Awaited<ReturnType<typeof prisma.shoppingListItem.update>>;
        }
        if (targetItem && args.where.id === targetItem.id) {
          return (updatedTargetItem || currentItem) as Awaited<ReturnType<typeof prisma.shoppingListItem.update>>;
        }
        return currentItem as Awaited<ReturnType<typeof prisma.shoppingListItem.update>>;
      }) as unknown as Parameters<typeof prisma.shoppingListItem.update.mockImplementation>[0]);
      
      prisma.$transaction.mockImplementation(async (args) => {
        if (Array.isArray(args)) {
          const results = await Promise.all(args);
          return results;
        }
        return await args(prisma);
      });

      const event = createMockH3Event({
        body,
      });

      const response = await handler(event);

      expect(prisma.shoppingListItem.findUnique).toHaveBeenCalledWith({
        where: { id: body.itemId },
      });

      expect(prisma.shoppingListItem.findMany).toHaveBeenCalledWith({
        where: {
          shoppingListId: currentItem.shoppingListId,
        },
        orderBy: { order: "asc" },
      });

      expect(response).toHaveProperty("id", body.itemId);
      if (response) {
        expect(response.order).toBe(expectedTargetOrder);
      }
    });

    it("returns current item when already at boundary", async () => {
      const mockItems = [
        createBaseItem({ id: "item-1", order: 0 }),
        createBaseItem({ id: "item-2", order: 1 }),
      ];

      const currentItem = mockItems[0];
      if (!currentItem) {
        throw new Error("Current item not found");
      }

      prisma.shoppingListItem.findUnique.mockResolvedValue(currentItem);
      prisma.shoppingListItem.findMany.mockResolvedValue(mockItems);

      const event = createMockH3Event({
        body: { itemId: "item-1", direction: "up" },
      });

      const response = await handler(event);

      expect(response).toEqual(currentItem);
    });
  });

  describe("error handling", () => {
    it("throws 400 when itemId is missing", async () => {
      const event = createMockH3Event({
        body: { direction: "up" },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 400 when direction is missing", async () => {
      const event = createMockH3Event({
        body: { itemId: "item-1" },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 404 when item not found", async () => {
      prisma.shoppingListItem.findUnique.mockResolvedValue(null);

      const event = createMockH3Event({
        body: { itemId: "nonexistent", direction: "up" },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("handles database errors", async () => {
      prisma.shoppingListItem.findUnique.mockRejectedValue(
        new Error("Database error"),
      );

      const event = createMockH3Event({
        body: { itemId: "item-1", direction: "up" },
      });

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
