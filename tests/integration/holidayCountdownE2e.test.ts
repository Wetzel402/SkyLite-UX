import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Nuxt auto-imports
globalThis.defineEventHandler = vi.fn(handler => handler);
globalThis.readBody = vi.fn();
globalThis.createError = vi.fn((error) => {
  const err = new Error(error.message);
  err.statusCode = error.statusCode;
  return err;
});

// Create shared mock functions
const mockGetHolidayCache = vi.fn();
const mockSaveHolidayCache = vi.fn();
const mockInvalidateHolidayCache = vi.fn();
const mockGetNextUpcomingHoliday = vi.fn();
const mockGetAvailableCountries = vi.fn();
const mockGetCountryInfo = vi.fn();

// Mock all dependencies for controlled testing
vi.mock("../../server/utils/nagerDateApi", () => ({
  getNextUpcomingHoliday: mockGetNextUpcomingHoliday,
  getAvailableCountries: mockGetAvailableCountries,
  getCountryInfo: mockGetCountryInfo,
}));

vi.mock("../../server/utils/holidayCache", () => ({
  getHolidayCache: mockGetHolidayCache,
  saveHolidayCache: mockSaveHolidayCache,
  invalidateHolidayCache: mockInvalidateHolidayCache,
}));

vi.mock("~/server/utils/holidayCache", () => ({
  getHolidayCache: mockGetHolidayCache,
  saveHolidayCache: mockSaveHolidayCache,
  invalidateHolidayCache: mockInvalidateHolidayCache,
}));

