import { $fetch, url } from "@nuxt/test-utils/e2e";
import { describe, it, expect } from "vitest";

import type { CalendarEventResponse } from "../../types/e2e";

describe("Calendar Events E2E", () => {
  it("should navigate to calendar page", async () => {
    const html = await $fetch(url("/calendar"));
    expect(html).toContain("Calendar");
  });

  it("should create a calendar event", async () => {
    const start = new Date();
    start.setHours(10, 0, 0, 0);
    const end = new Date(start);
    end.setHours(11, 0, 0, 0);

    const response = await $fetch(url("/api/calendar-events"), {
      method: "POST",
      body: {
        title: "E2E Test Event",
        description: "Created by e2e test",
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: false,
      },
    }) as CalendarEventResponse;

    expect(response).toHaveProperty("id");
    expect(response.title).toBe("E2E Test Event");
    expect(response.allDay).toBe(false);
  });

  it("should create an all-day event", async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const response = await $fetch(url("/api/calendar-events"), {
      method: "POST",
      body: {
        title: "All Day Event",
        start: today.toISOString(),
        end: tomorrow.toISOString(),
        allDay: true,
      },
    }) as CalendarEventResponse;

    expect(response.allDay).toBe(true);
  });

  it("should edit a calendar event", async () => {
    const start = new Date();
    start.setHours(14, 0, 0, 0);
    const end = new Date(start);
    end.setHours(15, 0, 0, 0);

    const createResponse = await $fetch(url("/api/calendar-events"), {
      method: "POST",
      body: {
        title: "Original Event Title",
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: false,
      },
    }) as CalendarEventResponse;

    const updateResponse = await $fetch(url(`/api/calendar-events/${createResponse.id}`), {
      method: "PUT",
      body: {
        title: "Updated Event Title",
        description: "Updated description",
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: false,
      },
    }) as CalendarEventResponse;

    expect(updateResponse.title).toBe("Updated Event Title");
    expect(updateResponse.description).toBe("Updated description");
  });

  it("should delete a calendar event", async () => {
    const start = new Date();
    start.setHours(16, 0, 0, 0);
    const end = new Date(start);
    end.setHours(17, 0, 0, 0);

    const createResponse = await $fetch(url("/api/calendar-events"), {
      method: "POST",
      body: {
        title: "Event to Delete",
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: false,
      },
    }) as CalendarEventResponse;

    await $fetch(url(`/api/calendar-events/${createResponse.id}`), {
      method: "DELETE",
    });

    const events = await $fetch(url("/api/calendar-events")) as CalendarEventResponse[];
    const deletedEvent = events.find((e) => e.id === createResponse.id);
    expect(deletedEvent).toBeUndefined();
  });

  it("should view calendar in month view", async () => {
    const html = await $fetch(url("/calendar?view=month"));
    expect(html).toContain("Calendar");
  });

  it("should view calendar in week view", async () => {
    const html = await $fetch(url("/calendar?view=week"));
    expect(html).toContain("Calendar");
  });

  it("should view calendar in day view", async () => {
    const html = await $fetch(url("/calendar?view=day"));
    expect(html).toContain("Calendar");
  });

  it("should view calendar in agenda view", async () => {
    const html = await $fetch(url("/calendar?view=agenda"));
    expect(html).toContain("Calendar");
  });
});
