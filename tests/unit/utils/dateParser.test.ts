import { describe, expect, it } from "vitest";

import { parseLocalDate } from "../../../app/utils/dateParser";

describe("parseLocalDate", () => {
  it("should parse YYYY-MM-DD as local midnight", () => {
    const date = parseLocalDate("2026-02-16");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(1); // 0-indexed, Feb = 1
    expect(date.getDate()).toBe(16);
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
    expect(date.getSeconds()).toBe(0);
  });

  it("should preserve local date unlike new Date() which parses as UTC", () => {
    // new Date("2026-02-16") creates UTC midnight, which can become
    // Feb 15 in timezones behind UTC. parseLocalDate avoids this.
    const localDate = parseLocalDate("2026-02-16");
    const utcDate = new Date("2026-02-16");

    // parseLocalDate always gives local day 16
    expect(localDate.getDate()).toBe(16);
    // new Date("YYYY-MM-DD") may give 15 or 16 depending on timezone
    // In UTC+ timezones it's 16, in UTC- timezones it's 15
    expect(localDate.getDate()).toBeGreaterThanOrEqual(utcDate.getDate());
  });

  it("should handle single-digit months and days", () => {
    const date = parseLocalDate("2026-01-05");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(0);
    expect(date.getDate()).toBe(5);
  });

  it("should throw on invalid format", () => {
    expect(() => parseLocalDate("not-a-date")).toThrow();
    expect(() => parseLocalDate("2026-13-01")).toThrow();
    expect(() => parseLocalDate("2026-00-01")).toThrow();
    expect(() => parseLocalDate("2026-02-00")).toThrow();
    expect(() => parseLocalDate("")).toThrow();
  });

  it("should allow JS Date rollover for invalid day-of-month", () => {
    // API dates are always valid, so we accept JS rollover behavior
    // rather than adding complex month-length validation.
    // Feb 30 rolls to Mar 2 (non-leap year)
    const date = parseLocalDate("2026-02-30");
    expect(date.getMonth()).toBe(2); // March (0-indexed)
    expect(date.getDate()).toBe(2);
  });
});
