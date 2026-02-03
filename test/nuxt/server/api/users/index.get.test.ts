import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import handler from "~~/server/api/users/index.get";

const { defineEventHandler } = useH3TestUtils();

vi.mock("~/lib/prisma");

describe("gET /api/users", () => {
  it("is registered as an event handler", () =>
    expect(defineEventHandler).toHaveBeenCalled());

  const createBaseUser = (overrides = {}) => ({
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    avatar: null,
    color: null,
    todoOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    todoColumn: null,
    ...overrides,
  });

  describe("fetches users successfully", () => {
    it.each([
      {
        name: "with multiple users",
        mockUsers: [
          createBaseUser({ id: "user-1", name: "User A" }),
          createBaseUser({ id: "user-2", name: "User B" }),
          createBaseUser({ id: "user-3", name: "User C" }),
        ],
      },
      {
        name: "with users having todo columns",
        mockUsers: [
          createBaseUser({
            id: "user-1",
            todoColumn: {
              id: "column-1",
              name: "User A",
              order: 0,
              isDefault: true,
              _count: {
                todos: 5,
              },
            },
          }),
        ],
      },
      {
        name: "with no users",
        mockUsers: [],
      },
    ])("$name", async ({ mockUsers }) => {
      prisma.user.findMany.mockResolvedValue(mockUsers);

      const event = createMockH3Event({});

      const response = await handler(event);

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        include: {
          todoColumn: {
            include: {
              _count: {
                select: { todos: true },
              },
            },
          },
        },
        orderBy: {
          name: "asc",
        },
      });

      expect(response).toEqual(mockUsers);
    });
  });

  describe("error handling", () => {
    it("handles database errors", async () => {
      prisma.user.findMany.mockRejectedValue(new Error("Database error"));

      const event = createMockH3Event({});

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
