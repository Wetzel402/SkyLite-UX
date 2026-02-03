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
  const actual = await vi.importActual("h3");
  return {
    ...actual,
    getQuery: vi.fn((event: H3Event) => {
      if (event?.context?.query) {
        return event.context.query;
      }
      return {};
    }),
  };
});

import handler from "~~/server/api/integrations/tandoor/[...path]";

vi.mock("~/lib/prisma");

global.fetch = vi.fn();

describe("tandoor proxy endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });


  const createBaseIntegration = () => ({
    id: "integration-1",
    name: "Tandoor Integration",
    type: "shopping" as const,
    service: "tandoor" as const,
    enabled: true,
    apiKey: "test-api-key",
    baseUrl: "https://tandoor.example.com",
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
        params: { path: ["recipes"] },
        query: { integrationId: "integration-1" },
        method: "GET",
      });

      const response = await handler(event);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("tandoor.example.com/api/recipes"),
        expect.objectContaining({
          method: "GET",
        }),
      );

      expect(response).toEqual({ data: "test" });
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

    it("throws 404 when integration not found", async () => {
      prisma.integration.findFirst.mockResolvedValue(null as Awaited<ReturnType<typeof prisma.integration.findFirst>>);

      const event = createMockH3Event({
        params: { path: ["recipes"] },
        query: { integrationId: "nonexistent" },
      });

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
