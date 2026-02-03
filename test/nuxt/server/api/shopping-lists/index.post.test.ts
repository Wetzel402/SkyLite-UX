import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import handler from "~~/server/api/shopping-lists/index.post";

const { defineEventHandler } = useH3TestUtils();

vi.mock("~/lib/prisma");

describe("pOST /api/shopping-lists", () => {
  it("is registered as an event handler", () =>
    expect(defineEventHandler).toHaveBeenCalled());

  const createBaseRequestBody = () => ({
    name: "Test Shopping List",
  });

  describe("creates shopping list successfully", () => {
    it.each([
      {
        name: "empty list",
        requestBody: (base: ReturnType<typeof createBaseRequestBody>) => base,
      },
      {
        name: "list with items",
        requestBody: (base: ReturnType<typeof createBaseRequestBody>) => ({
          ...base,
          items: [
            {
              name: "Item 1",
              checked: false,
              order: 0,
              quantity: 1,
              unit: null,
              notes: null,
            },
            {
              name: "Item 2",
              checked: false,
              order: 1,
              quantity: 2,
              unit: "kg",
              notes: "Test notes",
            },
          ],
        }),
      },
    ])("$name", async ({ requestBody }) => {
      const request = requestBody(createBaseRequestBody()) as {
        name: string;
        items?: Array<{ name: string; quantity?: number; unit?: string; notes?: string }>;
      };

      const mockResponse = {
        id: "list-123",
        name: request.name,
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: request.items || [],
        _count: {
          items: request.items?.length || 0,
        },
      };

      prisma.shoppingList.create.mockResolvedValue(mockResponse);

      const event = createMockH3Event({
        body: request,
      });

      const response = await handler(event);

      expect(prisma.shoppingList.create).toHaveBeenCalledWith({
        data: {
          name: request.name,
          items: {
            create: request.items || [],
          },
        },
        include: {
          items: true,
          _count: {
            select: { items: true },
          },
        },
      });

      expect(response).toEqual(mockResponse);
      expect(response.name).toBe(request.name);
    });
  });

  describe("error handling", () => {
    it("handles database errors", async () => {
      prisma.shoppingList.create.mockRejectedValue(
        new Error("Database error"),
      );

      const event = createMockH3Event({
        body: createBaseRequestBody(),
      });

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
