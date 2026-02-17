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

  it("should parse dates that would shift with UTC parsing", () => {
    const date = parseLocalDate("2026-02-16");
    expect(date.getDate()).toBe(16);
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
});
