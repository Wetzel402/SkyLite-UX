import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import { syncManager } from "~~/server/plugins/02.syncManager";

const { defineEventHandler } = useH3TestUtils();

vi.mock("@prisma/client", async () => {
  const actual = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
  return {
    ...actual,
    PrismaClient: vi.fn(() => prisma),
  };
});

import handler from "~~/server/api/integrations/[id].delete";

vi.mock("~/lib/prisma");
vi.mock("~~/server/plugins/02.syncManager", () => ({
  syncManager: {
    clearIntegrationSync: vi.fn(),
  },
}));

describe("dELETE /api/integrations/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("deletes integration successfully", () => {
    it("deletes integration and clears sync", async () => {
      prisma.integration.delete.mockResolvedValue({
        id: "integration-1",
        name: "Test Integration",
        type: "calendar" as const,
        service: "ical" as const,
        enabled: true,
        apiKey: null,
        baseUrl: "https://example.com",
        icon: null,
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Awaited<ReturnType<typeof prisma.integration.delete>>);

      const event = createMockH3Event({
        method: "DELETE",
        params: { id: "integration-1" },
      });

      const response = await handler(event);

      expect(syncManager.clearIntegrationSync).toHaveBeenCalledWith("integration-1");
      expect(prisma.integration.delete).toHaveBeenCalledWith({
        where: { id: "integration-1" },
      });
      expect(response).toEqual({ success: true });
    });
  });

  describe("error handling", () => {
    it("throws 400 when id is missing", async () => {
      const event = createMockH3Event({
        method: "DELETE",
        params: {},
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("handles database errors", async () => {
      prisma.integration.delete.mockRejectedValue(new Error("Database error"));

      const event = createMockH3Event({
        method: "DELETE",
        params: { id: "integration-1" },
      });

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
