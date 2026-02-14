import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Nuxt auto-imports
globalThis.defineEventHandler = vi.fn(handler => handler);
globalThis.createError = vi.fn((error) => {
  const err = new Error(error.message);
  err.statusCode = error.statusCode;
  return err;
});

// Mock the utility modules
vi.mock("../../../../server/utils/holidayCache", () => ({
  getHolidayCache: vi.fn(),
  saveHolidayCache: vi.fn(),
}));

vi.mock("../../../../server/utils/nagerDateApi", () => ({
  getNextUpcomingHoliday: vi.fn(),
}));

vi.mock("../../../../app/lib/prisma", () => ({
  default: {
    todo: {
      findMany: vi.fn(),
    },
    appSettings: {
      findFirst: vi.fn(),
    },
  },
}));

describe("GET /api/todos/countdowns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("user countdowns exist", () => {
    it("should return user countdowns and skip holiday logic", async () => {
      const mockTodo = {
        id: "123",
        title: "Birthday Party",
        description: "Celebrate!",
        completed: false,
        priority: "MEDIUM",
        dueDate: new Date("2026-07-01"),
        order: 0,
        isCountdown: true,
        countdownMessage: null,
        messageGeneratedAt: null,
        todoColumnId: "col1",
        createdAt: new Date(),
        updatedAt: new Date(),
        todoColumn: {
          id: "col1",
          name: "My Column",
          user: {
            id: "user1",
            name: "John Doe",
            avatar: null,
          },
        },
      };

      const prisma = (await import("../../../../app/lib/prisma")).default;
      vi.mocked(prisma.todo.findMany).mockResolvedValue([mockTodo]);

      // Holiday functions should not be called
      const { getHolidayCache } = await import("../../../../server/utils/holidayCache");
      const { getNextUpcomingHoliday } = await import("../../../../server/utils/nagerDateApi");

      const event = { context: {} };
      const handler = await import("../../../../server/api/todos/countdowns.get");
      const result = await handler.default(event);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockTodo.id);
      expect(getHolidayCache).not.toHaveBeenCalled();
      expect(getNextUpcomingHoliday).not.toHaveBeenCalled();
    });
  });

  describe("no user countdowns - Holiday fallback", () => {
    it("should return cached holiday when available", async () => {
      const prisma = (await import("../../../../app/lib/prisma")).default;
      vi.mocked(prisma.todo.findMany).mockResolvedValue([]);
      vi.mocked(prisma.appSettings.findFirst).mockResolvedValue({
        id: "1",
        singletonId: 1,
        showMealsOnCalendar: false,
        holidayCountryCode: "CA",
        holidaySubdivisionCode: "ON",
        enableHolidayCountdowns: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { getHolidayCache } = await import("../../../../server/utils/holidayCache");
      vi.mocked(getHolidayCache).mockResolvedValue({
        id: "123",
        countryCode: "CA",
        subdivisionCode: "ON",
        holidayName: "Canada Day",
        holidayDate: new Date("2026-07-01"),
        cachedUntil: new Date("2026-07-01"),
        fetchedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const event = { context: {} };
      const handler = await import("../../../../server/api/todos/countdowns.get");
      const result = await handler.default(event);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Canada Day");
      expect(result[0].dueDate).toEqual(new Date("2026-07-01"));
      expect(result[0].isHoliday).toBe(true);
    });

    it("should fetch and cache holiday when cache invalid", async () => {
      const prisma = (await import("../../../../app/lib/prisma")).default;
      vi.mocked(prisma.todo.findMany).mockResolvedValue([]);
      vi.mocked(prisma.appSettings.findFirst).mockResolvedValue({
        id: "1",
        singletonId: 1,
        showMealsOnCalendar: false,
        holidayCountryCode: "CA",
        holidaySubdivisionCode: null,
        enableHolidayCountdowns: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { getHolidayCache, saveHolidayCache } = await import("../../../../server/utils/holidayCache");
      const { getNextUpcomingHoliday } = await import("../../../../server/utils/nagerDateApi");

      vi.mocked(getHolidayCache).mockResolvedValue(null);
      vi.mocked(getNextUpcomingHoliday).mockResolvedValue({
        date: "2026-12-25",
        name: "Christmas Day",
        localName: "Christmas Day",
        countryCode: "CA",
        counties: null,
      });
      vi.mocked(saveHolidayCache).mockResolvedValue({
        id: "cache-1",
        countryCode: "CA",
        subdivisionCode: null,
        holidayName: "Christmas Day",
        holidayDate: new Date("2026-12-25"),
        cachedUntil: new Date("2026-12-26"),
        createdAt: new Date(),
      });

      const event = { context: {} };
      const handler = await import("../../../../server/api/todos/countdowns.get");
      const result = await handler.default(event);

      expect(getNextUpcomingHoliday).toHaveBeenCalledWith("CA", undefined);
      expect(saveHolidayCache).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("Christmas Day");
      expect(result[0].isHoliday).toBe(true);
    });

    it("should return empty array when holiday countdowns disabled", async () => {
      const prisma = (await import("../../../../app/lib/prisma")).default;
      vi.mocked(prisma.todo.findMany).mockResolvedValue([]);
      vi.mocked(prisma.appSettings.findFirst).mockResolvedValue({
        id: "1",
        singletonId: 1,
        showMealsOnCalendar: false,
        holidayCountryCode: "CA",
        holidaySubdivisionCode: null,
        enableHolidayCountdowns: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const event = { context: {} };
      const handler = await import("../../../../server/api/todos/countdowns.get");
      const result = await handler.default(event);

      expect(result).toEqual([]);
    });

    it("should return empty array when no holidays found", async () => {
      const prisma = (await import("../../../../app/lib/prisma")).default;
      vi.mocked(prisma.todo.findMany).mockResolvedValue([]);
      vi.mocked(prisma.appSettings.findFirst).mockResolvedValue({
        id: "1",
        singletonId: 1,
        showMealsOnCalendar: false,
        holidayCountryCode: "CA",
        holidaySubdivisionCode: null,
        enableHolidayCountdowns: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { getHolidayCache } = await import("../../../../server/utils/holidayCache");
      const { getNextUpcomingHoliday } = await import("../../../../server/utils/nagerDateApi");

      vi.mocked(getHolidayCache).mockResolvedValue(null);
      vi.mocked(getNextUpcomingHoliday).mockResolvedValue(null);

      const event = { context: {} };
      const handler = await import("../../../../server/api/todos/countdowns.get");
      const result = await handler.default(event);

      expect(result).toEqual([]);
    });
  });
});
