import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import handler from "~~/server/api/shopping-list-items/[id].put";

const { defineEventHandler } = useH3TestUtils();

vi.mock("~/lib/prisma");

describe("pUT /api/shopping-list-items/[id]", () => {
  it("is registered as an event handler", () =>
    expect(defineEventHandler).toHaveBeenCalled());

  const createBaseUpdateBody = () => ({
    name: "Updated Item",
    quantity: 2,
    unit: "kg",
    checked: false,
    notes: "Updated notes",
  });

  describe("updates item successfully", { timeout: 15_000 }, () => {
    it.each([
      {
        name: "update name",
        body: (base: ReturnType<typeof createBaseUpdateBody>) => ({
          ...base,
          name: "New Name",
        }),
      },
      {
        name: "update quantity and unit",
        body: (base: ReturnType<typeof createBaseUpdateBody>) => ({
          ...base,
          quantity: 3,
          unit: "lbs",
        }),
      },
      {
        name: "toggle checked status",
        body: (base: ReturnType<typeof createBaseUpdateBody>) => ({
          ...base,
          checked: true,
        }),
      },
      {
        name: "update notes",
        body: (base: ReturnType<typeof createBaseUpdateBody>) => ({
          ...base,
          notes: "New notes",
        }),
      },
    ])("$name", async ({ body }) => {
      const requestBody = body(createBaseUpdateBody());

      const mockResponse = {
        id: "item-1",
        ...requestBody,
        shoppingListId: "list-1",
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.shoppingListItem.update.mockResolvedValue(mockResponse);

      const event = createMockH3Event({
        params: { id: "item-1" },
        body: requestBody,
      });

      const response = await handler(event);

      expect(prisma.shoppingListItem.update).toHaveBeenCalledWith({
        where: { id: "item-1" },
        data: {
          name: requestBody.name,
          quantity: requestBody.quantity,
          unit: requestBody.unit,
          checked: requestBody.checked,
          notes: requestBody.notes,
        },
      });

      expect(response).toEqual(mockResponse);
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
      prisma.shoppingListItem.update.mockRejectedValue(
        new Error("Database error"),
      );

      const event = createMockH3Event({
        params: { id: "item-1" },
        body: createBaseUpdateBody(),
      });

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
