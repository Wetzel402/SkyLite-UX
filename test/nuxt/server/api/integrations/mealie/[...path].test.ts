import type { H3Event } from "h3";

import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi, beforeEach } from "vitest";

import prisma from "~/lib/__mocks__/prisma";

const { defineEventHandler } = useH3TestUtils();

vi.mock("@prisma/client", async () => {
  const actual = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
  return {
    ...actual,
    PrismaClient: vi.fn(() => prisma),
  };
});

vi.mock("h3", async () => {
  const actual = await vi.importActual<typeof import("h3")>("h3");
  const getQueryMock = vi.fn((event: H3Event) => {
    const query = event?.context?.query;
    if (query && typeof query === "object") {
      return query;
    }
    return {};
  });
  return {
    ...actual,
    getQuery: getQueryMock,
  };
});

import handler from "~~/server/api/integrations/mealie/[...path]";

vi.mock("~/lib/prisma");

global.fetch = vi.fn();

describe("mealie proxy endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });


  const createBaseIntegration = () => ({
    id: "integration-1",
    name: "Mealie Integration",
    type: "shopping" as const,
    service: "mealie" as const,
    enabled: true,
    apiKey: "test-api-key",
    baseUrl: "https://mealie.example.com",
    icon: null,
    settings: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  describe("proxies requests successfully", () => {
    it("proxies GET request", async () => {
      const mockIntegration = createBaseIntegration();

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: "test" }),
      } as Response);

      const event = createMockH3Event({
        params: { path: ["shopping-lists"] },
        query: { integrationId: "integration-1" },
        method: "GET",
      });

      const response = await handler(event);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("mealie.example.com"),
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockIntegration.apiKey}`,
          }),
        }),
      );

      expect(response).toEqual({ data: "test" });
    });

    it("proxies POST request with body", async () => {
      const mockIntegration = createBaseIntegration();

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as Response);

      const event = createMockH3Event({
        params: { path: ["shopping-lists"] },
        query: { integrationId: "integration-1" },
        method: "POST",
        body: { name: "New List" },
      });

      const response = await handler(event);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "New List" }),
        }),
      );

      expect(response).toEqual({ success: true });
    });
  });

  describe("error handling", () => {
    it("throws 400 when path is missing", async () => {
      const event = createMockH3Event({
        params: {},
        query: { integrationId: "integration-1" },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 400 when integrationId is missing", async () => {
      const event = createMockH3Event({
        params: { path: ["shopping-lists"] },
        query: {},
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 404 when integration not found", async () => {
      prisma.integration.findFirst.mockResolvedValue(null);

      const event = createMockH3Event({
        params: { path: ["shopping-lists"] },
        query: { integrationId: "nonexistent" },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 400 when integration type is invalid", async () => {
      const mockIntegration = {
        ...createBaseIntegration(),
        type: "calendar" as const,
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration);

      const event = createMockH3Event({
        params: { path: ["shopping-lists"] },
        query: { integrationId: "integration-1" },
      });

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
