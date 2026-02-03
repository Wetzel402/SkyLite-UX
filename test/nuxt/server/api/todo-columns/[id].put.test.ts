import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import handler from "~~/server/api/todo-columns/[id].put";

const { defineEventHandler } = useH3TestUtils();

vi.mock("~/lib/prisma");

describe("pUT /api/todo-columns/[id]", () => {
  it("is registered as an event handler", () =>
    expect(defineEventHandler).toHaveBeenCalled());

  const createBaseUpdateBody = () => ({
    name: "Updated Column",
  });

  describe("updates column successfully", () => {
    it("updates column name", async () => {
      const requestBody = createBaseUpdateBody();

      const mockResponse = {
        id: "column-1",
        name: requestBody.name,
        order: 0,
        isDefault: false,
        userId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: null,
        todos: [],
        _count: {
          todos: 0,
        },
      };

      prisma.todoColumn.update.mockResolvedValue(mockResponse);

      const event = createMockH3Event({
        params: { id: "column-1" },
        body: requestBody,
      });

      const response = await handler(event);

      expect(prisma.todoColumn.update).toHaveBeenCalledWith({
        where: { id: "column-1" },
        data: {
          name: requestBody.name,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          todos: true,
          _count: {
            select: {
              todos: true,
            },
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
      prisma.todoColumn.update.mockRejectedValue(
        new Error("Database error"),
      );

      const event = createMockH3Event({
        params: { id: "column-1" },
        body: createBaseUpdateBody(),
      });

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
