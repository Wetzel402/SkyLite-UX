import { CalendarDate, type DateValue } from "@internationalized/date";
import { ref, type Ref } from "vue";
import { describe, it, expect, vi } from "vitest";

import type { RecurrenceState } from "../../../../app/types/recurrence";
import {
  getDefaultDateToday,
  getDefaultRecurrenceUntil,
  useRecurrence,
} from "../../../../app/composables/useRecurrence";

vi.mock("consola", () => ({
  consola: {
    error: vi.fn(),
  },
}));

function createRecurrenceState(): RecurrenceState {
  return {
    isRecurring: ref(true),
    recurrenceType: ref("weekly"),
    recurrenceInterval: ref(2),
    recurrenceEndType: ref("count"),
    recurrenceCount: ref(5),
    recurrenceUntil: ref(new CalendarDate(2025, 12, 31)) as Ref<DateValue>,
    recurrenceDays: ref([1, 3, 5]),
    recurrenceMonthlyType: ref("weekday"),
    recurrenceMonthlyWeekday: ref({ week: 2, day: 1 }),
    recurrenceYearlyType: ref("day"),
    recurrenceYearlyWeekday: ref({ week: 1, day: 1, month: 0 }),
  };
}

describe("useRecurrence", () => {
  describe("getDefaultRecurrenceUntil", () => {
    const start = new CalendarDate(2025, 6, 15);

    it("should return start + 6 days for daily", () => {
      const result = getDefaultRecurrenceUntil(start, "daily");
      expect(result.year).toBe(2025);
      expect(result.month).toBe(6);
      expect(result.day).toBe(21);
    });

    it("should return start + 3 weeks for weekly", () => {
      const result = getDefaultRecurrenceUntil(start, "weekly");
      expect(result.year).toBe(2025);
      expect(result.month).toBe(7);
      expect(result.day).toBe(6);
    });

    it("should return start + 5 months for monthly", () => {
      const result = getDefaultRecurrenceUntil(start, "monthly");
      expect(result.year).toBe(2025);
      expect(result.month).toBe(11);
      expect(result.day).toBe(15);
    });

    it("should return start + 2 years for yearly", () => {
      const result = getDefaultRecurrenceUntil(start, "yearly");
      expect(result.year).toBe(2027);
      expect(result.month).toBe(6);
      expect(result.day).toBe(15);
    });
  });

  describe("resetRecurrenceFields", () => {
    it("should reset all recurrence fields to defaults", () => {
      const { resetRecurrenceFields } = useRecurrence();
      const state = createRecurrenceState();

      resetRecurrenceFields(state);

      expect(state.isRecurring.value).toBe(false);
      expect(state.recurrenceType.value).toBe("weekly");
      expect(state.recurrenceInterval.value).toBe(1);
      expect(state.recurrenceEndType.value).toBe("never");
      expect(state.recurrenceCount.value).toBe(10);
      const expectedUntil = getDefaultDateToday();
      expect(state.recurrenceUntil.value).not.toBeNull();
      expect(state.recurrenceUntil.value!.year).toBe(expectedUntil.year);
      expect(state.recurrenceUntil.value!.month).toBe(expectedUntil.month);
      expect(state.recurrenceUntil.value!.day).toBe(expectedUntil.day);
      expect(state.recurrenceDays.value).toEqual([]);
      expect(state.recurrenceMonthlyType.value).toBe("day");
      expect(state.recurrenceMonthlyWeekday.value).toEqual({ week: 1, day: 1 });
      expect(state.recurrenceYearlyType.value).toBe("day");
      expect(state.recurrenceYearlyWeekday.value).toEqual({
        week: 1,
        day: 1,
        month: 0,
      });
    });
  });

  describe("adjustStartDateForRecurrenceDays", () => {
    it("should return start when recurrenceDays is empty", () => {
      const { adjustStartDateForRecurrenceDays } = useRecurrence();
      const start = new Date("2026-01-26T12:00:00Z");
      const result = adjustStartDateForRecurrenceDays(start, []);
      expect(result).toEqual(start);
    });

    it("should return start when start day is already in recurrenceDays", () => {
      const { adjustStartDateForRecurrenceDays } = useRecurrence();
      const start = new Date("2026-01-26T12:00:00Z");
      const result = adjustStartDateForRecurrenceDays(start, [1]);
      expect(result.getTime()).toBe(start.getTime());
    });

    it("should adjust start to next occurrence day", () => {
      const { adjustStartDateForRecurrenceDays } = useRecurrence();
      const start = new Date("2026-01-26T12:00:00Z");
      const result = adjustStartDateForRecurrenceDays(start, [2]);
      expect(result.getUTCDay()).toBe(2);
    });

    it("should adjust start when next occurrence is earlier in week (firstDay < startDay)", () => {
      const { adjustStartDateForRecurrenceDays } = useRecurrence();
      const start = new Date("2026-01-31T12:00:00Z");
      const result = adjustStartDateForRecurrenceDays(start, [0]);
      expect(result.getUTCDay()).toBe(0);
    });
  });

  describe("generateRecurrenceRule", () => {
    it("should return undefined when not recurring", () => {
      const { generateRecurrenceRule } = useRecurrence();
      const state = createRecurrenceState();
      state.isRecurring.value = false;

      const result = generateRecurrenceRule(state, new Date());

      expect(result).toBeUndefined();
    });

    it("should return rrule for daily recurrence", () => {
      const { generateRecurrenceRule } = useRecurrence();
      const state = createRecurrenceState();
      state.recurrenceType.value = "daily";
      state.recurrenceInterval.value = 1;
      state.recurrenceEndType.value = "never";

      const result = generateRecurrenceRule(state, new Date());

      expect(result).toEqual({ freq: "DAILY" });
    });

    it("should include interval when greater than 1", () => {
      const { generateRecurrenceRule } = useRecurrence();
      const state = createRecurrenceState();
      state.recurrenceType.value = "weekly";
      state.recurrenceInterval.value = 2;
      state.recurrenceDays.value = [1];
      state.recurrenceEndType.value = "never";

      const result = generateRecurrenceRule(state, new Date());

      expect(result).toEqual(
        expect.objectContaining({
          freq: "WEEKLY",
          interval: 2,
          byday: ["MO"],
        }),
      );
    });

    it("should include monthly weekday byday", () => {
      const { generateRecurrenceRule } = useRecurrence();
      const state = createRecurrenceState();
      state.recurrenceType.value = "monthly";
      state.recurrenceMonthlyType.value = "weekday";
      state.recurrenceMonthlyWeekday.value = { week: 2, day: 1 };
      state.recurrenceEndType.value = "never";

      const result = generateRecurrenceRule(state, new Date());

      expect(result).toEqual(
        expect.objectContaining({
          freq: "MONTHLY",
          byday: ["2MO"],
        }),
      );
    });

    it("should include yearly weekday byday and bymonth", () => {
      const { generateRecurrenceRule } = useRecurrence();
      const state = createRecurrenceState();
      state.recurrenceType.value = "yearly";
      state.recurrenceYearlyType.value = "weekday";
      state.recurrenceYearlyWeekday.value = { week: 1, day: 1, month: 0 };
      state.recurrenceEndType.value = "never";

      const result = generateRecurrenceRule(state, new Date());

      expect(result).toEqual(
        expect.objectContaining({
          freq: "YEARLY",
          byday: ["1MO"],
          bymonth: [1],
        }),
      );
    });

    it("should include until when recurrenceEndType is until", () => {
      const { generateRecurrenceRule } = useRecurrence();
      const state = createRecurrenceState();
      state.recurrenceType.value = "daily";
      state.recurrenceEndType.value = "until";
      state.recurrenceUntil.value = new CalendarDate(2025, 12, 31);

      const result = generateRecurrenceRule(state, new Date());

      expect(result?.until).toBeDefined();
      expect(typeof result?.until).toBe("string");
      expect(result?.until).toContain("2025");
    });
  });

  describe("parseRecurrenceFromICal", () => {
    it("should reset state when icalData is null", () => {
      const { parseRecurrenceFromICal } = useRecurrence();
      const state = createRecurrenceState();

      parseRecurrenceFromICal(null, state);

      expect(state.isRecurring.value).toBe(false);
    });

    it("should reset state when type is not VEVENT", () => {
      const { parseRecurrenceFromICal } = useRecurrence();
      const state = createRecurrenceState();
      const icalData = { type: "VTODO", rrule: { freq: "DAILY" } };

      parseRecurrenceFromICal(icalData, state);

      expect(state.isRecurring.value).toBe(false);
    });

    it("should parse weekly rrule into state", () => {
      const { parseRecurrenceFromICal } = useRecurrence();
      const state = createRecurrenceState();
      state.isRecurring.value = false;
      const icalData = {
        type: "VEVENT",
        rrule: { freq: "weekly", interval: 2, byday: ["MO", "WE"] },
      };

      parseRecurrenceFromICal(icalData, state);

      expect(state.isRecurring.value).toBe(true);
      expect(state.recurrenceType.value).toBe("weekly");
      expect(state.recurrenceInterval.value).toBe(2);
      expect(state.recurrenceDays.value).toContain(1);
      expect(state.recurrenceDays.value).toContain(3);
    });

    it("should reset state and not throw on parse error", () => {
      const { parseRecurrenceFromICal } = useRecurrence();
      const state = createRecurrenceState();
      state.isRecurring.value = true;
      const icalData = {
        type: "VEVENT",
        rrule: { freq: "DAILY", until: "invalid-ical-time" },
      };

      expect(() => parseRecurrenceFromICal(icalData, state)).not.toThrow();
      expect(state.isRecurring.value).toBe(false);
    });
  });
});
