import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import handler from "~~/server/api/users/reorder.post";

const { defineEventHandler } = useH3TestUtils();

vi.mock("~/lib/prisma");

describe("pOST /api/users/reorder", () => {
  it("is registered as an event handler", () =>
    expect(defineEventHandler).toHaveBeenCalled());

  describe("reorders users successfully", () => {
    it("reorders multiple users", async () => {
      const userIds = ["user-1", "user-2", "user-3"];

      const mockUpdates = userIds.map((userId, index) =>
        Promise.resolve({
          id: userId,
          name: `User ${index + 1}`,
          email: null,
          avatar: null,
          color: null,
          todoOrder: index,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );

      prisma.$transaction.mockResolvedValue(
        await Promise.all(mockUpdates),
      );

      const event = createMockH3Event({
        body: { userIds },
      });

      const response = await handler(event);

      expect(response).toEqual({ success: true });
    });

    it("handles single user reorder", async () => {
      const userIds = ["user-1"];

      const mockUpdates = userIds.map((userId, index) =>
        Promise.resolve({
          id: userId,
          name: `User ${index + 1}`,
          email: null,
          avatar: null,
          color: null,
          todoOrder: index,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );

      prisma.$transaction.mockResolvedValue(
        await Promise.all(mockUpdates),
      );

      const event = createMockH3Event({
        body: { userIds },
      });

      const response = await handler(event);

      expect(response).toEqual({ success: true });
    });
  });

  describe("error handling", () => {
    it("throws 400 when userIds is not an array", async () => {
      const event = createMockH3Event({
        body: { userIds: "not-an-array" },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("handles database errors", async () => {
      prisma.$transaction.mockRejectedValue(new Error("Database error"));

      const event = createMockH3Event({
        body: { userIds: ["user-1"] },
      });

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
