import type { CalendarEvent } from "~/types/calendar";
import type { ICalEvent } from "~~/server/integrations/iCal/types";

import { $fetch, url } from "@nuxt/test-utils/e2e";
import { describe, it, expect } from "vitest";

describe("Calendar Recurrence E2E", () => {
  it("should create a recurring event", async () => {
    const start = new Date();
    start.setHours(9, 0, 0, 0);
    const end = new Date(start);
    end.setHours(10, 0, 0, 0);

    const response = await $fetch(url("/api/calendar-events"), {
      method: "POST",
      body: {
        title: "Recurring Daily Event",
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: false,
        ical_event: {
          rrule: {
            freq: "DAILY",
            interval: 1,
          },
        },
      },
    }) as CalendarEvent;

    expect(response).toHaveProperty("id");
    expect(response.ical_event).toBeDefined();
    if (response.ical_event && typeof response.ical_event === "object" && "rrule" in response.ical_event) {
      const icalEvent = response.ical_event as ICalEvent;
      expect(icalEvent.rrule).toBeDefined();
      if (icalEvent.rrule) {
        expect(icalEvent.rrule.freq).toBe("DAILY");
      }
    }
  });

  it("should create a weekly recurring event", async () => {
    const start = new Date();
    start.setHours(14, 0, 0, 0);
    const end = new Date(start);
    end.setHours(15, 0, 0, 0);

    const response = await $fetch(url("/api/calendar-events"), {
      method: "POST",
      body: {
        title: "Weekly Meeting",
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: false,
        ical_event: {
          rrule: {
            freq: "WEEKLY",
            interval: 1,
            byday: ["MO", "WE", "FR"],
          },
        },
      },
    }) as CalendarEvent;

    if (response.ical_event && typeof response.ical_event === "object" && "rrule" in response.ical_event) {
      const icalEvent = response.ical_event as ICalEvent;
      if (icalEvent.rrule) {
        expect(icalEvent.rrule.freq).toBe("WEEKLY");
        if (icalEvent.rrule.byday) {
          expect(icalEvent.rrule.byday).toContain("MO");
          expect(icalEvent.rrule.byday).toContain("WE");
          expect(icalEvent.rrule.byday).toContain("FR");
        }
      }
    }
  });

  it("should edit a recurring event series", async () => {
    const start = new Date();
    start.setHours(10, 0, 0, 0);
    const end = new Date(start);
    end.setHours(11, 0, 0, 0);

    const createResponse = await $fetch(url("/api/calendar-events"), {
      method: "POST",
      body: {
        title: "Original Recurring Event",
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: false,
        ical_event: {
          rrule: {
            freq: "DAILY",
            interval: 1,
          },
        },
      },
    }) as CalendarEvent;

    const updateResponse = await $fetch(url(`/api/calendar-events/${createResponse.id}`), {
      method: "PUT",
      body: {
        title: "Updated Recurring Event",
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: false,
        ical_event: {
          rrule: {
            freq: "DAILY",
            interval: 2,
          },
        },
      },
    }) as CalendarEvent;

    expect(updateResponse.title).toBe("Updated Recurring Event");
    if (updateResponse.ical_event && typeof updateResponse.ical_event === "object" && "rrule" in updateResponse.ical_event) {
      const icalEvent = updateResponse.ical_event as ICalEvent;
      if (icalEvent.rrule) {
        expect(icalEvent.rrule.interval).toBe(2);
      }
    }
  });

  it("should delete a recurring event series", async () => {
    const start = new Date();
    start.setHours(15, 0, 0, 0);
    const end = new Date(start);
    end.setHours(16, 0, 0, 0);

    const createResponse = await $fetch(url("/api/calendar-events"), {
      method: "POST",
      body: {
        title: "Recurring Event to Delete",
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: false,
        ical_event: {
          rrule: {
            freq: "WEEKLY",
            interval: 1,
          },
        },
      },
    }) as CalendarEvent;

    await $fetch(url(`/api/calendar-events/${createResponse.id}`), {
      method: "DELETE" as const,
    });

    const events = await $fetch(url("/api/calendar-events")) as CalendarEvent[];
    const deletedEvent = events.find((e: { id: string }) => e.id === createResponse.id);
    expect(deletedEvent).toBeUndefined();
  });
});
