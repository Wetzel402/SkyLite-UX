import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Nuxt auto-imports
globalThis.defineEventHandler = vi.fn(handler => handler);
globalThis.createError = vi.fn((error) => {
  const err = new Error(error.message);
  err.statusCode = error.statusCode;
  return err;
});
globalThis.getRouterParam = vi.fn((event, param) => event.context?.params?.[param]);

// Mock Nager.Date API
vi.mock("../../../../server/utils/nagerDateApi", () => ({
  getAvailableCountries: vi.fn(),
  getCountryInfo: vi.fn(),
}));

describe("holiday Countries API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("gET /api/settings/holiday-countries", () => {
    it("should return list of available countries", async () => {
      const mockCountries = [
        { countryCode: "CA", name: "Canada" },
        { countryCode: "US", name: "United States" },
        { countryCode: "GB", name: "United Kingdom" },
      ];

      const { getAvailableCountries } = await import("../../../../server/utils/nagerDateApi");
      vi.mocked(getAvailableCountries).mockResolvedValue(mockCountries);

      const event = { context: {} };
      const handler = await import("../../../../server/api/settings/holiday-countries.get");
      const result = await handler.default(event);

      expect(result).toEqual(mockCountries);
      expect(getAvailableCountries).toHaveBeenCalledTimes(1);
    });

    it("should handle API errors gracefully", async () => {
      const { getAvailableCountries } = await import("../../../../server/utils/nagerDateApi");
      vi.mocked(getAvailableCountries).mockRejectedValue(new Error("API failure"));

      const event = { context: {} };
      const handler = await import("../../../../server/api/settings/holiday-countries.get");

      await expect(handler.default(event)).rejects.toThrow();
    });
  });

  describe("gET /api/settings/holiday-countries/:code", () => {
    it("should return country info with subdivisions", async () => {
      const mockInfo = {
        countryCode: "CA",
        name: "Canada",
        region: "Americas",
        borderCountries: [
          { countryCode: "US", name: "United States" },
        ],
      };

      const { getCountryInfo } = await import("../../../../server/utils/nagerDateApi");
      vi.mocked(getCountryInfo).mockResolvedValue(mockInfo);

      const event = {
        context: {
          params: { code: "CA" },
        },
      };
      const handler = await import("../../../../server/api/settings/holiday-countries/[code].get");
      const result = await handler.default(event);

      expect(result).toEqual(mockInfo);
      expect(getCountryInfo).toHaveBeenCalledWith("CA");
    });

    it("should handle missing country code", async () => {
      const event = {
        context: {
          params: {},
        },
      };
      const handler = await import("../../../../server/api/settings/holiday-countries/[code].get");

      await expect(handler.default(event)).rejects.toThrow();
    });

    it("should handle invalid country code", async () => {
      const { getCountryInfo } = await import("../../../../server/utils/nagerDateApi");
      vi.mocked(getCountryInfo).mockRejectedValue(new Error("Invalid country"));

      const event = {
        context: {
          params: { code: "INVALID" },
        },
      };
      const handler = await import("../../../../server/api/settings/holiday-countries/[code].get");

      await expect(handler.default(event)).rejects.toThrow();
    });
  });
});
