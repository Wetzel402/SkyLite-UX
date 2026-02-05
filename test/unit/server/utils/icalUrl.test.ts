import { describe, expect, it } from "vitest";

import { normalizeWebcalUrl } from "../../../../server/utils/icalUrl";

describe("normalizeWebcalUrl", () => {
  it("converts webcal:// to http://", () => {
    expect(normalizeWebcalUrl("webcal://example.com/calendar.ics")).toBe("http://example.com/calendar.ics");
  });

  it("converts webcals:// to https://", () => {
    expect(normalizeWebcalUrl("webcals://example.com/calendar.ics")).toBe("https://example.com/calendar.ics");
  });

  it("handles WEBCAL:// case insensitively", () => {
    expect(normalizeWebcalUrl("WEBCAL://example.com/cal.ics")).toBe("http://example.com/cal.ics");
  });

  it("handles WEBCALS:// case insensitively", () => {
    expect(normalizeWebcalUrl("WEBCALS://example.com/cal.ics")).toBe("https://example.com/cal.ics");
  });

  it("leaves https:// unchanged", () => {
    expect(normalizeWebcalUrl("https://example.com/calendar.ics")).toBe("https://example.com/calendar.ics");
  });

  it("leaves http:// unchanged", () => {
    expect(normalizeWebcalUrl("http://example.com/calendar.ics")).toBe("http://example.com/calendar.ics");
  });

  it("returns empty string as-is", () => {
    expect(normalizeWebcalUrl("")).toBe("");
  });

  it("returns non-string input as-is", () => {
    expect(normalizeWebcalUrl(null as unknown as string)).toBe(null);
    expect(normalizeWebcalUrl(undefined as unknown as string)).toBe(undefined);
  });
});
