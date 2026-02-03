import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";

const { defineEventHandler } = useH3TestUtils();

vi.mock("@prisma/client", async () => {
  const actual = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
  return {
    ...actual,
    PrismaClient: vi.fn(() => prisma),
  };
});

import handler from "~~/server/api/integrations/index.get";

vi.mock("~/lib/prisma");
vi.mock("~/server/utils/sanitizeIntegration", () => ({
  sanitizeIntegration: vi.fn((integration) => ({
    ...integration,
    apiKey: undefined,
    settings: integration.settings,
  })),
}));

describe("gET /api/integrations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("lists integrations successfully", () => {
    it("returns all integrations sorted by creation date", async () => {
      const mockIntegrations = [
        {
          id: "integration-1",
          name: "Integration 1",
          type: "calendar" as const,
          service: "ical" as const,
          enabled: true,
          apiKey: "secret-key-1",
          baseUrl: "https://example.com",
          icon: null,
          settings: { test: "value" },
          createdAt: new Date("2025-01-01"),
          updatedAt: new Date("2025-01-01"),
        },
        {
          id: "integration-2",
          name: "Integration 2",
          type: "shopping" as const,
          service: "mealie" as const,
          enabled: false,
          apiKey: "secret-key-2",
          baseUrl: "https://mealie.example.com",
          icon: null,
          settings: {},
          createdAt: new Date("2025-01-02"),
          updatedAt: new Date("2025-01-02"),
        },
      ];

      prisma.integration.findMany.mockResolvedValue(mockIntegrations as Awaited<ReturnType<typeof prisma.integration.findMany>>);

      const event = createMockH3Event({
        method: "GET",
      });

      const response = await handler(event);

      expect(prisma.integration.findMany).toHaveBeenCalledWith({
        orderBy: {
          createdAt: "desc",
        },
      });
      expect(response).toHaveLength(2);
      expect(response[0]?.id).toBe("integration-1");
      expect(response[1]?.id).toBe("integration-2");
    });

    it("returns empty array when no integrations exist", async () => {
      prisma.integration.findMany.mockResolvedValue([]);

      const event = createMockH3Event({
        method: "GET",
      });

      const response = await handler(event);

      expect(response).toEqual([]);
    });
  });

  describe("error handling", () => {
    it("handles database errors", async () => {
      prisma.integration.findMany.mockRejectedValue(new Error("Database error"));

      const event = createMockH3Event({
        method: "GET",
      });

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
