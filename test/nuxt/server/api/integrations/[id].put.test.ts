import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";

const { defineEventHandler } = useH3TestUtils();

const { integrationRegistry } = vi.hoisted(() => {
  const registry = new Map<string, { settingsFields: { key: string; label: string; required: boolean }[]; capabilities: string[] }>();
  return { integrationRegistry: registry };
});

vi.mock("@prisma/client", async () => {
  const actual = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
  return {
    ...actual,
    PrismaClient: vi.fn(() => prisma),
  };
});

import handler from "~~/server/api/integrations/[id].put";
import { createIntegrationService } from "~/types/integrations";

vi.mock("~/lib/prisma");
vi.mock("~/types/integrations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/types/integrations")>();
  return {
    ...actual,
    createIntegrationService: vi.fn(),
    integrationRegistry,
  };
});

describe("pUT /api/integrations/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    integrationRegistry.clear();
  });

  const createBaseIntegration = () => ({
    id: "integration-1",
    name: "Test Integration",
    type: "calendar" as const,
    service: "ical" as const,
    enabled: true,
    apiKey: "existing-key",
    baseUrl: "https://example.com",
    icon: null,
    settings: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  describe("updates integration successfully", () => {
    it("updates integration name", async () => {
      const currentIntegration = createBaseIntegration();
      const requestBody = {
        name: "Updated Name",
      };

      const mockUpdatedIntegration = {
        ...currentIntegration,
        name: requestBody.name,
      };

      prisma.integration.update.mockResolvedValue(mockUpdatedIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      const event = createMockH3Event({
        method: "PUT",
        params: { id: "integration-1" },
        body: requestBody,
      });

      const response = await handler(event);

      expect(prisma.integration.update).toHaveBeenCalledWith({
        where: { id: "integration-1" },
        data: {
          name: requestBody.name,
        },
      });
      expect(response.name).toBe(requestBody.name);
    });

    it("preserves clientSecret when updating settings", async () => {
      const currentIntegration = {
        ...createBaseIntegration(),
        settings: {
          clientSecret: "secret-123",
          otherSetting: "value",
        },
      };

      const requestBody = {
        settings: {
          otherSetting: "new-value",
        },
      };

      prisma.integration.findUnique.mockResolvedValue(currentIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);

      const mockUpdatedIntegration = {
        ...currentIntegration,
        settings: {
          ...requestBody.settings,
          clientSecret: "secret-123",
        },
      };

      prisma.integration.update.mockResolvedValue(mockUpdatedIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      const event = createMockH3Event({
        method: "PUT",
        params: { id: "integration-1" },
        body: requestBody,
      });

      const response = await handler(event);

      expect(prisma.integration.update).toHaveBeenCalledWith({
        where: { id: "integration-1" },
        data: expect.objectContaining({
          settings: expect.objectContaining({
            clientSecret: "secret-123",
          }),
        }),
      });
      
      expect(response.settings).not.toHaveProperty("clientSecret");
    });
  });

  describe("error handling", () => {
    it("throws 400 when id is missing", async () => {
      const event = createMockH3Event({
        method: "PUT",
        params: {},
        body: { name: "Updated Name" },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 404 when integration not found", async () => {
      prisma.integration.findUnique.mockResolvedValue(null as Awaited<ReturnType<typeof prisma.integration.findUnique>>);

      const event = createMockH3Event({
        method: "PUT",
        params: { id: "nonexistent" },
        body: { name: "Updated Name" },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("handles database errors", async () => {
      prisma.integration.findUnique.mockResolvedValue(createBaseIntegration() as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockRejectedValue(new Error("Database error"));

      const event = createMockH3Event({
        method: "PUT",
        params: { id: "integration-1" },
        body: { name: "Updated Name" },
      });

      await expect(handler(event)).rejects.toThrow();
    });
  });

  describe("integrationConfig validation", () => {
    it("throws 400 Missing required fields when config has required baseUrl and body omits it", async () => {
      integrationRegistry.set("calendar:ical", {
        settingsFields: [
          { key: "baseUrl", label: "URL", required: true },
        ],
        capabilities: ["get_events"],
      });

      const currentIntegration = {
        ...createBaseIntegration(),
        baseUrl: null,
      };
      prisma.integration.findUnique.mockResolvedValue(currentIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);

      const event = createMockH3Event({
        method: "PUT",
        params: { id: "integration-1" },
        body: { type: "calendar", service: "ical", settings: {} },
      });

      await expect(handler(event)).rejects.toThrow("Missing required fields");
      expect(prisma.integration.update).not.toHaveBeenCalled();
    });

    it("throws 400 Connection test failed when non-OAuth and testConnection returns false", async () => {
      integrationRegistry.set("calendar:ical", {
        settingsFields: [
          { key: "baseUrl", label: "URL", required: true },
        ],
        capabilities: ["get_events"],
      });

      const mockService = {
        testConnection: vi.fn().mockResolvedValue(false),
        getStatus: vi.fn().mockResolvedValue({ isConnected: false, lastChecked: new Date(), error: "Invalid URL" }),
      };
      vi.mocked(createIntegrationService).mockResolvedValue(mockService as unknown as Awaited<ReturnType<typeof createIntegrationService>>);

      const currentIntegration = createBaseIntegration();
      prisma.integration.findUnique.mockResolvedValue(currentIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);

      const event = createMockH3Event({
        method: "PUT",
        params: { id: "integration-1" },
        body: { type: "calendar", service: "ical", baseUrl: "https://example.com/cal.ics" },
      });

      await expect(handler(event)).rejects.toThrow("Connection test failed");
      expect(prisma.integration.update).not.toHaveBeenCalled();
    });

    it("throws 400 Unsupported integration type when createIntegrationService returns null", async () => {
      integrationRegistry.set("calendar:ical", {
        settingsFields: [
          { key: "baseUrl", label: "URL", required: true },
        ],
        capabilities: ["get_events"],
      });

      vi.mocked(createIntegrationService).mockResolvedValue(null as unknown as Awaited<ReturnType<typeof createIntegrationService>>);

      const currentIntegration = createBaseIntegration();
      prisma.integration.findUnique.mockResolvedValue(currentIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);

      const event = createMockH3Event({
        method: "PUT",
        params: { id: "integration-1" },
        body: { type: "calendar", service: "ical", baseUrl: "https://example.com/cal.ics" },
      });

      await expect(handler(event)).rejects.toThrow("Unsupported integration type");
      expect(prisma.integration.update).not.toHaveBeenCalled();
    });

    it("updates integration when non-OAuth and testConnection succeeds", async () => {
      integrationRegistry.set("calendar:ical", {
        settingsFields: [
          { key: "baseUrl", label: "URL", required: true },
        ],
        capabilities: ["get_events"],
      });

      const mockService = {
        testConnection: vi.fn().mockResolvedValue(true),
        getStatus: vi.fn().mockResolvedValue({ isConnected: true, lastChecked: new Date() }),
      };
      vi.mocked(createIntegrationService).mockResolvedValue(mockService as unknown as Awaited<ReturnType<typeof createIntegrationService>>);

      const currentIntegration = createBaseIntegration();
      const mockUpdated = { ...currentIntegration, baseUrl: "https://example.com/cal.ics" };
      prisma.integration.findUnique.mockResolvedValue(currentIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockUpdated as Awaited<ReturnType<typeof prisma.integration.update>>);

      const event = createMockH3Event({
        method: "PUT",
        params: { id: "integration-1" },
        body: { type: "calendar", service: "ical", baseUrl: "https://example.com/cal.ics" },
      });

      const response = await handler(event);

      expect(createIntegrationService).toHaveBeenCalled();
      expect(prisma.integration.update).toHaveBeenCalledWith({
        where: { id: "integration-1" },
        data: expect.objectContaining({ baseUrl: "https://example.com/cal.ics" }),
      });
      expect(response.id).toBe("integration-1");
    });
  });
});
