import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";

const { mockUseState, stableDateRef } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref } = require("vue");
  const r = ref(new Date("2026-01-26T12:00:00Z"));
  return {
    stableDateRef: r,
    mockUseState: vi.fn((_key: string, init?: () => Date) => {
      if (init) {
        r.value = init();
      }
      return r;
    }),
  };
});

mockNuxtImport("useState", () => mockUseState);

import { useStableDate } from "../../../../app/composables/useStableDate";

describe("useStableDate", () => {
  beforeEach(() => {
    stableDateRef.value = new Date("2026-01-26T12:00:00Z");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return stable date from getStableDate", () => {
    const { getStableDate } = useStableDate();
    expect(getStableDate()).toEqual(stableDateRef.value);
  });

  it("should return fallback when parseStableDate receives undefined", () => {
    const fallback = new Date("2025-06-15");
    const { parseStableDate } = useStableDate();
    expect(parseStableDate(undefined, fallback)).toEqual(fallback);
  });

  it("should return stableDate when parseStableDate receives undefined and no fallback", () => {
    const { parseStableDate } = useStableDate();
    expect(parseStableDate(undefined)).toEqual(stableDateRef.value);
  });

  it("should return Date unchanged when parseStableDate receives Date", () => {
    const d = new Date("2025-03-10");
    const { parseStableDate } = useStableDate();
    expect(parseStableDate(d)).toBe(d);
  });

  it("should parse ISO string with T and Z", () => {
    const { parseStableDate } = useStableDate();
    const result = parseStableDate("2025-07-20T14:30:00Z");
    expect(result).toEqual(new Date("2025-07-20T14:30:00Z"));
  });

  it("should parse date string without T and Z", () => {
    const { parseStableDate } = useStableDate();
    const result = parseStableDate("2025-07-20");
    expect(result).toEqual(new Date("2025-07-20"));
  });

  it("should update stableDate when scheduleNextUpdate timer fires (nextMinutes >= 60)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-26T10:58:00Z"));
    const { getStableDate } = useStableDate();
    const before = getStableDate().getTime();
    vi.advanceTimersByTime(2 * 60 * 1000);
    expect(getStableDate().getTime()).not.toBe(before);
    expect(getStableDate().getUTCHours()).toBe(11);
    expect(getStableDate().getUTCMinutes()).toBe(0);
  });
});
