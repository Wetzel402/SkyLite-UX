import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { calculateNextDueDate } from "server/utils/recurrence";
import { RecurrencePattern } from "app/types/database";

describe("calculateNextDueDate", () => {
  beforeEach(() => {
    const mockDate = new Date("2025-01-15T00:00:00");
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Input validation", () => {
    it("should throw error for zero interval", () => {
      const pattern: RecurrencePattern = { type: "daily", interval: 0 };
      const previousDueDate = new Date("2025-01-14T00:00:00");

      expect(() => calculateNextDueDate(pattern, previousDueDate)).toThrow(
        "intervalDays must be positive",
      );
    });

    it("should throw error for negative interval", () => {
      const pattern: RecurrencePattern = { type: "daily", interval: -1 };
      const previousDueDate = new Date("2025-01-14T00:00:00");

      expect(() => calculateNextDueDate(pattern, previousDueDate)).toThrow(
        "intervalDays must be positive",
      );
    });
  });

  describe("Early completion with custom reference date", () => {
    it("should advance daily when completed before due date", () => {
      // Complete a daily todo on Jan 14 that's due Jan 16
      const pattern: RecurrencePattern = { type: "daily", interval: 1 };
      const previousDueDate = new Date("2025-01-16T23:59:59.999");
      const referenceDate = new Date("2025-01-14T00:00:00");

      const result = calculateNextDueDate(
        pattern,
        previousDueDate,
        referenceDate,
      );

      expect(result.toISOString().split("T")[0]).toBe("2025-01-17");
    });

    it("should advance weekly when completed before due date", () => {
      // Complete a weekly Friday todo on Sunday (Jan 12) that's due Friday (Jan 17)
      const pattern: RecurrencePattern = {
        type: "weekly",
        interval: 1,
        daysOfWeek: [5],
      };
      const previousDueDate = new Date("2025-01-17T23:59:59.999"); // Friday
      const referenceDate = new Date("2025-01-12T00:00:00"); // Sunday

      const result = calculateNextDueDate(
        pattern,
        previousDueDate,
        referenceDate,
      );

      // Should get Jan 24 (next Friday after Jan 17)
      expect(result.getDate()).toBe(24);
      expect(result.getMonth()).toBe(0); // January
      expect(result.getFullYear()).toBe(2025);
    });

    it("should handle daily interval > 1 with early completion", () => {
      // Complete a 3-day interval todo on Jan 14 that's due Jan 18
      const pattern: RecurrencePattern = { type: "daily", interval: 3 };
      const previousDueDate = new Date("2025-01-18T23:59:59.999");
      const referenceDate = new Date("2025-01-14T00:00:00");

      const result = calculateNextDueDate(
        pattern,
        previousDueDate,
        referenceDate,
      );

      expect(result.toISOString().split("T")[0]).toBe("2025-01-21");
    });
  });

  describe("Daily recurrence", () => {
    it.each([
      { interval: 1, prevDate: null, expected: "2025-01-16" }, // uses the current date if prevDate is null
      { interval: 1, prevDate: "2025-01-14", expected: "2025-01-16" }, // skip the current day even if it falls in the interval
      { interval: 2, prevDate: "2025-01-13", expected: "2025-01-17" },
      { interval: 3, prevDate: "2025-01-10", expected: "2025-01-16" },
      { interval: 5, prevDate: "2025-01-10", expected: "2025-01-20" },
      { interval: 7, prevDate: "2025-01-08", expected: "2025-01-22" },
      { interval: 100, prevDate: "2025-01-08", expected: "2025-04-18" },
    ])(
      "should calculate next day for daily interval of $interval for previous due date $prevDate",
      ({ interval, prevDate, expected }) => {
        const pattern: RecurrencePattern = { type: "daily", interval };
        const previousDueDate =
          prevDate != null ? new Date(`${prevDate}T00:00:00`) : null;

        const result = calculateNextDueDate(pattern, previousDueDate);

        expect(result.toISOString().split("T")[0]).toBe(expected);
      },
    );
  });

  describe("Weekly recurrence", () => {
    it.each([
      {
        interval: 1,
        daysOfWeek: [3], // Wednesday
        prevDate: "2025-01-15", // Jan 15 is Wednesday
        expected: "2025-01-22",
        description: "same day next week",
      },
      {
        interval: 1,
        daysOfWeek: [5], // Friday
        prevDate: null, // Defaults to "today"
        expected: "2025-01-17",
        description: "future day this week",
      },
      {
        interval: 1,
        daysOfWeek: [5], // Friday
        prevDate: "2025-01-16",
        expected: "2025-01-17",
        description: "future day this week",
      },
      {
        interval: 1,
        daysOfWeek: [1, 3, 5], // Mon, Wed, Fri
        prevDate: "2025-01-13", // Monday
        expected: "2025-01-15", // Next Friday
        description: "multiple days - next in sequence",
      },
      {
        interval: 2,
        daysOfWeek: [1], // Monday
        prevDate: "2025-01-06", // Monday
        expected: "2025-01-20", // Skip one week, next Monday
        description: "bi-weekly",
      },
      {
        interval: 1,
        daysOfWeek: [0], // Sunday
        prevDate: "2025-01-12", // Sunday
        expected: "2025-01-19", // Next Sunday
        description: "Sunday as day 0",
      },
      {
        interval: 1,
        daysOfWeek: [],
        prevDate: "2025-01-10",
        expected: "2025-01-17", // +7 days
        description: "no days specified (7-day interval)",
      },
      // Multi-week patterns with interval >= 3
      {
        interval: 3,
        daysOfWeek: [1], // Monday
        prevDate: "2024-01-01", // Monday, Jan 1, 2024
        refDate: "2024-01-02",
        expected: "2024-01-22",
        description: "3-week interval single day",
      },
      {
        interval: 4,
        daysOfWeek: [5], // Friday
        prevDate: "2024-01-05", // Friday
        refDate: "2024-01-06",
        expected: "2024-02-02",
        description: "4-week interval on Friday",
      },
      {
        interval: 3,
        daysOfWeek: [1], // Mon
        prevDate: "2024-01-01", // Monday
        refDate: "2024-01-02",
        expected: "2024-01-22",
        description: "3-week interval starting Monday",
      },
      {
        interval: 3,
        daysOfWeek: [1, 3, 5],
        prevDate: "2024-01-05", // Friday
        refDate: "2024-01-05",
        expected: "2024-01-22",
        description: "3-week interval complete on last selected day",
      },
      {
        interval: 2,
        daysOfWeek: [1, 3, 5],
        prevDate: "2024-01-01", // Monday
        refDate: "2024-01-14", // Sunday
        expected: "2024-01-15",
        description: "reference before selected days (Sunday)",
      },
      {
        interval: 3,
        daysOfWeek: [3, 5], // Wed, Fri
        prevDate: "2024-01-01", // Monday
        refDate: "2024-01-02",
        expected: "2024-01-03",
        description: "start before first selected day",
      },
      {
        interval: 2,
        daysOfWeek: [1, 3], // Mon, Wed
        prevDate: "2024-01-05", // Friday
        refDate: "2024-01-05",
        expected: "2024-01-15",
        description: "reference after all selected days",
      },
      {
        interval: 3,
        daysOfWeek: [1],
        prevDate: "2024-01-01", // Monday
        refDate: "2024-01-20", // Saturday
        expected: "2024-01-22",
        description: "Saturday reference with Monday selection",
      },
      // Month boundary crossing
      {
        interval: 3,
        daysOfWeek: [1, 5],
        prevDate: "2024-01-22", // Monday
        refDate: "2024-01-27",
        expected: "2024-02-12",
        description: "January to February crossing",
      },
      {
        interval: 4,
        daysOfWeek: [3],
        prevDate: "2024-02-07", // Wednesday
        refDate: "2024-02-08",
        expected: "2024-03-06",
        description: "February to March leap year",
      },
      {
        interval: 3,
        daysOfWeek: [2, 4],
        prevDate: "2024-11-26", // Tuesday
        refDate: "2024-11-29",
        expected: "2024-12-17",
        description: "November to December crossing",
      },
      // Year boundary crossing
      {
        interval: 3,
        daysOfWeek: [1, 3],
        prevDate: "2023-12-18", // Monday
        refDate: "2023-12-22",
        expected: "2024-01-08",
        description: "December to January year crossing",
      },
      {
        interval: 4,
        daysOfWeek: [5],
        prevDate: "2023-12-22", // Friday
        refDate: "2023-12-23",
        expected: "2024-01-19",
        description: "year boundary with late week start",
      },
      // Sunday crossing and elapsedWeeks
      {
        interval: 2,
        daysOfWeek: [1],
        prevDate: "2024-01-06", // Saturday
        refDate: "2024-01-06",
        expected: "2024-01-15",
        description: "elapsedWeeks increment on Sunday crossing",
      },
      {
        interval: 5,
        daysOfWeek: [2],
        prevDate: "2024-01-02", // Tuesday
        refDate: "2024-01-03",
        expected: "2024-02-06",
        description: "multiple Sunday crossings for large interval",
      },
      {
        interval: 3,
        daysOfWeek: [1, 3],
        prevDate: "2024-01-04", // Thursday (after last selected day)
        refDate: "2024-01-04",
        expected: "2024-01-22",
        description: "weeks complete before selecting days after last",
      },
      // Edge cases
      {
        interval: 2,
        daysOfWeek: [3],
        prevDate: "2024-01-03", // Wednesday
        refDate: "2024-01-03",
        expected: "2024-01-17",
        description: "no same day when prev equals reference",
      },
      {
        interval: 3,
        daysOfWeek: [3],
        prevDate: "2024-01-03",
        refDate: "2024-01-03",
        expected: "2024-01-24",
        description:
          "advance full interval when there are no more matching days in the current week",
      },
      {
        interval: 2,
        daysOfWeek: [1],
        prevDate: "2024-01-07", // Sunday
        refDate: "2024-01-07",
        expected: "2024-01-08",
        description: "Sunday with Monday next day",
      },
      {
        interval: 2,
        daysOfWeek: [5, 1, 3], // Unsorted
        prevDate: "2024-01-01", // Monday
        refDate: "2024-01-01",
        expected: "2024-01-03",
        description: "unsorted daysOfWeek respects sorting",
      },
    ])(
      "should calculate $description (interval=$interval, days=$daysOfWeek)",
      ({ interval, daysOfWeek, prevDate, refDate, expected }) => {
        const pattern: RecurrencePattern = {
          type: "weekly",
          interval,
          daysOfWeek,
        };
        const previousDueDate =
          prevDate != null ? new Date(`${prevDate}T00:00:00`) : null;
        const referenceDate = refDate
          ? new Date(`${refDate}T00:00:00`)
          : undefined;

        const result = calculateNextDueDate(
          pattern,
          previousDueDate,
          referenceDate,
        );

        expect(result.toISOString().split("T")[0]).toBe(expected);
      },
    );
  });

  describe("Monthly recurrence", () => {
    it.each([
      {
        interval: 2,
        dayOfMonth: 10,
        prevDate: "2024-11-10",
        expected: "2025-03-10",
        description: "bi-monthly recurrence",
      },
      {
        interval: 1,
        dayOfMonth: 31,
        prevDate: "2025-01-31",
        expected: "2025-02-28",
        description: "day 31 in February (caps at 28)",
      },
      {
        interval: 1,
        dayOfMonth: 29,
        prevDate: "2025-01-29",
        expected: "2025-02-28",
        description: "day 29 in non-leap year February",
      },
      {
        interval: 1,
        dayOfMonth: 20,
        prevDate: null,
        expected: "2025-02-20",
        description: "from today if no previous due date",
      },
      {
        interval: 1,
        dayOfMonth: 20,
        prevDate: "2025-02-20",
        refDate: "2025-01-15",
        expected: "2025-03-20",
        description: "completed early",
      },
      {
        interval: 1,
        dayOfMonth: 20,
        prevDate: "2025-01-20",
        refDate: "2025-02-19",
        expected: "2025-02-20",
        description: "completed late - different day of month",
      },
      {
        interval: 1,
        dayOfMonth: 20,
        prevDate: "2025-01-20",
        refDate: "2025-02-20",
        expected: "2025-02-20",
        description: "completed late - same day of month",
      },
    ])(
      "should handle $description (interval=$interval, day=$dayOfMonth)",
      ({ interval, dayOfMonth, prevDate, refDate, expected }) => {
        const pattern: RecurrencePattern = {
          type: "monthly",
          interval,
          dayOfMonth,
        };
        const previousDueDate = prevDate
          ? new Date(`${prevDate}T00:00:00`)
          : null;
        const referenceDate = refDate
          ? new Date(`${refDate}T00:00:00`)
          : undefined;

        const result = calculateNextDueDate(
          pattern,
          previousDueDate,
          referenceDate,
        );

        expect(result.toISOString().split("T")[0]).toBe(expected);
      },
    );
  });
});
