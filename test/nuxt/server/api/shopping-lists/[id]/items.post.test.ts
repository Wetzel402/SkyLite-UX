import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import handler from "~~/server/api/shopping-lists/[id]/items.post";

const { defineEventHandler } = useH3TestUtils();

vi.mock("~/lib/prisma");

describe("pOST /api/shopping-lists/[id]/items", () => {
  it("is registered as an event handler", () =>
    expect(defineEventHandler).toHaveBeenCalled());

  const createBaseRequestBody = () => ({
    name: "Test Item",
    quantity: 1,
    unit: null,
    notes: null,
  });

  describe("creates item successfully", () => {
    it.each([
      {
        name: "basic item",
        requestBody: (base: ReturnType<typeof createBaseRequestBody>) => base,
      },
      {
        name: "item with quantity and unit",
        requestBody: (base: ReturnType<typeof createBaseRequestBody>) => ({
          ...base,
          quantity: 2,
          unit: "kg",
        }),
      },
      {
        name: "item with notes",
        requestBody: (base: ReturnType<typeof createBaseRequestBody>) => ({
          ...base,
          notes: "Test notes",
        }),
      },
    ])("$name", async ({ requestBody }) => {
      const request = requestBody(createBaseRequestBody());
      const maxOrder = 5;
      const expectedOrder = maxOrder + 1;

      prisma.shoppingListItem.aggregate.mockResolvedValue({
        _max: { order: maxOrder },
      } as Awaited<ReturnType<typeof prisma.shoppingListItem.aggregate>>);

      const mockResponse = {
        id: "item-123",
        name: request.name,
        quantity: request.quantity || 1,
        unit: request.unit,
        notes: request.notes,
        checked: false,
        shoppingListId: "list-1",
        order: expectedOrder,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.shoppingListItem.create.mockResolvedValue(mockResponse);

      const event = createMockH3Event({
        params: { id: "list-1" },
        body: request,
      });

      const response = await handler(event);

      expect(prisma.shoppingListItem.aggregate).toHaveBeenCalledWith({
        where: {
          shoppingListId: "list-1",
        },
        _max: {
          order: true,
        },
      });

      expect(prisma.shoppingListItem.create).toHaveBeenCalledWith({
        data: {
          name: request.name,
          quantity: request.quantity || 1,
          unit: request.unit,
          notes: request.notes,
          shoppingListId: "list-1",
          order: expectedOrder,
        },
      });

      expect(response).toEqual(mockResponse);
    });
  });

  describe("error handling", () => {
    it("throws 400 when listId is missing", async () => {
      const event = createMockH3Event({
        params: {},
        body: createBaseRequestBody(),
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("handles database errors", async () => {
      prisma.shoppingListItem.aggregate.mockResolvedValue({ _max: { order: 0 } } as Awaited<ReturnType<typeof prisma.shoppingListItem.aggregate>>);
      prisma.shoppingListItem.create.mockRejectedValue(
        new Error("Database error"),
      );

      const event = createMockH3Event({
        params: { id: "list-1" },
        body: createBaseRequestBody(),
      });

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
