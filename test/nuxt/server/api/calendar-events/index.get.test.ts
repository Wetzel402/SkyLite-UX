import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import handler from "~~/server/api/calendar-events/index.get";

import type { ICalEvent } from "~~/server/integrations/iCal/types";

const { defineEventHandler } = useH3TestUtils();

vi.mock("~/lib/prisma");

describe("gET /api/calendar-events", () => {
  it("is registered as an event handler", () =>
    expect(defineEventHandler).toHaveBeenCalled());

  const createBaseEvent = (overrides = {}) => ({
    id: "event-1",
    title: "Test Event",
    description: "Test Description",
    start: new Date("2025-01-15T10:00:00Z"),
    end: new Date("2025-01-15T11:00:00Z"),
    allDay: false,
    color: null,
    location: null,
    ical_event: null,
    users: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  describe("fetches events successfully", () => {
    it.each([
      {
        name: "without date filters",
        query: {},
        mockEvents: [
          createBaseEvent({ id: "event-1", title: "Event 1" }),
          createBaseEvent({ id: "event-2", title: "Event 2" }),
        ],
      },
      {
        name: "with start and end date filters",
        query: {
          start: "2025-01-01T00:00:00Z",
          end: "2025-12-31T23:59:59Z",
        },
        mockEvents: [
          createBaseEvent({ id: "event-1", title: "Event 1" }),
        ],
      },
      {
        name: "with no events",
        query: {},
        mockEvents: [],
      },
    ])("$name", async ({ query, mockEvents }) => {
      prisma.calendarEvent.findMany.mockResolvedValue(mockEvents);

      const event = createMockH3Event({ query });

      const response = await handler(event);

      expect(prisma.calendarEvent.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          title: true,
          description: true,
          start: true,
          end: true,
          allDay: true,
          color: true,
          location: true,
          ical_event: true,
          users: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  avatar: true,
                  color: true,
                },
              },
            },
          },
        },
        orderBy: {
          start: "asc",
        },
      });

      expect(Array.isArray(response)).toBe(true);
    });

    it("returns single event when event has no rrule (non-recurring)", async () => {
      const nonRecurring = createBaseEvent({
        id: "event-single",
        title: "Single Event",
        ical_event: null,
      });

      prisma.calendarEvent.findMany.mockResolvedValue([nonRecurring]);

      const event = createMockH3Event({
        query: {
          start: "2025-01-15T00:00:00Z",
          end: "2025-01-17T23:59:59Z",
        },
      });

      const response = await handler(event);

      expect(Array.isArray(response)).toBe(true);
      expect(response.length).toBe(1);
      expect(response[0].id).toBe("event-single");
    });

    it("expands recurring events within date range", async () => {
      const recurringEvent = createBaseEvent({
        id: "event-recurring",
        title: "Recurring Event",
        ical_event: {
          rrule: {
            freq: "DAILY",
            interval: 1,
          },
        } as ICalEvent,
      });

      prisma.calendarEvent.findMany.mockResolvedValue([recurringEvent]);

      const event = createMockH3Event({
        query: {
          start: "2025-01-15T00:00:00Z",
          end: "2025-01-17T23:59:59Z",
        },
      });

      const response = await handler(event);

      expect(Array.isArray(response)).toBe(true);
      expect(response.length).toBeGreaterThan(1);
    });

    it("returns no occurrences when recurring event is entirely after date range", async () => {
      const recurringEvent = createBaseEvent({
        id: "event-recurring",
        title: "Recurring Event",
        start: new Date("2025-02-01T10:00:00Z"),
        end: new Date("2025-02-01T11:00:00Z"),
        ical_event: {
          rrule: {
            freq: "DAILY",
            interval: 1,
          },
        } as ICalEvent,
      });

      prisma.calendarEvent.findMany.mockResolvedValue([recurringEvent]);

      const event = createMockH3Event({
        query: {
          start: "2025-01-01T00:00:00Z",
          end: "2025-01-15T23:59:59Z",
        },
      });

      const response = await handler(event);

      expect(Array.isArray(response)).toBe(true);
      expect(response.length).toBe(0);
    });

    it("handles invalid date filters gracefully", async () => {
      prisma.calendarEvent.findMany.mockResolvedValue([]);

      const event = createMockH3Event({
        query: {
          start: "invalid-date",
          end: "invalid-date",
        },
      });

      const response = await handler(event);

      expect(Array.isArray(response)).toBe(true);
    });
  });

  describe("error handling", () => {
    it("handles database errors", async () => {
      prisma.calendarEvent.findMany.mockRejectedValue(
        new Error("Database error"),
      );

      const event = createMockH3Event({ query: {} });

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
