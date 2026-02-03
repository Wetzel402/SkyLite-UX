import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import handler from "~~/server/api/shopping-lists/[id].put";

const { defineEventHandler } = useH3TestUtils();

vi.mock("~/lib/prisma");

describe("pUT /api/shopping-lists/[id]", () => {
  it("is registered as an event handler", () =>
    expect(defineEventHandler).toHaveBeenCalled());

  const createBaseShoppingList = (overrides = {}) => ({
    id: "list-1",
    name: "Test Shopping List",
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
    ...overrides,
  });

  const createBaseUpdateBody = () => ({
    name: "Updated Shopping List",
  });

  describe("updates shopping list successfully", () => {
    it("updates list name", async () => {
      const mockList = createBaseShoppingList();
      const requestBody = createBaseUpdateBody();

      const mockResponse = {
        ...mockList,
        name: requestBody.name,
        items: [],
      };

      prisma.shoppingList.update.mockResolvedValue(mockResponse);

      const event = createMockH3Event({
        params: { id: "list-1" },
        body: requestBody,
      });

      const response = await handler(event);

      expect(prisma.shoppingList.update).toHaveBeenCalledWith({
        where: { id: "list-1" },
        data: {
          name: requestBody.name,
        },
        include: {
          items: {
            orderBy: { order: "asc" },
          },
        },
      });

      expect(response).toEqual(mockResponse);
      expect(response.name).toBe(requestBody.name);
    });
  });

  describe("error handling", () => {
    it("throws 400 when id is missing", async () => {
      const event = createMockH3Event({
        params: {},
        body: createBaseUpdateBody(),
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("handles database errors", async () => {
      prisma.shoppingList.update.mockRejectedValue(
        new Error("Database error"),
      );

      const event = createMockH3Event({
        params: { id: "list-1" },
        body: createBaseUpdateBody(),
      });

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
