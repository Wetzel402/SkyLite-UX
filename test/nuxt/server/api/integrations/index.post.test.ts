import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import { createIntegrationService, integrationRegistry } from "~/types/integrations";

const { defineEventHandler } = useH3TestUtils();

vi.mock("@prisma/client", async () => {
  const actual = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
  return {
    ...actual,
    PrismaClient: vi.fn(() => prisma),
  };
});

import handler from "~~/server/api/integrations/index.post";

vi.mock("~/lib/prisma");
vi.mock("~/types/integrations", () => ({
  createIntegrationService: vi.fn(),
  integrationRegistry: new Map(),
}));

describe("pOST /api/integrations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear integration registry to prevent state leakage
    vi.mocked(integrationRegistry).clear();
  });

  const createBaseRequestBody = () => ({
    name: `Test Integration ${Date.now()}`,
    type: "calendar",
    service: "ical",
    enabled: true,
  });

  describe("creates integration successfully", () => {
    it("creates integration with API key", async () => {
      const requestBody = {
        ...createBaseRequestBody(),
        apiKey: "test-api-key",
        baseUrl: "https://example.com",
      };

      const mockIntegrationConfig = {
        type: "calendar",
        service: "ical",
        capabilities: [],
        settingsFields: [
          { key: "apiKey", label: "API Key", type: "password" as const, required: true },
          { key: "baseUrl", label: "Base URL", type: "url" as const, required: true },
        ],
        icon: "https://example.com/icon.svg",
        dialogFields: [],
        syncInterval: 10,
      };

      vi.mocked(integrationRegistry).set("calendar:ical", mockIntegrationConfig);

      const mockService = {
        testConnection: vi.fn().mockResolvedValue(true),
        getStatus: vi.fn().mockResolvedValue({ error: null }),
      };

      vi.mocked(createIntegrationService).mockResolvedValue(
        mockService as never,
      );

      const mockCreatedIntegration = {
        id: "integration-123",
        ...requestBody,
        apiKey: requestBody.apiKey || null,
        baseUrl: requestBody.baseUrl || null,
        icon: null,
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.integration.create.mockResolvedValue(mockCreatedIntegration as Awaited<ReturnType<typeof prisma.integration.create>>);

      const event = createMockH3Event({
        method: "POST",
        body: requestBody,
      });

      const response = await handler(event);

      expect(createIntegrationService).toHaveBeenCalled();
      expect(mockService.testConnection).toHaveBeenCalled();
      expect(prisma.integration.create).toHaveBeenCalled();

      expect(response).toHaveProperty("id");
      expect(response.name).toBe(requestBody.name);
    });
  });

  describe("error handling", () => {
    it("throws 400 when integration type is unsupported", async () => {
      const requestBody = createBaseRequestBody();

      vi.mocked(integrationRegistry).clear();

      const event = createMockH3Event({
        method: "POST",
        body: requestBody,
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 400 when required fields are missing", async () => {
      const requestBody = {
        ...createBaseRequestBody(),
      };

      const mockIntegrationConfig = {
        type: "calendar",
        service: "ical",
        capabilities: [],
        settingsFields: [
          { key: "apiKey", label: "API Key", type: "password" as const, required: true },
        ],
        icon: "https://example.com/icon.svg",
        dialogFields: [],
        syncInterval: 10,
      };

      vi.mocked(integrationRegistry).set("calendar:ical", mockIntegrationConfig);

      const event = createMockH3Event({
        method: "POST",
        body: requestBody,
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("handles database errors", async () => {
      const requestBody = {
        ...createBaseRequestBody(),
        apiKey: "test-key",
        baseUrl: "https://example.com",
      };

      const mockIntegrationConfig = {
        type: "calendar",
        service: "ical",
        capabilities: [],
        settingsFields: [],
        icon: "https://example.com/icon.svg",
        dialogFields: [],
        syncInterval: 10,
      };

      vi.mocked(integrationRegistry).set("calendar:ical", mockIntegrationConfig);

      prisma.integration.create.mockRejectedValue(
        new Error("Database error"),
      );

      const event = createMockH3Event({
        method: "POST",
        body: requestBody,
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 400 Unsupported integration type when createIntegrationService returns null", async () => {
      const requestBody = {
        ...createBaseRequestBody(),
        baseUrl: "https://example.com/cal.ics",
      };

      const mockIntegrationConfig = {
        type: "calendar",
        service: "ical",
        capabilities: ["get_events"],
        settingsFields: [
          { key: "baseUrl", label: "URL", type: "url" as const, required: true },
        ],
        icon: "",
        dialogFields: [],
        syncInterval: 10,
      };

      vi.mocked(integrationRegistry).set("calendar:ical", mockIntegrationConfig);
      vi.mocked(createIntegrationService).mockResolvedValue(null as never);

      const event = createMockH3Event({
        method: "POST",
        body: requestBody,
      });

      await expect(handler(event)).rejects.toThrow("Unsupported integration type");
      expect(prisma.integration.create).not.toHaveBeenCalled();
    });

    it("throws 400 Connection test failed when testConnection returns false", async () => {
      const requestBody = {
        ...createBaseRequestBody(),
        baseUrl: "https://example.com/cal.ics",
      };

      const mockIntegrationConfig = {
        type: "calendar",
        service: "ical",
        capabilities: ["get_events"],
        settingsFields: [
          { key: "baseUrl", label: "URL", type: "url" as const, required: true },
        ],
        icon: "",
        dialogFields: [],
        syncInterval: 10,
      };

      vi.mocked(integrationRegistry).set("calendar:ical", mockIntegrationConfig);

      const mockService = {
        testConnection: vi.fn().mockResolvedValue(false),
        getStatus: vi.fn().mockResolvedValue({ error: "Invalid URL" }),
      };
      vi.mocked(createIntegrationService).mockResolvedValue(mockService as never);

      const event = createMockH3Event({
        method: "POST",
        body: requestBody,
      });

      await expect(handler(event)).rejects.toThrow("Connection test failed");
      expect(prisma.integration.create).not.toHaveBeenCalled();
    });
  });
});
