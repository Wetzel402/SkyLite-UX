import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import handler from "~~/server/api/users/[id].put";

const { defineEventHandler } = useH3TestUtils();

vi.mock("~/lib/prisma");

describe("pUT /api/users/[id]", () => {
  it("is registered as an event handler", () =>
    expect(defineEventHandler).toHaveBeenCalled());

  const createBaseUpdateBody = () => ({
    name: "Updated User",
  });

  describe("updates user successfully", () => {
    it.each([
      {
        name: "update name only",
        params: { id: "user-1" },
        body: (base: ReturnType<typeof createBaseUpdateBody>) => ({
          ...base,
          name: "New Name",
        }),
        expectTodoColumnUpdate: true,
      },
      {
        name: "update email",
        params: { id: "user-1" },
        body: (base: ReturnType<typeof createBaseUpdateBody>) => ({
          ...base,
          email: "newemail@example.com",
        }),
        expectTodoColumnUpdate: false,
      },
      {
        name: "update avatar and color",
        params: { id: "user-1" },
        body: (base: ReturnType<typeof createBaseUpdateBody>) => ({
          ...base,
          avatar: "new-avatar",
          color: "#00FF00",
        }),
        expectTodoColumnUpdate: false,
      },
      {
        name: "update todoOrder",
        params: { id: "user-1" },
        body: (base: ReturnType<typeof createBaseUpdateBody>) => ({
          ...base,
          todoOrder: 5,
        }),
        expectTodoColumnUpdate: false,
      },
      {
        name: "update name with trimmed email",
        params: { id: "user-1" },
        body: (base: ReturnType<typeof createBaseUpdateBody>) => ({
          ...base,
          name: "New Name",
          email: "  trimmed@example.com  ",
        }),
        expectTodoColumnUpdate: true,
      },
    ])("$name", async ({ params, body, expectTodoColumnUpdate }) => {
      const requestBody = body(createBaseUpdateBody()) as {
        name: string;
        email?: string;
        avatar?: string;
        color?: string;
        todoOrder?: number;
      };

      const mockUpdatedUser = {
        id: params.id,
        name: requestBody.name || "Test User",
        email: requestBody.email?.trim() || null,
        avatar: requestBody.avatar || null,
        color: requestBody.color || null,
        todoOrder: requestBody.todoOrder ?? 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.user.update.mockResolvedValue(mockUpdatedUser);
      prisma.todoColumn.updateMany.mockResolvedValue({ count: 1 });

      const txMock = {
        user: {
          update: vi.fn().mockResolvedValue(mockUpdatedUser),
        },
        todoColumn: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      };

      prisma.$transaction.mockImplementation(async (args) => {
        if (Array.isArray(args)) {
          const results = await Promise.all(args);
          return results;
        }
        const result = await args(txMock as unknown as Parameters<Parameters<typeof prisma.$transaction>[0]>[0]);
        return Array.isArray(result) ? result : [result];
      });

      const event = createMockH3Event({
        params,
        body: requestBody,
      });

      const response = await handler(event);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: params.id },
        data: {
          name: requestBody.name,
          email: requestBody.email?.trim() || null,
          avatar: requestBody.avatar || null,
          color: requestBody.color || null,
          todoOrder: requestBody.todoOrder ?? undefined,
        },
      });

      if (expectTodoColumnUpdate) {
        expect(prisma.todoColumn.updateMany).toHaveBeenCalledWith({
          where: { userId: params.id },
          data: { name: requestBody.name },
        });
      }

      expect(response).toEqual(mockUpdatedUser);
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
      prisma.$transaction.mockRejectedValue(new Error("Database error"));

      const event = createMockH3Event({
        params: { id: "user-1" },
        body: createBaseUpdateBody(),
      });

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