// Create shared prisma mock
const mockPrisma = {
  todo: {
    findMany: vi.fn(),
  },
  appSettings: {
    findFirst: vi.fn(),
    upsert: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  holidayCache: {
    findFirst: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
};

// Mock prisma for all import paths
vi.mock("../../lib/prisma", () => ({
  default: mockPrisma,
}));

vi.mock("~/lib/prisma", () => ({
  default: mockPrisma,
}));

vi.mock("../../app/lib/prisma", () => ({
  default: mockPrisma,
}));

describe("holiday Countdown E2E Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("complete Happy Path", () => {
    it("should fetch holiday from API, cache it, and return countdown", async () => {
      // Setup: No user countdowns
      mockPrisma.todo.findMany.mockResolvedValue([]);

      // Setup: Feature enabled
      mockPrisma.appSettings.findFirst.mockResolvedValue({
        id: "1",
        singletonId: 1,
        holidayCountryCode: "CA",
        holidaySubdivisionCode: null,
        enableHolidayCountdowns: true,
        showMealsOnCalendar: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Setup: No cached holiday
      mockGetHolidayCache.mockResolvedValue(null);

      // Setup: API returns holiday
      mockGetNextUpcomingHoliday.mockResolvedValue({
        date: "2026-12-25",
        name: "Christmas Day",
        localName: "Christmas Day",
        countryCode: "CA",
        counties: null,
      });

      // Setup: Cache save succeeds
      mockSaveHolidayCache.mockResolvedValue({
        id: "cached-123",
        countryCode: "CA",
        subdivisionCode: null,
        holidayName: "Christmas Day",
        holidayDate: new Date("2026-12-25"),
        cachedUntil: new Date("2026-12-25"),
        fetchedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Execute: Call countdown endpoint
      const event = { context: {} };
      const handler = await import("../../server/api/todos/countdowns.get");
      const result = await handler.default(event);

      // Verify: Holiday fetched from API
      expect(mockGetNextUpcomingHoliday).toHaveBeenCalledWith("CA", undefined);

      // Verify: Holiday saved to cache
      expect(mockSaveHolidayCache).toHaveBeenCalledWith({
        countryCode: "CA",
        subdivisionCode: null,
        holidayName: "Christmas Day",
        holidayDate: expect.any(Date),
        cachedUntil: expect.any(Date),
      });

      // Verify: Countdown returned with isHoliday flag
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        title: "Christmas Day",
        isHoliday: true,
      });
    });
  });

  describe("cache Hit Path", () => {
    it("should return cached holiday without API call", async () => {
      // Setup: No user countdowns
      mockPrisma.todo.findMany.mockResolvedValue([]);

      // Setup: Feature enabled
      mockPrisma.appSettings.findFirst.mockResolvedValue({
        id: "1",
        singletonId: 1,
        holidayCountryCode: "CA",
        holidaySubdivisionCode: null,
        enableHolidayCountdowns: true,
        showMealsOnCalendar: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Setup: Cached holiday exists
      mockGetHolidayCache.mockResolvedValue({
        id: "cached-123",
        countryCode: "CA",
        subdivisionCode: null,
        holidayName: "Christmas Day",
        holidayDate: new Date("2026-12-25"),
        cachedUntil: new Date("2026-12-25"),
        fetchedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Execute: Call countdown endpoint
      const event = { context: {} };
      const handler = await import("../../server/api/todos/countdowns.get");
      const result = await handler.default(event);

      // Verify: API NOT called (cache hit)
      expect(mockGetNextUpcomingHoliday).not.toHaveBeenCalled();

      // Verify: Cache NOT created (already exists)
      expect(mockSaveHolidayCache).not.toHaveBeenCalled();

      // Verify: Cached holiday returned
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Christmas Day");
      expect(result[0].isHoliday).toBe(true);
    });
  });

  describe("user Countdown Priority", () => {
    it("should return user countdown and skip holiday logic entirely", async () => {
      // Setup: User countdown exists
      mockPrisma.todo.findMany.mockResolvedValue([
        {
          id: "user-todo-1",
          title: "My Birthday",
          description: "Birthday celebration",
          isCountdown: true,
          completed: false,
          priority: "HIGH",
          dueDate: new Date("2026-06-15"),
          order: 0,
          countdownMessage: null,
          messageGeneratedAt: null,
          todoColumnId: "col1",
          createdAt: new Date(),
          updatedAt: new Date(),
          todoColumn: {
            id: "col1",
            name: "Personal",
            user: {
              id: "user1",
              name: "John Doe",
              avatar: null,
            },
          },
        },
      ]);

      // Execute: Call countdown endpoint
      const event = { context: {} };
      const handler = await import("../../server/api/todos/countdowns.get");
      const result = await handler.default(event);

      // Verify: App settings NOT checked
      expect(mockPrisma.appSettings.findFirst).not.toHaveBeenCalled();

      // Verify: Holiday cache NOT checked
      expect(mockGetHolidayCache).not.toHaveBeenCalled();

      // Verify: API NOT called
      expect(mockGetNextUpcomingHoliday).not.toHaveBeenCalled();

      // Verify: User countdown returned
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("My Birthday");
      expect(result[0].isHoliday).toBeUndefined();
    });
  });

  describe("settings Change Flow", () => {
    it("should invalidate cache when country changes", async () => {
      // Setup: Current settings
      mockPrisma.appSettings.findFirst.mockResolvedValue({
        id: "1",
        singletonId: 1,
        holidayCountryCode: "CA",
        holidaySubdivisionCode: null,
        enableHolidayCountdowns: true,
        showMealsOnCalendar: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Setup: Settings update succeeds
      mockPrisma.appSettings.update.mockResolvedValue({
        id: "1",
        singletonId: 1,
        holidayCountryCode: "US",
        holidaySubdivisionCode: null,
        enableHolidayCountdowns: true,
        showMealsOnCalendar: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Execute: Update country
      const event = {
        context: {},
      };

      vi.mocked(globalThis.readBody).mockResolvedValue({
        holidayCountryCode: "US",
      });

      const handler = await import("../../server/api/app-settings/index.put");
      await handler.default(event);

      // Verify: Cache invalidated for old country
      expect(mockInvalidateHolidayCache).toHaveBeenCalledWith("CA", undefined);

      // Verify: Settings updated
      expect(mockPrisma.appSettings.update).toHaveBeenCalledWith({
        where: { id: "1" },
        data: expect.objectContaining({
          holidayCountryCode: "US",
        }),
      });
    });

    it("should invalidate cache when subdivision changes", async () => {
      // Setup: Current settings with subdivision
      mockPrisma.appSettings.findFirst.mockResolvedValue({
        id: "1",
        singletonId: 1,
        holidayCountryCode: "US",
        holidaySubdivisionCode: "CA",
        enableHolidayCountdowns: true,
        showMealsOnCalendar: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Setup: Settings update succeeds
      mockPrisma.appSettings.update.mockResolvedValue({
        id: "1",
        singletonId: 1,
        holidayCountryCode: "US",
        holidaySubdivisionCode: "NY",
        enableHolidayCountdowns: true,
        showMealsOnCalendar: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Execute: Update subdivision
      const event = {
        context: {},
      };

      vi.mocked(globalThis.readBody).mockResolvedValue({
        holidaySubdivisionCode: "NY",
      });

      const handler = await import("../../server/api/app-settings/index.put");
      await handler.default(event);

      // Verify: Cache invalidated for old subdivision
      expect(mockInvalidateHolidayCache).toHaveBeenCalledWith("US", "CA");

      // Verify: Settings updated
      expect(mockPrisma.appSettings.update).toHaveBeenCalledWith({
        where: { id: "1" },
        data: expect.objectContaining({
          holidaySubdivisionCode: "NY",
        }),
      });
    });

    it("should not invalidate cache when other settings change", async () => {
      // Setup: Current settings
      mockPrisma.appSettings.findFirst.mockResolvedValue({
        id: "1",
        singletonId: 1,
        holidayCountryCode: "CA",
        holidaySubdivisionCode: null,
        enableHolidayCountdowns: true,
        showMealsOnCalendar: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Setup: Settings update (only non-holiday setting changed)
      mockPrisma.appSettings.update.mockResolvedValue({
        id: "1",
        singletonId: 1,
        holidayCountryCode: "CA",
        holidaySubdivisionCode: null,
        enableHolidayCountdowns: false,
        showMealsOnCalendar: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Execute: Update other settings
      const event = {
        context: {},
      };

      vi.mocked(globalThis.readBody).mockResolvedValue({
        showMealsOnCalendar: true,
        enableHolidayCountdowns: false,
      });

      const handler = await import("../../server/api/app-settings/index.put");
      await handler.default(event);

      // Verify: Cache NOT invalidated (country/subdivision unchanged)
      expect(mockInvalidateHolidayCache).not.toHaveBeenCalled();
    });
  });

  describe("feature Disabled", () => {
    it("should return empty array when feature disabled", async () => {
      // Setup: No user countdowns
      mockPrisma.todo.findMany.mockResolvedValue([]);

      // Setup: Feature DISABLED
      mockPrisma.appSettings.findFirst.mockResolvedValue({
        id: "1",
        singletonId: 1,
        holidayCountryCode: "CA",
        holidaySubdivisionCode: null,
        enableHolidayCountdowns: false,
        showMealsOnCalendar: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Execute: Call countdown endpoint
      const event = { context: {} };
      const handler = await import("../../server/api/todos/countdowns.get");
      const result = await handler.default(event);

      // Verify: Holiday logic skipped
      expect(mockGetHolidayCache).not.toHaveBeenCalled();
      expect(mockGetNextUpcomingHoliday).not.toHaveBeenCalled();

      // Verify: Empty array returned
      expect(result).toEqual([]);
    });

    it("should return empty array when no app settings exist", async () => {
      // Setup: No user countdowns
      mockPrisma.todo.findMany.mockResolvedValue([]);

      // Setup: No app settings at all
      mockPrisma.appSettings.findFirst.mockResolvedValue(null);

      // Execute: Call countdown endpoint
      const event = { context: {} };
      const handler = await import("../../server/api/todos/countdowns.get");
      const result = await handler.default(event);

      // Verify: Holiday logic skipped
      expect(mockGetHolidayCache).not.toHaveBeenCalled();
      expect(mockGetNextUpcomingHoliday).not.toHaveBeenCalled();

      // Verify: Empty array returned
      expect(result).toEqual([]);
    });
  });

  describe("complete Flow Integration", () => {
    it("should handle full user journey: enable feature → fetch holiday → cache → retrieve", async () => {
      // Step 1: User enables holiday countdowns
      mockPrisma.appSettings.findFirst.mockResolvedValue({
        id: "1",
        singletonId: 1,
        holidayCountryCode: null,
        holidaySubdivisionCode: null,
        enableHolidayCountdowns: false,
        showMealsOnCalendar: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockPrisma.appSettings.update.mockResolvedValue({
        id: "1",
        singletonId: 1,
        holidayCountryCode: "CA",
        holidaySubdivisionCode: null,
        enableHolidayCountdowns: true,
        showMealsOnCalendar: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const settingsEvent = {
        context: {},
      };

      vi.mocked(globalThis.readBody).mockResolvedValue({
        holidayCountryCode: "CA",
        enableHolidayCountdowns: true,
      });

      const settingsHandler = await import("../../server/api/app-settings/index.put");
      const updatedSettings = await settingsHandler.default(settingsEvent);

      expect(updatedSettings.enableHolidayCountdowns).toBe(true);
      expect(updatedSettings.holidayCountryCode).toBe("CA");

      // Step 2: User visits home page - countdown fetched
      mockPrisma.todo.findMany.mockResolvedValue([]);
      mockPrisma.appSettings.findFirst.mockResolvedValue(updatedSettings);
      mockGetHolidayCache.mockResolvedValue(null);
      mockGetNextUpcomingHoliday.mockResolvedValue({
        date: "2026-12-25",
        name: "Christmas Day",
        localName: "Christmas Day",
        countryCode: "CA",
        counties: null,
      });

      mockSaveHolidayCache.mockResolvedValue({
        id: "cached-123",
        countryCode: "CA",
        subdivisionCode: null,
        holidayName: "Christmas Day",
        holidayDate: new Date("2026-12-25"),
        cachedUntil: new Date("2026-12-25"),
        fetchedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const countdownEvent = { context: {} };
      const countdownHandler = await import("../../server/api/todos/countdowns.get");
      const firstResult = await countdownHandler.default(countdownEvent);

      // Verify first fetch from API and cache save
      expect(mockGetNextUpcomingHoliday).toHaveBeenCalledWith("CA", undefined);
      expect(mockSaveHolidayCache).toHaveBeenCalled();
      expect(firstResult).toHaveLength(1);
      expect(firstResult[0].title).toBe("Christmas Day");
      expect(firstResult[0].isHoliday).toBe(true);

      // Step 3: User refreshes page - should use cache
      vi.clearAllMocks();
      mockPrisma.todo.findMany.mockResolvedValue([]);
      mockPrisma.appSettings.findFirst.mockResolvedValue(updatedSettings);
      mockGetHolidayCache.mockResolvedValue({
        id: "cached-123",
        countryCode: "CA",
        subdivisionCode: null,
        holidayName: "Christmas Day",
        holidayDate: new Date("2026-12-25"),
        cachedUntil: new Date("2026-12-25"),
        fetchedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const refreshEvent = { context: {} };
      const secondResult = await countdownHandler.default(refreshEvent);

      // Verify second fetch uses cache
      expect(mockGetNextUpcomingHoliday).not.toHaveBeenCalled();
      expect(mockSaveHolidayCache).not.toHaveBeenCalled();
      expect(secondResult).toHaveLength(1);
      expect(secondResult[0].title).toBe("Christmas Day");
    });
  });

  describe("error Handling", () => {
    it("should handle API failure gracefully", async () => {
      // Setup: No user countdowns
      mockPrisma.todo.findMany.mockResolvedValue([]);

      // Setup: Feature enabled
      mockPrisma.appSettings.findFirst.mockResolvedValue({
        id: "1",
        singletonId: 1,
        holidayCountryCode: "CA",
        holidaySubdivisionCode: null,
        enableHolidayCountdowns: true,
        showMealsOnCalendar: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Setup: No cache
      mockGetHolidayCache.mockResolvedValue(null);

      // Setup: API returns no holidays
      mockGetNextUpcomingHoliday.mockResolvedValue(null);

      // Execute: Call countdown endpoint
      const event = { context: {} };
      const handler = await import("../../server/api/todos/countdowns.get");
      const result = await handler.default(event);

      // Verify: Empty array returned on API failure
      expect(result).toEqual([]);
    });

    it("should skip holiday logic when user creates their own countdown", async () => {
      // Step 1: Initially no countdowns, holiday is shown
      mockPrisma.todo.findMany.mockResolvedValue([]);
      mockPrisma.appSettings.findFirst.mockResolvedValue({
        id: "1",
        singletonId: 1,
        holidayCountryCode: "CA",
        holidaySubdivisionCode: null,
        enableHolidayCountdowns: true,
        showMealsOnCalendar: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockGetHolidayCache.mockResolvedValue({
        id: "cached-123",
        countryCode: "CA",
        subdivisionCode: null,
        holidayName: "Christmas Day",
        holidayDate: new Date("2026-12-25"),
        cachedUntil: new Date("2026-12-25"),
        fetchedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const event1 = { context: {} };
      const handler = await import("../../server/api/todos/countdowns.get");
      const result1 = await handler.default(event1);

      expect(result1).toHaveLength(1);
      expect(result1[0].isHoliday).toBe(true);

      // Step 2: User creates their own countdown
      vi.clearAllMocks();
      mockPrisma.todo.findMany.mockResolvedValue([
        {
          id: "user-countdown",
          title: "Vacation",
          description: "Summer vacation",
          isCountdown: true,
          completed: false,
          priority: "HIGH",
          dueDate: new Date("2026-08-01"),
          order: 0,
          countdownMessage: null,
          messageGeneratedAt: null,
          todoColumnId: "col1",
          createdAt: new Date(),
          updatedAt: new Date(),
          todoColumn: {
            id: "col1",
            name: "Personal",
            user: {
              id: "user1",
              name: "John Doe",
              avatar: null,
            },
          },
        },
      ]);

      const event2 = { context: {} };
      const result2 = await handler.default(event2);

      // Verify: User countdown takes priority, holiday logic skipped
      expect(result2).toHaveLength(1);
      expect(result2[0].title).toBe("Vacation");
      expect(result2[0].isHoliday).toBeUndefined();
      expect(mockPrisma.appSettings.findFirst).not.toHaveBeenCalled();
      expect(mockGetHolidayCache).not.toHaveBeenCalled();
    });
  });
});
