import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import handler from "~~/server/api/shopping-lists/index.get";

const { defineEventHandler } = useH3TestUtils();

vi.mock("~/lib/prisma");

describe("gET /api/shopping-lists", () => {
  it("is registered as an event handler", () =>
    expect(defineEventHandler).toHaveBeenCalled());

  const createBaseShoppingList = (overrides = {}) => ({
    id: "list-1",
    name: "Test Shopping List",
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
    _count: {
      items: 0,
    },
    ...overrides,
  });

  describe("fetches shopping lists successfully", () => {
    it.each([
      {
        name: "with multiple lists",
        mockLists: [
          createBaseShoppingList({ id: "list-1", name: "List 1", order: 0 }),
          createBaseShoppingList({ id: "list-2", name: "List 2", order: 1 }),
          createBaseShoppingList({ id: "list-3", name: "List 3", order: 2 }),
        ],
      },
      {
        name: "with lists containing items",
        mockLists: [
          createBaseShoppingList({
            id: "list-1",
            name: "List with Items",
            items: [
              {
                id: "item-1",
                name: "Item 1",
                checked: false,
                order: 0,
                shoppingListId: "list-1",
                notes: null,
                quantity: 1,
                unit: null,
              },
            ],
            _count: {
              items: 1,
            },
          }),
        ],
      },
      {
        name: "with no lists",
        mockLists: [],
      },
    ])("$name", async ({ mockLists }) => {
      prisma.shoppingList.findMany.mockResolvedValue(mockLists);

      const event = createMockH3Event({});

      const response = await handler(event);

      expect(prisma.shoppingList.findMany).toHaveBeenCalledWith({
        include: {
          items: {
            orderBy: [
              { order: "asc" },
              { checked: "asc" },
            ],
          },
          _count: {
            select: { items: true },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      expect(response).toEqual(mockLists);
    });
  });

  describe("error handling", () => {
    it("handles database errors", async () => {
      prisma.shoppingList.findMany.mockRejectedValue(
        new Error("Database error"),
      );

      const event = createMockH3Event({});

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
