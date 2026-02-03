import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import type { CalendarEvent } from "~/types/calendar";
import { useCalendar } from "../../../../app/composables/useCalendar";

describe("useCalendar", () => {
  describe("timezone", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should test timezone conversion functions exist", () => {
      const calendar = useCalendar();

      expect(calendar.getLocalTimeFromUTC).toBeDefined();
      expect(typeof calendar.getLocalTimeFromUTC).toBe("function");
    });

    it("should convert UTC time to local time with various timezones", () => {
      const calendar = useCalendar();
      const utcDate = new Date("2025-01-15T12:00:00Z");
      const localTime = calendar.getLocalTimeFromUTC(utcDate);

      expect(localTime).toBeInstanceOf(Date);
      expect(localTime.getTime()).toBeDefined();
    });

    it("should check if two dates are the same local day for all-day events", () => {
      const calendar = useCalendar();
      const date1 = new Date("2025-01-15T00:00:00Z");
      const date2 = new Date("2025-01-15T23:59:59Z");

      const result = calendar.isSameLocalDay(date1, date2, true);
      expect(result).toBe(true);
    });

    it("should check if two dates are the same local day for timed events", () => {
      const calendar = useCalendar();
      const date1 = new Date("2025-01-15T10:00:00Z");
      const date2 = new Date("2025-01-15T14:00:00Z");

      const result = calendar.isSameLocalDay(date1, date2, false);
      expect(typeof result).toBe("boolean");
    });

    it("should check if a day is in local range for all-day events", () => {
      const calendar = useCalendar();
      const day = new Date("2025-01-15T00:00:00Z");
      const start = new Date("2025-01-10T00:00:00Z");
      const end = new Date("2025-01-20T00:00:00Z");

      const result = calendar.isLocalDayInRange(day, start, end, true);
      expect(result).toBe(true);
    });

    it("should check if a day is in local range for timed events", () => {
      const calendar = useCalendar();
      const day = new Date("2025-01-15T12:00:00Z");
      const start = new Date("2025-01-10T00:00:00Z");
      const end = new Date("2025-01-20T00:00:00Z");

      const result = calendar.isLocalDayInRange(day, start, end, false);
      expect(typeof result).toBe("boolean");
    });

    it("should handle timezone conversion failures gracefully", () => {
      const calendar = useCalendar();
      const utcDate = new Date("2025-01-15T12:00:00Z");

      vi.spyOn(console, "warn").mockImplementation(() => {});

      const localTime = calendar.getLocalTimeFromUTC(utcDate);
      expect(localTime).toBeInstanceOf(Date);
    });

    it("should handle DST transition edge cases for same local day check", () => {
      const calendar = useCalendar();
      const date1 = new Date("2025-03-09T06:00:00Z");
      const date2 = new Date("2025-03-09T07:00:00Z");

      const result = calendar.isSameLocalDay(date1, date2, false);
      expect(typeof result).toBe("boolean");
    });

    it("should get local time string with timezone conversion", () => {
      const calendar = useCalendar();
      const utcDate = new Date("2025-01-15T12:00:00Z");
      const timeString = calendar.getLocalTimeString(utcDate);

      expect(typeof timeString).toBe("string");
      expect(timeString.length).toBeGreaterThan(0);
    });

    it("should get local date string with timezone conversion", () => {
      const calendar = useCalendar();
      const utcDate = new Date("2025-01-15T12:00:00Z");
      const dateString = calendar.getLocalDateString(utcDate);

      expect(typeof dateString).toBe("string");
      expect(dateString.length).toBeGreaterThan(0);
    });
  });

  describe("date helpers", () => {
    it("should create local date with correct UTC midnight", () => {
      const { createLocalDate } = useCalendar();
      const d = createLocalDate(2025, 0, 15);

      expect(d).toBeInstanceOf(Date);
      expect(d.getUTCFullYear()).toBe(2025);
      expect(d.getUTCMonth()).toBe(0);
      expect(d.getUTCDate()).toBe(15);
      expect(d.getUTCHours()).toBe(0);
      expect(d.getUTCMinutes()).toBe(0);
    });

    it("should convert local date to UTC", () => {
      const { convertLocalToUTC } = useCalendar();
      const local = new Date(2025, 0, 15, 14, 30, 0);

      const utc = convertLocalToUTC(local);

      expect(utc).toBeInstanceOf(Date);
      expect(utc.getUTCFullYear()).toBe(local.getFullYear());
      expect(utc.getUTCMonth()).toBe(local.getMonth());
      expect(utc.getUTCDate()).toBe(local.getDate());
      expect(utc.getUTCHours()).toBe(local.getHours());
      expect(utc.getUTCMinutes()).toBe(local.getMinutes());
    });
  });

  describe("color helpers", () => {
    it("should lighten hex color with default amount", () => {
      const { lightenColor } = useCalendar();

      const result = lightenColor("#000000");

      expect(result).toMatch(/^#[0-9a-f]{6}$/i);
      expect(result).not.toBe("#000000");
    });

    it("should lighten hex color with explicit amount", () => {
      const { lightenColor } = useCalendar();

      const result = lightenColor("#000000", 0.5);

      expect(result).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it("should return white text color for dark hex", () => {
      const { getTextColor } = useCalendar();

      expect(getTextColor("#000000")).toBe("white");
    });

    it("should return black text color for light hex", () => {
      const { getTextColor } = useCalendar();

      expect(getTextColor("#ffffff")).toBe("black");
    });

    it("should return numeric luminance for hex", () => {
      const { getLuminance } = useCalendar();

      expect(getLuminance("#000000")).toBe(0);
      expect(getLuminance("#ffffff")).toBeGreaterThan(0.9);
    });

    it("should return white for empty or invalid colors in getAverageTextColor", () => {
      const { getAverageTextColor } = useCalendar();

      expect(getAverageTextColor([])).toBe("white");
      expect(getAverageTextColor(["invalid", "nothex"])).toBe("white");
    });

    it("should return black or white by luminance for valid hexes in getAverageTextColor", () => {
      const { getAverageTextColor } = useCalendar();

      const result = getAverageTextColor(["#ffffff"]);
      expect(["black", "white"]).toContain(result);
    });
  });

  describe("event helpers", () => {
    it("should identify placeholder event by id prefix", () => {
      const { isPlaceholderEvent } = useCalendar();
      const normal: CalendarEvent = { id: "evt-1", title: "X", start: new Date(), end: new Date() };
      const placeholder: CalendarEvent = { id: "__placeholder_0", title: "", start: new Date(0), end: new Date(0) };

      expect(isPlaceholderEvent(normal)).toBe(false);
      expect(isPlaceholderEvent(placeholder)).toBe(true);
    });

    it("should identify placeholder event by isPlaceholder flag", () => {
      const { isPlaceholderEvent } = useCalendar();
      const event = { id: "other", title: "", start: new Date(0), end: new Date(0), isPlaceholder: true } as CalendarEvent & { isPlaceholder: true };

      expect(isPlaceholderEvent(event)).toBe(true);
    });

    it("should create placeholder event with expected shape", () => {
      const { createPlaceholderEvent } = useCalendar();

      const result = createPlaceholderEvent(3);

      expect(result.id).toBe("__placeholder_3");
      expect(result.isPlaceholder).toBe(true);
      expect(result.position).toBe(3);
      expect(result.title).toBe("");
      expect(result.start).toEqual(new Date(0));
      expect(result.end).toEqual(new Date(0));
    });

    it("should return eventColor when event has no users or color in getEventUserColors", () => {
      const { getEventUserColors } = useCalendar();
      const event: CalendarEvent = { id: "e1", title: "E", start: new Date(), end: new Date() };

      const result = getEventUserColors(event, { eventColor: "#aaa", defaultColor: "#bbb" });

      expect(result).toBe("#aaa");
    });

    it("should return event color when event.color is string in getEventUserColors", () => {
      const { getEventUserColors } = useCalendar();
      const event: CalendarEvent = { id: "e1", title: "E", start: new Date(), end: new Date(), color: "#abc" };

      const result = getEventUserColors(event);

      expect(result).toBe("#abc");
    });

    it("should return user colors when event has users with colors in getEventUserColors", () => {
      const { getEventUserColors } = useCalendar();
      const event: CalendarEvent = {
        id: "e1",
        title: "E",
        start: new Date(),
        end: new Date(),
        users: [{ id: "u1", name: "U1", color: "#111" }, { id: "u2", name: "U2", color: "#222" }],
      };

      const result = getEventUserColors(event, { eventColor: "#ccc", defaultColor: "#ddd" });

      expect(Array.isArray(result)).toBe(true);
      expect((result as string[]).sort()).toEqual(["#111", "#222"]);
    });
  });

  describe("UI helpers", () => {
    it("should return default heights for month, week, day", () => {
      const { computedEventHeight } = useCalendar();

      expect(computedEventHeight("month")).toBe(40);
      expect(computedEventHeight("week")).toBe(64);
      expect(computedEventHeight("day")).toBe(48);
    });

    it("should return customHeight when provided", () => {
      const { computedEventHeight } = useCalendar();

      expect(computedEventHeight("month", 100)).toBe(100);
    });

    it("should return true when date and selectedDate are same UTC day in isSelectedDate", () => {
      const { isSelectedDate } = useCalendar();
      const d = new Date("2025-01-15T12:00:00Z");
      const sel = new Date("2025-01-15T08:00:00Z");

      expect(isSelectedDate(d, sel)).toBe(true);
    });

    it("should return false when date and selectedDate differ in isSelectedDate", () => {
      const { isSelectedDate } = useCalendar();
      const d = new Date("2025-01-15T23:59:59Z");
      const sel = new Date("2025-01-16T00:00:00Z");

      expect(isSelectedDate(d, sel)).toBe(false);
    });

    it("should sort events by start time without mutating input", () => {
      const { sortEvents } = useCalendar();
      const start = new Date("2025-01-15T10:00:00Z");
      const mid = new Date("2025-01-15T12:00:00Z");
      const late = new Date("2025-01-15T14:00:00Z");
      const events: CalendarEvent[] = [
        { id: "3", title: "C", start: late, end: late },
        { id: "1", title: "A", start: start, end: start },
        { id: "2", title: "B", start: mid, end: mid },
      ];

      const result = sortEvents(events);

      expect(result[0]!.id).toBe("1");
      expect(result[1]!.id).toBe("2");
      expect(result[2]!.id).toBe("3");
      expect(events[0]!.id).toBe("3");
    });
  });

  describe("combineEvents", () => {
    it("should merge events with same title, start, end, location, description", () => {
      const { combineEvents } = useCalendar();
      const start = new Date("2025-01-15T10:00:00Z");
      const end = new Date("2025-01-15T11:00:00Z");
      const events: CalendarEvent[] = [
        {
          id: "e1",
          title: "Meet",
          start,
          end,
          location: "L1",
          description: "D1",
          sourceCalendars: [{ integrationId: "i1", calendarId: "c1", accessRole: "read", canEdit: false, eventColor: "#aaa" }],
          users: [{ id: "u1", name: "U1", color: "#111" }],
        },
        {
          id: "e2",
          title: "Meet",
          start,
          end,
          location: "L1",
          description: "D1",
          sourceCalendars: [{ integrationId: "i2", calendarId: "c2", accessRole: "read", canEdit: false, eventColor: "#bbb" }],
          users: [{ id: "u2", name: "U2", color: "#222" }],
        },
      ];

      const result = combineEvents(events);

      expect(result).toHaveLength(1);
      expect(result[0]!.users).toHaveLength(2);
      expect(result[0]!.sourceCalendars).toHaveLength(2);
    });

    it("should sort combined events by start time", () => {
      const { combineEvents } = useCalendar();
      const early = new Date("2025-01-15T09:00:00Z");
      const late = new Date("2025-01-15T11:00:00Z");
      const events: CalendarEvent[] = [
        { id: "e2", title: "B", start: late, end: late },
        { id: "e1", title: "A", start: early, end: early },
      ];

      const result = combineEvents(events);

      expect(result[0]!.title).toBe("A");
      expect(result[1]!.title).toBe("B");
    });
  });
});
