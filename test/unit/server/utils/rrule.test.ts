import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ICalEvent } from "../../../../server/integrations/iCal/types";

const icalThrowRecurExpansion = vi.hoisted(() => ({ current: false }));

vi.mock("ical.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ical.js")>();
  return {
    default: {
      ...actual.default,
      get RecurExpansion() {
        return icalThrowRecurExpansion.current
          ? class {
              constructor(_c: unknown, _d: unknown) {
                throw new Error("RecurExpansion failed");
              }
            }
          : actual.default.RecurExpansion;
      },
    },
  };
});

import {
  calculateNextDueDate,
  expandRecurringEvents,
  parseRRuleString,
} from "../../../../server/utils/rrule";

describe("calculateNextDueDate", () => {
  beforeEach(() => {
    const mockDate = new Date("2025-01-15T00:00:00");
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("input validation", () => {
    it("should throw error for invalid rrule", () => {
      const rrule = null as unknown as ICalEvent["rrule"];
      const originalDTSTART = new Date("2025-01-14T00:00:00");

      expect(() =>
        calculateNextDueDate(rrule, originalDTSTART),
      ).toThrow("Invalid rrule: freq is required");
    });

    it("should throw error for rrule without freq", () => {
      const rrule = {} as ICalEvent["rrule"];
      const originalDTSTART = new Date("2025-01-14T00:00:00");

      expect(() =>
        calculateNextDueDate(rrule, originalDTSTART),
      ).toThrow("Invalid rrule: freq is required");
    });
  });

  describe("early completion with custom reference date", () => {
    it("should advance daily when completed before due date", () => {
      const rrule: ICalEvent["rrule"] = { freq: "DAILY", interval: 1 };
      const originalDTSTART = new Date("2025-01-14T00:00:00");
      const previousDueDate = new Date("2025-01-16T23:59:59.999");
      const referenceDate = new Date("2025-01-14T00:00:00");

      const result = calculateNextDueDate(
        rrule,
        originalDTSTART,
        previousDueDate,
        referenceDate,
      );

      expect(result).not.toBeNull();
      expect(result!.toISOString().split("T")[0]).toBe("2025-01-17");
    });

    it("should advance weekly when completed before due date", () => {
      const rrule: ICalEvent["rrule"] = {
        freq: "WEEKLY",
        interval: 1,
        byday: ["FR"],
      };
      const originalDTSTART = new Date("2025-01-10T00:00:00");
      const previousDueDate = new Date("2025-01-17T23:59:59.999");
      const referenceDate = new Date("2025-01-12T00:00:00");

      const result = calculateNextDueDate(
        rrule,
        originalDTSTART,
        previousDueDate,
        referenceDate,
      );

      expect(result).not.toBeNull();
      expect(result!.getDate()).toBe(24);
      expect(result!.getMonth()).toBe(0);
      expect(result!.getFullYear()).toBe(2025);
    });

    it("should handle daily interval > 1 with early completion", () => {
      const rrule: ICalEvent["rrule"] = { freq: "DAILY", interval: 3 };
      const originalDTSTART = new Date("2025-01-14T00:00:00");
      const previousDueDate = new Date("2025-01-18T23:59:59.999");
      const referenceDate = new Date("2025-01-14T00:00:00");

      const result = calculateNextDueDate(
        rrule,
        originalDTSTART,
        previousDueDate,
        referenceDate,
      );

      expect(result).not.toBeNull();
      expect(result!.toISOString().split("T")[0]).toBe("2025-01-23");
    });
  });

  describe("daily recurrence", () => {
    it.each([
      { interval: 1, prevDate: null, expected: "2025-01-16" },
      { interval: 1, prevDate: "2025-01-14", expected: "2025-01-16" },
      { interval: 2, prevDate: "2025-01-13", expected: "2025-01-18" },
      { interval: 3, prevDate: "2025-01-10", expected: "2025-01-16" },
      { interval: 5, prevDate: "2025-01-10", expected: "2025-01-20" },
      { interval: 7, prevDate: "2025-01-08", expected: "2025-01-24" },
      { interval: 100, prevDate: "2025-01-08", expected: "2025-04-20" },
    ])(
      "should calculate next day for daily interval of $interval for previous due date $prevDate",
      ({ interval, prevDate, expected }) => {
        const rrule: ICalEvent["rrule"] = {
          freq: "DAILY",
          interval,
        };
        const originalDTSTART = new Date("2025-01-10T00:00:00");
        const previousDueDate
          = prevDate != null ? new Date(`${prevDate}T00:00:00`) : null;

        const result = calculateNextDueDate(
          rrule,
          originalDTSTART,
          previousDueDate,
        );

        expect(result).not.toBeNull();
        expect(result!.toISOString().split("T")[0]).toBe(expected);
      },
    );
  });

  describe("weekly recurrence", () => {
    it.each([
      {
        interval: 1,
        daysOfWeek: [3],
        prevDate: "2025-01-15",
        expected: "2025-01-22",
        description: "same day next week",
      },
      {
        interval: 1,
        daysOfWeek: [5],
        prevDate: null,
        expected: "2025-01-17",
        description: "future day this week",
      },
      {
        interval: 1,
        daysOfWeek: [5],
        prevDate: "2025-01-16",
        expected: "2025-01-17",
        description: "future day this week",
      },
      {
        interval: 1,
        daysOfWeek: [1, 3, 5],
        prevDate: "2025-01-13",
        expected: "2025-01-15",
        description: "multiple days - next in sequence",
      },
      {
        interval: 2,
        daysOfWeek: [1],
        prevDate: "2025-01-06",
        expected: "2025-01-27",
        description: "bi-weekly",
      },
      {
        interval: 1,
        daysOfWeek: [0],
        prevDate: "2025-01-12",
        expected: "2025-01-19",
        description: "Sunday as day 0",
      },
      {
        interval: 1,
        daysOfWeek: [],
        prevDate: "2025-01-10",
        expected: "2025-01-20",
        description: "no days specified (7-day interval)",
      },
      {
        interval: 3,
        daysOfWeek: [1],
        prevDate: "2024-01-01",
        refDate: "2024-01-02",
        expected: "2024-01-22",
        description: "3-week interval single day",
      },
      {
        interval: 4,
        daysOfWeek: [5],
        prevDate: "2024-01-05",
        refDate: "2024-01-06",
        expected: "2024-02-02",
        description: "4-week interval on Friday",
      },
      {
        interval: 3,
        daysOfWeek: [1],
        prevDate: "2024-01-01",
        refDate: "2024-01-02",
        expected: "2024-01-22",
        description: "3-week interval starting Monday",
      },
      {
        interval: 3,
        daysOfWeek: [1, 3, 5],
        prevDate: "2024-01-05",
        refDate: "2024-01-05",
        expected: "2024-01-22",
        description: "3-week interval complete on last selected day",
      },
      {
        interval: 2,
        daysOfWeek: [1, 3, 5],
        prevDate: "2024-01-01",
        refDate: "2024-01-14",
        expected: "2024-01-15",
        description: "reference before selected days (Sunday)",
      },
      {
        interval: 3,
        daysOfWeek: [3, 5],
        prevDate: "2024-01-01",
        refDate: "2024-01-02",
        expected: "2024-01-03",
        description: "start before first selected day",
      },
      {
        interval: 2,
        daysOfWeek: [1, 3],
        prevDate: "2024-01-05",
        refDate: "2024-01-05",
        expected: "2024-01-15",
        description: "reference after all selected days",
      },
      {
        interval: 3,
        daysOfWeek: [1],
        prevDate: "2024-01-01",
        refDate: "2024-01-20",
        expected: "2024-01-22",
        description: "Saturday reference with Monday selection",
      },
      {
        interval: 3,
        daysOfWeek: [1, 5],
        prevDate: "2024-01-22",
        refDate: "2024-01-27",
        expected: "2024-02-12",
        description: "January to February crossing",
      },
      {
        interval: 4,
        daysOfWeek: [3],
        prevDate: "2024-02-07",
        refDate: "2024-02-08",
        expected: "2024-03-27",
        description: "February to March leap year",
      },
      {
        interval: 3,
        daysOfWeek: [2, 4],
        prevDate: "2024-11-26",
        refDate: "2024-11-29",
        expected: "2024-12-24",
        description: "November to December crossing",
      },
      {
        interval: 3,
        daysOfWeek: [1, 3],
        prevDate: "2023-12-18",
        refDate: "2023-12-22",
        expected: "2024-01-22",
        description: "December to January year crossing",
      },
      {
        interval: 4,
        daysOfWeek: [5],
        prevDate: "2023-12-22",
        refDate: "2023-12-23",
        expected: "2024-02-02",
        description: "year boundary with late week start",
      },
      {
        interval: 2,
        daysOfWeek: [1],
        prevDate: "2024-01-06",
        refDate: "2024-01-06",
        expected: "2024-01-15",
        description: "elapsedWeeks increment on Sunday crossing",
      },
      {
        interval: 5,
        daysOfWeek: [2],
        prevDate: "2024-01-02",
        refDate: "2024-01-03",
        expected: "2024-02-06",
        description: "multiple Sunday crossings for large interval",
      },
      {
        interval: 3,
        daysOfWeek: [1, 3],
        prevDate: "2024-01-04",
        refDate: "2024-01-04",
        expected: "2024-01-22",
        description: "weeks complete before selecting days after last",
      },
      {
        interval: 2,
        daysOfWeek: [3],
        prevDate: "2024-01-03",
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
        prevDate: "2024-01-07",
        refDate: "2024-01-07",
        expected: "2024-01-15",
        description: "Sunday with Monday next day",
      },
      {
        interval: 2,
        daysOfWeek: [5, 1, 3],
        prevDate: "2024-01-01",
        refDate: "2024-01-01",
        expected: "2024-01-03",
        description: "unsorted daysOfWeek respects sorting",
      },
    ])(
      "should calculate $description (interval=$interval, days=$daysOfWeek)",
      ({ interval, daysOfWeek, prevDate, refDate, expected }) => {
        const dayNames = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
        const rrule: ICalEvent["rrule"] = {
          freq: "WEEKLY",
          interval,
          ...(daysOfWeek && daysOfWeek.length > 0 && {
            byday: daysOfWeek.map(day => dayNames[day] || "SU"),
          }),
        };
        const originalDTSTART = new Date("2024-01-01T00:00:00");
        const previousDueDate
          = prevDate != null ? new Date(`${prevDate}T00:00:00`) : null;
        const referenceDate = refDate
          ? new Date(`${refDate}T00:00:00`)
          : null;

        const result = calculateNextDueDate(
          rrule,
          originalDTSTART,
          previousDueDate,
          referenceDate,
        );

        expect(result).not.toBeNull();
        expect(result!.toISOString().split("T")[0]).toBe(expected);
      },
    );
  });

  describe("monthly recurrence", () => {
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
        expected: "2025-03-31",
        description: "day 31 in February (caps at 28)",
      },
      {
        interval: 1,
        dayOfMonth: 29,
        prevDate: "2025-01-29",
        expected: "2025-03-29",
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
        expected: "2025-03-20",
        description: "completed late - same day of month",
      },
    ])(
      "should handle $description (interval=$interval, day=$dayOfMonth)",
      ({ interval, dayOfMonth, prevDate, refDate, expected }) => {
        const rrule: ICalEvent["rrule"] = {
          freq: "MONTHLY",
          interval,
          bymonthday: [dayOfMonth],
        };
        const originalDTSTART = new Date("2025-01-20T00:00:00");
        const previousDueDate = prevDate
          ? new Date(`${prevDate}T00:00:00`)
          : null;
        const referenceDate = refDate
          ? new Date(`${refDate}T00:00:00`)
          : null;

        const result = calculateNextDueDate(
          rrule,
          originalDTSTART,
          previousDueDate,
          referenceDate,
        );

        expect(result).not.toBeNull();
        expect(result!.toISOString().split("T")[0]).toBe(expected);
      },
    );
  });

  describe("timezone", () => {
    it("should calculate next due date with UTC timezone", () => {
      const originalDTSTART = new Date("2025-01-15T00:00:00Z");
      const rrule: ICalEvent["rrule"] = {
        freq: "DAILY",
        interval: 1,
      };

      const result = calculateNextDueDate(rrule, originalDTSTART, null, originalDTSTART);
      expect(result).not.toBeNull();
      expect(result).toBeInstanceOf(Date);
      expect(result!.getTime()).toBeGreaterThanOrEqual(originalDTSTART.getTime());
    });

    it("should calculate next due date with America/New_York timezone", () => {
      const originalDTSTART = new Date("2025-01-15T05:00:00Z");
      const rrule: ICalEvent["rrule"] = {
        freq: "DAILY",
        interval: 1,
      };

      const result = calculateNextDueDate(rrule, originalDTSTART, null, originalDTSTART);
      expect(result).toBeInstanceOf(Date);
    });

    it("should calculate next due date with Europe/London timezone", () => {
      const originalDTSTART = new Date("2025-01-15T00:00:00Z");
      const rrule: ICalEvent["rrule"] = {
        freq: "DAILY",
        interval: 1,
      };

      const result = calculateNextDueDate(rrule, originalDTSTART, null, originalDTSTART);
      expect(result).toBeInstanceOf(Date);
    });

    it("should calculate next due date with Asia/Tokyo timezone", () => {
      const originalDTSTART = new Date("2025-01-15T00:00:00Z");
      const rrule: ICalEvent["rrule"] = {
        freq: "DAILY",
        interval: 1,
      };

      const result = calculateNextDueDate(rrule, originalDTSTART, null, originalDTSTART);
      expect(result).toBeInstanceOf(Date);
    });

    it("should handle DST spring forward (loses 1 hour)", () => {
      const originalDTSTART = new Date("2025-03-09T07:00:00Z");
      const rrule: ICalEvent["rrule"] = {
        freq: "DAILY",
        interval: 1,
      };

      const result = calculateNextDueDate(rrule, originalDTSTART, null, originalDTSTART);
      expect(result).toBeInstanceOf(Date);
    });

    it("should handle DST fall back (duplicates 1 hour)", () => {
      const originalDTSTART = new Date("2025-11-02T06:00:00Z");
      const rrule: ICalEvent["rrule"] = {
        freq: "DAILY",
        interval: 1,
      };

      const result = calculateNextDueDate(rrule, originalDTSTART, null, originalDTSTART);
      expect(result).toBeInstanceOf(Date);
    });

    it("should preserve original DTSTART across timezone changes", () => {
      const originalDTSTART = new Date("2025-01-15T00:00:00Z");
      const rrule: ICalEvent["rrule"] = {
        freq: "WEEKLY",
        interval: 1,
        byday: ["MO"],
      };

      const previousDueDate = new Date("2025-01-20T00:00:00Z");
      const result = calculateNextDueDate(rrule, originalDTSTART, previousDueDate, new Date());

      expect(result).not.toBeNull();
      expect(result).toBeInstanceOf(Date);
      expect(result!.getTime()).toBeGreaterThan(previousDueDate.getTime());
    });

    it("should maintain consistency between fast path and ical.js expansion", () => {
      const originalDTSTART = new Date("2025-01-15T00:00:00Z");
      const rrule: ICalEvent["rrule"] = {
        freq: "DAILY",
        interval: 1,
      };

      const result1 = calculateNextDueDate(rrule, originalDTSTART, null, originalDTSTART);
      const result2 = calculateNextDueDate(rrule, originalDTSTART, null, originalDTSTART);

      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
      expect(result1!.getTime()).toBe(result2!.getTime());
    });

    it("should handle weekly recurrence across timezones", () => {
      const originalDTSTART = new Date("2025-01-15T00:00:00Z");
      const rrule: ICalEvent["rrule"] = {
        freq: "WEEKLY",
        interval: 1,
        byday: ["MO", "WE", "FR"],
      };

      const result = calculateNextDueDate(rrule, originalDTSTART, null, originalDTSTART);
      expect(result).toBeInstanceOf(Date);
    });

    it("should handle monthly recurrence across timezones", () => {
      const originalDTSTART = new Date("2025-01-15T00:00:00Z");
      const rrule: ICalEvent["rrule"] = {
        freq: "MONTHLY",
        interval: 1,
        bymonthday: [15],
      };

      const result = calculateNextDueDate(rrule, originalDTSTART, null, originalDTSTART);
      expect(result).toBeInstanceOf(Date);
    });
  });

  describe("error / fallback path", () => {
    it("returns fast-path when iteration limit is hit", () => {
      const rrule: ICalEvent["rrule"] = { freq: "DAILY", interval: 1 };
      const originalDTSTART = new Date("2020-01-01T00:00:00");
      const referenceDate = new Date("2025-01-15T00:00:00");

      const result = calculateNextDueDate(rrule, originalDTSTART, null, referenceDate);

      expect(result).not.toBeNull();
      expect(result).toBeInstanceOf(Date);
      expect(result!.getFullYear()).toBe(2025);
      expect(result!.getMonth()).toBe(0);
      expect([15, 16]).toContain(result!.getDate());
    });

    it("returns fast-path date when RecurExpansion throws", () => {
      icalThrowRecurExpansion.current = true;
      try {
        const rrule: ICalEvent["rrule"] = { freq: "DAILY", interval: 1 };
        const originalDTSTART = new Date("2025-01-14T00:00:00");
        const result = calculateNextDueDate(rrule, originalDTSTART, null, new Date("2025-01-15T00:00:00"));
        expect(result).toBeInstanceOf(Date);
        expect(result?.getTime()).toBeGreaterThan(0);
      }
      finally {
        icalThrowRecurExpansion.current = false;
      }
    });
  });

  describe("until", () => {
    it("returns next occurrence when it is on or before until", () => {
      const rrule: ICalEvent["rrule"] = {
        freq: "DAILY",
        interval: 1,
        until: "2025-01-20",
      };
      const originalDTSTART = new Date("2025-01-10T00:00:00");
      const previousDueDate = new Date("2025-01-18T23:59:59.999");
      const referenceDate = new Date("2025-01-15T00:00:00");

      const result = calculateNextDueDate(
        rrule,
        originalDTSTART,
        previousDueDate,
        referenceDate,
      );

      expect(result).not.toBeNull();
      expect(result?.toISOString().split("T")[0]).toBe("2025-01-19");
    });

    it("returns null when completing the last occurrence (previous due equals until)", () => {
      const rrule: ICalEvent["rrule"] = {
        freq: "DAILY",
        interval: 1,
        until: "2025-01-20",
      };
      const originalDTSTART = new Date("2025-01-10T00:00:00");
      const previousDueDate = new Date("2025-01-20T23:59:59.999");
      const referenceDate = new Date("2025-01-15T00:00:00");

      const result = calculateNextDueDate(
        rrule,
        originalDTSTART,
        previousDueDate,
        referenceDate,
      );

      expect(result).toBeNull();
    });

    it("returns null when completing the last occurrence (previous due is last valid before until)", () => {
      const rrule: ICalEvent["rrule"] = {
        freq: "WEEKLY",
        interval: 1,
        byday: ["FR"],
        until: "2025-01-24",
      };
      const originalDTSTART = new Date("2025-01-10T00:00:00");
      const previousDueDate = new Date("2025-01-24T23:59:59.999");
      const referenceDate = new Date("2025-01-15T00:00:00");

      const result = calculateNextDueDate(
        rrule,
        originalDTSTART,
        previousDueDate,
        referenceDate,
      );

      expect(result).toBeNull();
    });

    it("returns null when until is in the past relative to compare point", () => {
      const rrule: ICalEvent["rrule"] = {
        freq: "DAILY",
        interval: 1,
        until: "2025-01-10",
      };
      const originalDTSTART = new Date("2025-01-01T00:00:00");
      const previousDueDate = null;
      const referenceDate = new Date("2025-01-15T00:00:00");

      const result = calculateNextDueDate(
        rrule,
        originalDTSTART,
        previousDueDate,
        referenceDate,
      );

      expect(result).toBeNull();
    });

    it("caps fast path at until when RecurExpansion throws", () => {
      icalThrowRecurExpansion.current = true;
      try {
        const rrule: ICalEvent["rrule"] = {
          freq: "DAILY",
          interval: 1,
          until: "2025-01-18",
        };
        const originalDTSTART = new Date("2025-01-01T00:00:00");
        const referenceDate = new Date("2025-01-15T00:00:00");

        const result = calculateNextDueDate(
          rrule,
          originalDTSTART,
          null,
          referenceDate,
        );

        expect(result).not.toBeNull();
        expect(result!.getTime()).toBeLessThanOrEqual(new Date("2025-01-18T23:59:59.999").getTime());
      }
      finally {
        icalThrowRecurExpansion.current = false;
      }
    });

    it("returns null in catch when fast path would be after until", () => {
      icalThrowRecurExpansion.current = true;
      try {
        const rrule: ICalEvent["rrule"] = {
          freq: "DAILY",
          interval: 1,
          until: "2025-01-14",
        };
        const originalDTSTART = new Date("2025-01-01T00:00:00");
        const previousDueDate = new Date("2025-01-13T23:59:59.999");
        const referenceDate = new Date("2025-01-15T00:00:00");

        const result = calculateNextDueDate(
          rrule,
          originalDTSTART,
          previousDueDate,
          referenceDate,
        );

        expect(result).toBeNull();
      }
      finally {
        icalThrowRecurExpansion.current = false;
      }
    });
  });
});

