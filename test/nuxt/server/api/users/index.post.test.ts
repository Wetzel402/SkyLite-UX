import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import handler from "~~/server/api/users/index.post";

const { defineEventHandler } = useH3TestUtils();

vi.mock("~/lib/prisma");

describe("pOST /api/users", () => {
  it("is registered as an event handler", () =>
    expect(defineEventHandler).toHaveBeenCalled());

  const createBaseRequestBody = () => ({
    name: "Test User",
  });

  describe("creates user successfully", () => {
    it.each([
      {
        name: "basic user",
        requestBody: (base: ReturnType<typeof createBaseRequestBody>) => base,
      },
      {
        name: "user with email",
        requestBody: (base: ReturnType<typeof createBaseRequestBody>) => ({
          ...base,
          email: "test@example.com",
        }),
      },
      {
        name: "user with avatar and color",
        requestBody: (base: ReturnType<typeof createBaseRequestBody>) => ({
          ...base,
          avatar: "avatar-url",
          color: "#FF0000",
        }),
      },
      {
        name: "user with trimmed email",
        requestBody: (base: ReturnType<typeof createBaseRequestBody>) => ({
          ...base,
          email: "  test@example.com  ",
        }),
      },
    ])("$name", async ({ requestBody }) => {
      const request = requestBody(createBaseRequestBody()) as {
        name: string;
        email?: string;
        avatar?: string;
        color?: string;
      };
      const maxOrder = 5;
      const expectedOrder = maxOrder + 1;

      prisma.todoColumn.aggregate.mockResolvedValue({ _max: { order: maxOrder } } as Awaited<ReturnType<typeof prisma.todoColumn.aggregate>>);

      const mockUser = {
        id: "user-123",
        name: request.name,
        email: request.email?.trim() || null,
        avatar: request.avatar || null,
        color: request.color || null,
        todoOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockTodoColumn = {
        id: "column-123",
        name: request.name,
        userId: mockUser.id,
        isDefault: true,
        order: expectedOrder,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          user: {
            create: vi.fn().mockResolvedValue(mockUser),
          },
          todoColumn: {
            create: vi.fn().mockResolvedValue(mockTodoColumn),
          },
        };
        const result = await callback(tx as unknown as Parameters<Parameters<typeof prisma.$transaction>[0]>[0]);
        return result;
      });

      const event = createMockH3Event({
        body: request,
      });

      const response = await handler(event);

      expect(prisma.todoColumn.aggregate).toHaveBeenCalledWith({
        _max: {
          order: true,
        },
      });

      expect(response).toEqual(mockUser);
    });
  });

  describe("error handling", () => {
    it("handles database errors", async () => {
      prisma.todoColumn.aggregate.mockResolvedValue({ _max: { order: 0 } } as Awaited<ReturnType<typeof prisma.todoColumn.aggregate>>);
      prisma.$transaction.mockRejectedValue(new Error("Database error"));

      const event = createMockH3Event({
        body: createBaseRequestBody(),
      });

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
