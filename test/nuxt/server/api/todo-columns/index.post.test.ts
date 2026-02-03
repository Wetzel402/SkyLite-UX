import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import handler from "~~/server/api/todo-columns/index.post";

const { defineEventHandler } = useH3TestUtils();

vi.mock("~/lib/prisma");

describe("pOST /api/todo-columns", () => {
  it("is registered as an event handler", () =>
    expect(defineEventHandler).toHaveBeenCalled());

  const createBaseRequestBody = () => ({
    name: "Test Column",
  });

  describe("creates todo column successfully", () => {
    it.each([
      {
        name: "basic column",
        requestBody: (base: ReturnType<typeof createBaseRequestBody>) => base,
        expectedData: {
          isDefault: false,
          userId: null,
        },
      },
      {
        name: "column with userId",
        requestBody: (base: ReturnType<typeof createBaseRequestBody>) => ({
          ...base,
          userId: "user-1",
        }),
        expectedData: {
          isDefault: false,
          userId: "user-1",
        },
      },
      {
        name: "default column",
        requestBody: (base: ReturnType<typeof createBaseRequestBody>) => ({
          ...base,
          isDefault: true,
        }),
        expectedData: {
          isDefault: true,
          userId: null,
        },
      },
    ])("$name", async ({ requestBody, expectedData }) => {
      const request = requestBody(createBaseRequestBody()) as {
        name: string;
        userId?: string | null;
        isDefault?: boolean;
      };
      const maxOrder = 5;
      const expectedOrder = maxOrder + 1;

      prisma.todoColumn.aggregate.mockResolvedValue({ _max: { order: maxOrder } } as Awaited<ReturnType<typeof prisma.todoColumn.aggregate>>);

      const mockResponse = {
        id: "column-123",
        name: request.name,
        userId: expectedData.userId,
        isDefault: expectedData.isDefault,
        order: expectedOrder,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: expectedData.userId
          ? {
              id: "user-1",
              name: "Test User",
              avatar: null,
            }
          : null,
        _count: {
          todos: 0,
        },
      };

      prisma.todoColumn.create.mockResolvedValue(mockResponse);

      const event = createMockH3Event({
        body: request,
      });

      const response = await handler(event);

      expect(prisma.todoColumn.aggregate).toHaveBeenCalledWith({
        _max: {
          order: true,
        },
      });

      expect(prisma.todoColumn.create).toHaveBeenCalledWith({
        data: {
          name: request.name,
          userId: request.userId || null,
          isDefault: request.isDefault || false,
          order: expectedOrder,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          _count: {
            select: { todos: true },
          },
        },
      });

      expect(response).toEqual(mockResponse);
    });
  });

  describe("error handling", () => {
    it("handles database errors", async () => {
      prisma.todoColumn.aggregate.mockResolvedValue({ _max: { order: 0 } } as Awaited<ReturnType<typeof prisma.todoColumn.aggregate>>);
      prisma.todoColumn.create.mockRejectedValue(
        new Error("Database error"),
      );

      const event = createMockH3Event({
        body: createBaseRequestBody(),
      });

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
