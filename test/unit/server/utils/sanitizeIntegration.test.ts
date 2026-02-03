import { describe, expect, it } from "vitest";

import { sanitizeIntegration, sanitizeSettings } from "../../../../server/utils/sanitizeIntegration";

import type { Integration } from "@prisma/client";

describe("sanitizeIntegration", () => {
  const createBaseIntegration = (overrides = {}): Integration => ({
    id: "integration-1",
    name: "Test Integration",
    type: "calendar",
    service: "ical",
    enabled: true,
    apiKey: "test-key",
    baseUrl: "https://example.com",
    icon: null,
    settings: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Integration);

  describe("sanitizeSettings", () => {
    it("returns settings as-is when not an object", () => {
      expect(sanitizeSettings(null)).toBe(null);
      expect(sanitizeSettings(undefined)).toBe(undefined);
      expect(sanitizeSettings("string")).toBe("string");
      expect(sanitizeSettings(123)).toBe(123);
    });

    it("removes clientSecret from settings", () => {
      const settings = {
        clientSecret: "secret-123",
        otherSetting: "value",
      };

      const sanitized = sanitizeSettings(settings);

      expect(sanitized).not.toHaveProperty("clientSecret");
      expect(sanitized).toHaveProperty("otherSetting", "value");
    });

    it("handles empty objects", () => {
      const sanitized = sanitizeSettings({});
      expect(sanitized).toEqual({});
    });
  });

  describe("sanitizeIntegration", () => {
    it("returns integration without sensitive fields", () => {
      const integration = createBaseIntegration({
        settings: {
          clientSecret: "secret-123",
          apiKey: "key-123",
        },
      });

      const sanitized = sanitizeIntegration(integration);

      expect(sanitized).not.toHaveProperty("apiKey");
      expect(sanitized.settings).not.toHaveProperty("clientSecret");
      expect(sanitized).toHaveProperty("id", integration.id);
      expect(sanitized).toHaveProperty("name", integration.name);
      expect(sanitized).toHaveProperty("type", integration.type);
    });

    it("handles integration with null settings", () => {
      const integration = createBaseIntegration({
        settings: null,
      });

      const sanitized = sanitizeIntegration(integration);

      expect(sanitized.settings).toBe(null);
    });
  });
});
