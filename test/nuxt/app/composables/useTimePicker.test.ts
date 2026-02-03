import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { useTimePicker } from "../../../../app/composables/useTimePicker";

describe("useTimePicker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should convert 12h to 24h for PM", () => {
    const { convert12To24 } = useTimePicker();
    expect(convert12To24(1, "PM")).toBe(13);
    expect(convert12To24(11, "PM")).toBe(23);
  });

  it("should keep 12 PM as 12", () => {
    const { convert12To24 } = useTimePicker();
    expect(convert12To24(12, "PM")).toBe(12);
  });

  it("should convert 12 AM to 0", () => {
    const { convert12To24 } = useTimePicker();
    expect(convert12To24(12, "AM")).toBe(0);
  });

  it("should keep AM hours unchanged", () => {
    const { convert12To24 } = useTimePicker();
    expect(convert12To24(9, "AM")).toBe(9);
    expect(convert12To24(11, "AM")).toBe(11);
  });

  it("should convert 24h to 12h", () => {
    const { convert24To12 } = useTimePicker();
    expect(convert24To12(0)).toEqual({ hour: 12, amPm: "AM" });
    expect(convert24To12(12)).toEqual({ hour: 12, amPm: "PM" });
    expect(convert24To12(13)).toEqual({ hour: 1, amPm: "PM" });
    expect(convert24To12(9)).toEqual({ hour: 9, amPm: "AM" });
  });

  it("should add minutes correctly", () => {
    const { addMinutes } = useTimePicker();
    expect(addMinutes(10, 30, "AM", 15)).toEqual({
      hour: 10,
      minute: 45,
      amPm: "AM",
    });
    expect(addMinutes(11, 50, "AM", 20)).toEqual({
      hour: 12,
      minute: 10,
      amPm: "PM",
    });
  });

  it("should subtract minutes correctly", () => {
    const { subtractMinutes } = useTimePicker();
    expect(subtractMinutes(10, 30, "AM", 15)).toEqual({
      hour: 10,
      minute: 15,
      amPm: "AM",
    });
    expect(subtractMinutes(12, 10, "PM", 20)).toEqual({
      hour: 11,
      minute: 50,
      amPm: "AM",
    });
  });

  it("should wrap to previous day when subtractMinutes goes negative hour", () => {
    const { subtractMinutes } = useTimePicker();
    const result = subtractMinutes(12, 0, "AM", 60);
    expect(result.hour).toBe(11);
    expect(result.amPm).toBe("PM");
    expect(Math.abs(result.minute)).toBe(0);
  });

  it("should hit newMinute < 0 when subtractMinutes crosses minute boundary", () => {
    const { subtractMinutes } = useTimePicker();
    const result = subtractMinutes(12, 0, "AM", 61);
    expect(result.hour).toBe(9);
    expect(result.minute).toBe(59);
    expect(result.amPm).toBe("PM");
  });

  it("should get time in minutes", () => {
    const { getTimeInMinutes } = useTimePicker();
    expect(getTimeInMinutes(10, 30, "AM")).toBe(630);
    expect(getTimeInMinutes(12, 0, "PM")).toBe(720);
    expect(getTimeInMinutes(12, 0, "AM")).toBe(0);
  });

  it("should compare times with isTimeAfter", () => {
    const { isTimeAfter } = useTimePicker();
    expect(isTimeAfter(11, 0, "AM", 10, 0, "AM")).toBe(true);
    expect(isTimeAfter(10, 0, "AM", 11, 0, "AM")).toBe(false);
    expect(isTimeAfter(10, 30, "AM", 10, 15, "AM")).toBe(true);
  });

  it("should round to nearest 5 minutes", () => {
    const { roundToNearest5Minutes } = useTimePicker();
    expect(roundToNearest5Minutes(12)).toBe(10);
    expect(roundToNearest5Minutes(13)).toBe(15);
    expect(roundToNearest5Minutes(0)).toBe(0);
    expect(roundToNearest5Minutes(58)).toBe(60);
  });

  it("should return current time in 12h format", () => {
    vi.setSystemTime(new Date("2026-01-26T14:32:00Z"));
    const { getCurrentTime12Hour } = useTimePicker();
    const result = getCurrentTime12Hour();
    expect(result).toHaveProperty("hour");
    expect(result).toHaveProperty("minute");
    expect(result).toHaveProperty("amPm");
    expect(["AM", "PM"]).toContain(result.amPm);
    expect(result.hour).toBeGreaterThanOrEqual(1);
    expect(result.hour).toBeLessThanOrEqual(12);
    expect(result.minute).toBeGreaterThanOrEqual(0);
    expect(result.minute).toBeLessThan(60);
  });

  it("should roll minute to 0 and hour when getCurrentTime12Hour minutes round to 60", () => {
    vi.setSystemTime(new Date("2026-01-26T14:59:00Z"));
    const { getCurrentTime12Hour } = useTimePicker();
    const result = getCurrentTime12Hour();
    expect(result.minute).toBe(0);
    expect(result.hour).toBe(3);
    expect(result.amPm).toBe("PM");
  });
});
