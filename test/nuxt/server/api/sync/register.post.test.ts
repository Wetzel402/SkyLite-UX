import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi } from "vitest";

import { setupIntegrationSync } from "~~/server/plugins/02.syncManager";

const { defineEventHandler } = useH3TestUtils();

import handler from "~~/server/api/sync/register.post";

vi.mock("~~/server/plugins/02.syncManager", () => ({
  setupIntegrationSync: vi.fn(),
}));

describe("pOST /api/sync/register", () => {

  const createBaseIntegration = () => ({
    id: "integration-1",
    name: "Test Integration",
    type: "calendar" as const,
    service: "ical" as const,
    enabled: true,
    settings: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  describe("registers integration successfully", () => {
    it("registers integration for sync", async () => {
      const integration = createBaseIntegration();

      vi.mocked(setupIntegrationSync).mockResolvedValue(undefined);

      const event = createMockH3Event({
        method: "POST",
        body: integration,
      });

      const response = await handler(event);

      expect(setupIntegrationSync).toHaveBeenCalledWith(
        expect.objectContaining({
          ...integration,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        }),
      );

      expect(response).toEqual({
        success: true,
        message: "Integration registered for sync",
      });
    });
  });

  describe("error handling", () => {
    it("handles errors when registering integration", async () => {
      const integration = createBaseIntegration();

      vi.mocked(setupIntegrationSync).mockRejectedValue(
        new Error("Registration error"),
      );

      const event = createMockH3Event({
        method: "POST",
        body: integration,
      });

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
