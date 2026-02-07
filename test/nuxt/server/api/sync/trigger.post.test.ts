import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import { setupIntegrationSync } from "~~/server/plugins/02.syncManager";

const { defineEventHandler } = useH3TestUtils();

import handler from "~~/server/api/sync/trigger.post";

vi.mock("~/lib/prisma");
vi.mock("~~/server/plugins/02.syncManager", () => ({
  setupIntegrationSync: vi.fn(),
}));

describe("pOST /api/sync/trigger", () => {

  const createBaseIntegration = () => ({
    id: "integration-1",
    name: "Test Integration",
    type: "calendar" as const,
    service: "ical" as const,
    enabled: true,
    apiKey: null,
    baseUrl: null,
    icon: null,
    settings: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  describe("triggers sync successfully", () => {
    it.each([
      {
        name: "normal sync",
        body: {
          integrationId: "integration-1",
          integrationType: "calendar",
        },
        force: false,
      },
      {
        name: "force sync",
        body: {
          integrationId: "integration-1",
          integrationType: "calendar",
          force: true,
        },
        force: true,
      },
    ])("$name", async ({ body, force }) => {
      const mockIntegration = createBaseIntegration();

      prisma.integration.findUnique.mockResolvedValue(mockIntegration);
      vi.mocked(setupIntegrationSync).mockResolvedValue(undefined);

      const event = createMockH3Event({
        method: "POST",
        body,
      });

      const response = await handler(event);

      expect(prisma.integration.findUnique).toHaveBeenCalledWith({
        where: { id: body.integrationId },
      });

      expect(setupIntegrationSync).toHaveBeenCalledWith(
        mockIntegration,
        true,
      );

      expect(response).toEqual({
        success: true,
        message: "Integration sync triggered successfully",
        integrationId: body.integrationId,
        integrationType: body.integrationType,
      });
    });
  });

  describe("error handling", () => {
    it("throws 400 when integrationId is missing", async () => {
      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationType: "calendar",
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 400 when integrationType is missing", async () => {
      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 404 when integration not found", async () => {
      prisma.integration.findUnique.mockResolvedValue(null);

      const event = createMockH3Event({
        body: {
          integrationId: "nonexistent",
          integrationType: "calendar",
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 400 when integration is not enabled", async () => {
      const mockIntegration = {
        ...createBaseIntegration(),
        enabled: false,
      };

      prisma.integration.findUnique.mockResolvedValue(mockIntegration);

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          integrationType: "calendar",
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("handles database errors", async () => {
      prisma.integration.findUnique.mockRejectedValue(
        new Error("Database error"),
      );

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          integrationType: "calendar",
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
