import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAvailableCountries, getCountryInfo, getNextUpcomingHoliday, getPublicHolidays } from "../../../../server/utils/nagerDateApi";

// Mock global fetch
globalThis.fetch = vi.fn();

describe("nagerDateApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getPublicHolidays", () => {
    it("should fetch holidays for year and country", async () => {
      const mockHolidays = [
        {
          date: "2026-07-01",
          localName: "Canada Day",
          name: "Canada Day",
          countryCode: "CA",
          counties: null,
        },
        {
          date: "2026-12-25",
          localName: "Christmas Day",
          name: "Christmas Day",
          countryCode: "CA",
          counties: ["CA-ON", "CA-BC"],
        },
      ];

      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockHolidays,
      } as Response);

      const result = await getPublicHolidays(2026, "CA");

      expect(result).toEqual(mockHolidays);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://date.nager.at/api/v3/PublicHolidays/2026/CA",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it("should throw error if API fails", async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      await expect(getPublicHolidays(2026, "INVALID")).rejects.toThrow();
    });
  });

  describe("getAvailableCountries", () => {
    it("should fetch list of countries", async () => {
      const mockCountries = [
        { countryCode: "CA", name: "Canada" },
        { countryCode: "US", name: "United States" },
      ];

      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockCountries,
      } as Response);

      const result = await getAvailableCountries();

      expect(result).toEqual(mockCountries);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://date.nager.at/api/v3/AvailableCountries",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
  });

  describe("getCountryInfo", () => {
    it("should fetch country info with subdivisions", async () => {
      const mockInfo = {
        countryCode: "CA",
        name: "Canada",
        region: "Americas",
        borderCountries: [
          { countryCode: "US", name: "United States" },
        ],
      };

      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockInfo,
      } as Response);

      const result = await getCountryInfo("CA");

      expect(result).toEqual(mockInfo);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://date.nager.at/api/v3/CountryInfo/CA",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
  });

  describe("getNextUpcomingHoliday", () => {
    it("should return next holiday after today", async () => {
      const mockHolidays = [
        {
          date: "2026-01-01",
          localName: "New Year",
          name: "New Year's Day",
          countryCode: "CA",
          counties: null,
        },
        {
          date: "2026-07-01",
          localName: "Canada Day",
          name: "Canada Day",
          countryCode: "CA",
          counties: null,
        },
        {
          date: "2026-12-25",
          localName: "Christmas",
          name: "Christmas Day",
          countryCode: "CA",
          counties: null,
        },
      ];

      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockHolidays,
      } as Response);

      // Mock current date as Feb 14, 2026
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-02-14"));

      const result = await getNextUpcomingHoliday("CA", undefined);

      expect(result).toEqual({
        date: "2026-07-01",
        localName: "Canada Day",
        name: "Canada Day",
        countryCode: "CA",
        counties: null,
      });

      vi.useRealTimers();
    });

    it("should filter by subdivision if provided", async () => {
      const mockHolidays = [
        {
          date: "2026-07-01",
          localName: "Canada Day",
          name: "Canada Day",
          countryCode: "CA",
          counties: ["CA-ON", "CA-BC"],
        },
        {
          date: "2026-08-01",
          localName: "Civic Holiday",
          name: "Civic Holiday",
          countryCode: "CA",
          counties: ["CA-ON"],
        },
        {
          date: "2026-09-01",
          localName: "BC Day",
          name: "BC Day",
          countryCode: "CA",
          counties: ["CA-BC"],
        },
      ];

      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockHolidays,
      } as Response);

      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-02-14"));

      const result = await getNextUpcomingHoliday("CA", "ON");

      // Should return first ON-specific or national holiday
      expect(result?.name).toBe("Canada Day");

      vi.useRealTimers();
    });

    it("should not return a past holiday due to timezone parsing", async () => {
      const mockHolidays = [
        {
          date: "2026-02-16",
          localName: "Test Holiday",
          name: "Test Holiday",
          countryCode: "US",
          counties: null,
        },
        {
          date: "2026-07-04",
          localName: "Independence Day",
          name: "Independence Day",
          countryCode: "US",
          counties: null,
        },
      ];

      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockHolidays,
      } as Response);

      // Set time to Feb 17 — the Feb 16 holiday is in the past
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 1, 17, 10, 0, 0)); // Feb 17, 10 AM local

      const result = await getNextUpcomingHoliday("US", undefined);

      // Should skip the past holiday and return Independence Day
      expect(result?.name).toBe("Independence Day");

      vi.useRealTimers();
    });

    it("should return null if no upcoming holidays", async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        json: async () => [],
      } as Response);

      const result = await getNextUpcomingHoliday("CA", undefined);

      expect(result).toBeNull();
    });
  });
});
