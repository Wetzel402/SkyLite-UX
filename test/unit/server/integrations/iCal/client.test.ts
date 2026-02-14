import { describe, it, expect, vi, beforeEach } from "vitest";
import ical from "ical.js";
import { ICalServerService } from "../../../../../server/integrations/iCal/client";

const minimalIcalOneEvent = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//test//EN",
  "BEGIN:VEVENT",
  "UID:event-1",
  "SUMMARY:Single Event",
  "DTSTART:20250115T100000Z",
  "DTEND:20250115T110000Z",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

const minimalIcalWithRrule = (() => {
  const now = new Date();
  const start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const dtstart = start.toISOString().slice(0, 10).replace(/-/g, "") + "T100000Z";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//test//EN",
    "BEGIN:VEVENT",
    "UID:recur-1",
    "SUMMARY:Daily Event",
    `DTSTART:${dtstart}`,
    "RRULE:FREQ=DAILY;INTERVAL=1;COUNT=5",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
})();

describe("ICalServerService", () => {
  let service: ICalServerService;

  beforeEach(() => {
    service = new ICalServerService("test-integration", "https://example.com/calendar.ics");
    vi.clearAllMocks();
  });

  it("should parse iCal event with timezone data (TZID property)", () => {
    const vevent = new ical.Component(["vevent", [], []]);
    vevent.addPropertyWithValue("uid", "test-event-1");
    vevent.addPropertyWithValue("summary", "Test Event");
    vevent.addPropertyWithValue("dtstart", ical.Time.fromData({
      year: 2025,
      month: 1,
      day: 15,
      hour: 10,
      minute: 0,
      second: 0,
      zone: ical.TimezoneService.get("America/New_York"),
    }));

    const parsed = service["parseICalEvent"](vevent);
    expect(parsed).toBeDefined();
    expect(parsed.dtstart).toBeDefined();
  });

  it("should convert iCal timezone to UTC", () => {
    const vevent = new ical.Component(["vevent", [], []]);
    vevent.addPropertyWithValue("uid", "test-event-2");
    vevent.addPropertyWithValue("summary", "Test Event");
    const dtstart = ical.Time.fromData({
      year: 2025,
      month: 1,
      day: 15,
      hour: 10,
      minute: 0,
      second: 0,
      zone: ical.TimezoneService.get("America/New_York"),
    });
    vevent.addPropertyWithValue("dtstart", dtstart);

    const parsed = service["parseICalEvent"](vevent);
    const utcDate = new Date(parsed.dtstart);
    expect(utcDate).toBeInstanceOf(Date);
  });

  it("should detect all-day event (DATE vs DATETIME)", () => {
    const vevent = new ical.Component(["vevent", [], []]);
    vevent.addPropertyWithValue("uid", "test-event-3");
    vevent.addPropertyWithValue("summary", "All Day Event");
    vevent.addPropertyWithValue("dtstart", ical.Time.fromData({
      year: 2025,
      month: 1,
      day: 15,
      isDate: true,
    }));

    const parsed = service["parseICalEvent"](vevent);
    expect(parsed).toBeDefined();
  });

  it("should set dtend to start of next day when all-day event has no DTEND (RFC 5545)", () => {
    const vevent = new ical.Component(["vevent", [], []]);
    vevent.addPropertyWithValue("uid", "test-event-all-day-no-dtend");
    vevent.addPropertyWithValue("summary", "Weather Forecast Feb 5");
    vevent.addPropertyWithValue("dtstart", ical.Time.fromData({
      year: 2026,
      month: 2,
      day: 5,
      isDate: true,
    }));

    const parsed = service["parseICalEvent"](vevent);
    expect(parsed).toBeDefined();
    expect(parsed.dtstart).toBeDefined();
    expect(parsed.dtend).toBeDefined();

    const startDate = new Date(parsed.dtstart);
    const endDate = new Date(parsed.dtend);

    expect(startDate.getUTCFullYear()).toBe(2026);
    expect(startDate.getUTCMonth()).toBe(1);
    expect(startDate.getUTCDate()).toBe(5);
    expect(startDate.getUTCHours()).toBe(0);
    expect(startDate.getUTCMinutes()).toBe(0);
    expect(startDate.getUTCSeconds()).toBe(0);

    expect(endDate.getUTCFullYear()).toBe(2026);
    expect(endDate.getUTCMonth()).toBe(1);
    expect(endDate.getUTCDate()).toBe(6);
    expect(endDate.getUTCHours()).toBe(0);
    expect(endDate.getUTCMinutes()).toBe(0);
    expect(endDate.getUTCSeconds()).toBe(0);
  });

  it("should detect midnight-to-midnight boundary for all-day events", () => {
    const vevent = new ical.Component(["vevent", [], []]);
    vevent.addPropertyWithValue("uid", "test-event-4");
    vevent.addPropertyWithValue("summary", "Midnight Event");
    vevent.addPropertyWithValue("dtstart", ical.Time.fromData({
      year: 2025,
      month: 1,
      day: 15,
      hour: 0,
      minute: 0,
      second: 0,
      zone: ical.TimezoneService.get("UTC"),
    }));
    vevent.addPropertyWithValue("dtend", ical.Time.fromData({
      year: 2025,
      month: 1,
      day: 16,
      hour: 0,
      minute: 0,
      second: 0,
      zone: ical.TimezoneService.get("UTC"),
    }));

    const parsed = service["parseICalEvent"](vevent);
    expect(parsed).toBeDefined();
  });

  it("should parse all-day event on DST spring-forward day", () => {
    const vevent = new ical.Component(["vevent", [], []]);
    vevent.addPropertyWithValue("uid", "test-event-dst-all-day");
    vevent.addPropertyWithValue("summary", "All Day on DST Spring Forward");
    vevent.addPropertyWithValue("dtstart", ical.Time.fromData({
      year: 2025,
      month: 3,
      day: 9,
      isDate: true,
      zone: ical.TimezoneService.get("America/New_York"),
    }));

    const parsed = service["parseICalEvent"](vevent);
    expect(parsed).toBeDefined();
    expect(parsed.dtstart).toBeDefined();
    const parsedDate = new Date(parsed.dtstart);
    expect(parsedDate.getUTCDate()).toBe(9);
    expect(parsedDate.getUTCMonth()).toBe(2);
    expect(parsedDate.getUTCFullYear()).toBe(2025);
  });

  it("should parse recurring iCal events with timezone information", () => {
    const vevent = new ical.Component(["vevent", [], []]);
    vevent.addPropertyWithValue("uid", "test-event-5");
    vevent.addPropertyWithValue("summary", "Recurring Event");
    vevent.addPropertyWithValue("dtstart", ical.Time.fromData({
      year: 2025,
      month: 1,
      day: 15,
      hour: 10,
      minute: 0,
      second: 0,
      zone: ical.TimezoneService.get("Europe/London"),
    }));
    vevent.addPropertyWithValue("rrule", {
      freq: "DAILY",
      interval: 1,
    });

    const parsed = service["parseICalEvent"](vevent);
    expect(parsed.rrule).toBeDefined();
    expect(parsed.rrule?.freq).toBe("DAILY");
  });

  it("should handle invalid or missing timezone data gracefully", () => {
    const vevent = new ical.Component(["vevent", [], []]);
    vevent.addPropertyWithValue("uid", "test-event-6");
    vevent.addPropertyWithValue("summary", "Event Without Timezone");
    vevent.addPropertyWithValue("dtstart", ical.Time.fromData({
      year: 2025,
      month: 1,
      day: 15,
      hour: 10,
      minute: 0,
      second: 0,
      zone: ical.TimezoneService.get("UTC"),
    }));

    const parsed = service["parseICalEvent"](vevent);
    expect(parsed).toBeDefined();
    expect(parsed.dtstart).toBeDefined();
  });

  it("should handle DST transitions in iCal events", () => {
    const vevent = new ical.Component(["vevent", [], []]);
    vevent.addPropertyWithValue("uid", "test-event-7");
    vevent.addPropertyWithValue("summary", "DST Event");
    const dtstart = ical.Time.fromData({
      year: 2025,
      month: 3,
      day: 9,
      hour: 2,
      minute: 30,
      second: 0,
      zone: ical.TimezoneService.get("America/New_York"),
    });
    vevent.addPropertyWithValue("dtstart", dtstart);

    const parsed = service["parseICalEvent"](vevent);
    expect(parsed).toBeDefined();
    expect(parsed.dtstart).toBeDefined();
  });

  it("should convert events from different timezones correctly", () => {
    const timezones = ["UTC", "America/New_York", "Europe/London", "Asia/Tokyo"];

    for (const tz of timezones) {
      const vevent = new ical.Component(["vevent", [], []]);
      vevent.addPropertyWithValue("uid", `test-event-${tz}`);
      vevent.addPropertyWithValue("summary", `Event in ${tz}`);
      vevent.addPropertyWithValue("dtstart", ical.Time.fromData({
        year: 2025,
        month: 1,
        day: 15,
        hour: 10,
        minute: 0,
        second: 0,
        zone: ical.TimezoneService.get(tz),
      }));

      const parsed = service["parseICalEvent"](vevent);
      expect(parsed).toBeDefined();
      expect(parsed.dtstart).toBeDefined();
    }
  });

  describe("fetchEventsFromUrl", () => {
    it("returns one event when iCal has one VEVENT without RRULE", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(minimalIcalOneEvent),
      });
      vi.stubGlobal("fetch", fetchMock);

      const events = await service.fetchEventsFromUrl("https://example.com/cal.ics");

      expect(fetchMock).toHaveBeenCalledWith("https://example.com/cal.ics");
      expect(events).toHaveLength(1);
      const [e] = events;
      expect(e?.uid).toBe("event-1");
      expect(e?.summary).toBe("Single Event");
      expect(e?.dtstart).toBeDefined();
      expect(e?.dtend).toBeDefined();
      expect(e?.type).toBe("VEVENT");
    });

    it("returns multiple occurrences when iCal has one VEVENT with RRULE (daily)", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(minimalIcalWithRrule),
      });
      vi.stubGlobal("fetch", fetchMock);

      const events = await service.fetchEventsFromUrl("https://example.com/cal.ics");

      expect(fetchMock).toHaveBeenCalledWith("https://example.com/cal.ics");
      expect(events.length).toBeGreaterThan(1);
      expect(events.every(e => e.type === "VEVENT")).toBe(true);
      expect(events.every(e => e.summary === "Daily Event")).toBe(true);
      const start = new Date(2025, 0, 1);
      const end = new Date(2027, 11, 31);
      for (const e of events) {
        const d = new Date(e.dtstart);
        expect(d >= start && d <= end).toBe(true);
      }
    });
  });
});