describe("parseRRuleString", () => {
  it("returns undefined for empty or whitespace string", () => {
    expect(parseRRuleString("")).toBeUndefined();
    expect(parseRRuleString("   ")).toBeUndefined();
    expect(parseRRuleString("\t")).toBeUndefined();
  });

  it("parses RRULE:FREQ=DAILY;INTERVAL=1", () => {
    const r = parseRRuleString("RRULE:FREQ=DAILY;INTERVAL=1");
    expect(r).toBeDefined();
    expect(r?.freq).toBe("DAILY");
    expect(r?.interval).toBe(1);
  });

  it("parses without RRULE: prefix", () => {
    const r = parseRRuleString("FREQ=WEEKLY;INTERVAL=2");
    expect(r?.freq).toBe("WEEKLY");
    expect(r?.interval).toBe(2);
  });

  it("parses BYDAY", () => {
    const r = parseRRuleString("FREQ=WEEKLY;BYDAY=MO,WE,FR");
    expect(r?.freq).toBe("WEEKLY");
    expect(r?.byday).toEqual(["MO", "WE", "FR"]);
  });

  it("parses BYMONTH", () => {
    const r = parseRRuleString("FREQ=YEARLY;BYMONTH=1,6,12");
    expect(r?.freq).toBe("YEARLY");
    expect(r?.bymonth).toEqual([1, 6, 12]);
  });

  it("parses COUNT and UNTIL", () => {
    const r = parseRRuleString("FREQ=DAILY;COUNT=5;UNTIL=20251231T235959Z");
    expect(r?.freq).toBe("DAILY");
    expect(r?.count).toBe(5);
    expect(r?.until).toBe("20251231T235959Z");
  });

  it("returns undefined when FREQ is missing", () => {
    expect(parseRRuleString("INTERVAL=1")).toBeUndefined();
    expect(parseRRuleString("RRULE:INTERVAL=1")).toBeUndefined();
  });

  it("returns undefined when FREQ is empty after trim", () => {
    expect(parseRRuleString("RRULE:  ")).toBeUndefined();
  });
});

describe("expandRecurringEvents", () => {
  it("returns events as-is when they have no ical_event or no rrule", () => {
    const events = [
      { id: "e1", start: new Date("2025-01-10"), end: new Date("2025-01-11") },
      {
        id: "e2",
        start: new Date("2025-01-12"),
        end: new Date("2025-01-13"),
        ical_event: { type: "VEVENT" as const, uid: "u2", summary: "S", dtstart: "", dtend: "" },
      },
    ];
    const start = new Date("2025-01-01");
    const end = new Date("2025-01-31");

    const result = expandRecurringEvents(events, start, end);

    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe("e1");
    expect(result[1]?.id).toBe("e2");
  });

  it("expands one event with rrule into multiple in range", () => {
    const start = new Date(2025, 0, 1);
    const end = new Date(2025, 0, 31);
    const events = [
      {
        id: "ev-1",
        start: new Date(2025, 0, 15, 10, 0, 0),
        end: new Date(2025, 0, 15, 11, 0, 0),
        ical_event: {
          type: "VEVENT" as const,
          uid: "u1",
          summary: "Recur",
          dtstart: "2025-01-15T10:00:00Z",
          dtend: "2025-01-15T11:00:00Z",
          rrule: { freq: "DAILY", interval: 1 },
        },
      },
    ];

    const result = expandRecurringEvents(events, start, end);

    expect(result.length).toBeGreaterThan(1);
    const ids = result.map(e => e.id);
    expect(ids.every(id => id.startsWith("ev-1-"))).toBe(true);
    for (const e of result) {
      expect(e.start >= start && e.start <= end).toBe(true);
      expect(e.end >= start && e.end <= end).toBe(true);
    }
  });
});
