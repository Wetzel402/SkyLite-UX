import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi, beforeEach } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import handler from "~~/server/api/calendar-events/index.post";

import type { ICalEvent } from "~~/server/integrations/iCal/types";

const { defineEventHandler } = useH3TestUtils();

vi.mock("~/lib/prisma");

describe("pOST /api/calendar-events", () => {
  it("is registered as an event handler", () =>
    expect(defineEventHandler).toHaveBeenCalled());

  const createBaseRequestBody = () => ({
    title: "Test Event",
    description: "Test Description",
    start: "2025-01-15T10:00:00Z",
    end: "2025-01-15T11:00:00Z",
    allDay: false,
  });

  const createBaseExpectedData = () => ({
    title: "Test Event",
    description: "Test Description",
    start: new Date("2025-01-15T10:00:00Z"),
    end: new Date("2025-01-15T11:00:00Z"),
    allDay: false,
    color: null,
    location: null,
    ical_event: null,
    users: {
      create: [],
    },
  });

  describe("creates event successfully", () => {
    it.each([
      {
        name: "single timed event",
        requestBody: (base: ReturnType<typeof createBaseRequestBody>) => base,
        expectedData: (base: ReturnType<typeof createBaseExpectedData>) => base,
      },
      {
        name: "all-day event",
        requestBody: (base: ReturnType<typeof createBaseRequestBody>) => ({
          ...base,
          allDay: true,
          start: "2025-01-15T00:00:00Z",
          end: "2025-01-16T00:00:00Z",
        }),
        expectedData: (base: ReturnType<typeof createBaseExpectedData>) => ({
          ...base,
          allDay: true,
          start: new Date("2025-01-15T00:00:00Z"),
          end: new Date("2025-01-16T00:00:00Z"),
        }),
      },
      {
        name: "event with color and location",
        requestBody: (base: ReturnType<typeof createBaseRequestBody>) => ({
          ...base,
          color: "#FF0000",
          location: "Test Location",
        }),
        expectedData: (base: ReturnType<typeof createBaseExpectedData>) => ({
          ...base,
          color: "#FF0000",
          location: "Test Location",
        }),
      },
      {
        name: "recurring event",
        requestBody: (base: ReturnType<typeof createBaseRequestBody>) => ({
          ...base,
          ical_event: {
            rrule: {
              freq: "DAILY",
              interval: 1,
            },
          } as ICalEvent,
        }),
        expectedData: (base: ReturnType<typeof createBaseExpectedData>) => ({
          ...base,
          ical_event: {
            rrule: {
              freq: "DAILY",
              interval: 1,
            },
          } as ICalEvent,
        }),
      },
      {
        name: "event with users",
        requestBody: (base: ReturnType<typeof createBaseRequestBody>) => ({
          ...base,
          users: [{ id: "user-1" }, { id: "user-2" }],
        }),
        expectedData: (base: ReturnType<typeof createBaseExpectedData>) => ({
          ...base,
          users: {
            create: [{ userId: "user-1" }, { userId: "user-2" }],
          },
        }),
      },
    ])("$name", async ({ requestBody, expectedData }) => {
      const request = requestBody(createBaseRequestBody()) as {
        title: string;
        description: string;
        start: string;
        end: string;
        allDay: boolean;
        color?: string;
        location?: string;
        ical_event?: ICalEvent;
        users?: Array<{ id: string }>;
      };
      const expectedEventData = expectedData(createBaseExpectedData());

      const mockEventResponse = {
        id: "event-123",
        ...expectedEventData,
        users: request.users?.map((u: { id: string }) => ({
          user: {
            id: u.id,
            name: "Test User",
            avatar: null,
            color: null,
          },
        })) || [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.calendarEvent.create.mockResolvedValue(mockEventResponse);

      const event = createMockH3Event({
        body: request,
      });

      const response = await handler(event);

      expect(prisma.calendarEvent.create).toHaveBeenCalledWith({
        data: expectedEventData,
        include: {
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
      });

      expect(response).toHaveProperty("id");
      expect(response.title).toBe(request.title);
    });
  });

  describe("error handling", () => {
    it("handles database errors", async () => {
      prisma.calendarEvent.create.mockRejectedValue(
        new Error("Database error"),
      );

      const event = createMockH3Event({
        body: createBaseRequestBody(),
      });

      await expect(handler(event)).rejects.toThrow();
    });
  });

  describe("timezone", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should create calendar event with UTC timezone", async () => {
      const event = createMockH3Event({
        method: "POST",
        body: {
          title: "UTC Event",
          start: "2025-01-15T10:00:00Z",
          end: "2025-01-15T11:00:00Z",
          allDay: false,
        },
      });

      prisma.calendarEvent.create.mockResolvedValue({
        id: "event-1",
        title: "UTC Event",
        description: null,
        start: new Date("2025-01-15T10:00:00Z"),
        end: new Date("2025-01-15T11:00:00Z"),
        allDay: false,
        color: null,
        location: null,
        ical_event: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await handler(event);
      expect(result).toBeDefined();
      expect(result.title).toBe("UTC Event");
    });

    it("should create all-day event stored as UTC midnight", async () => {
      const event = createMockH3Event({
        method: "POST",
        body: {
          title: "All Day Event",
          start: "2025-01-15T00:00:00Z",
          end: "2025-01-16T00:00:00Z",
          allDay: true,
        },
      });

      prisma.calendarEvent.create.mockResolvedValue({
        id: "event-2",
        title: "All Day Event",
        description: null,
        start: new Date("2025-01-15T00:00:00Z"),
        end: new Date("2025-01-16T00:00:00Z"),
        allDay: true,
        color: null,
        location: null,
        ical_event: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await handler(event);
      expect(result.allDay).toBe(true);
      expect(result.start.getUTCHours()).toBe(0);
      expect(result.start.getUTCMinutes()).toBe(0);
    });

    it("should convert timed event from local to UTC", async () => {
      const event = createMockH3Event({
        method: "POST",
        body: {
          title: "Local Time Event",
          start: "2025-01-15T10:00:00-05:00",
          end: "2025-01-15T11:00:00-05:00",
          allDay: false,
        },
      });

      prisma.calendarEvent.create.mockResolvedValue({
        id: "event-3",
        title: "Local Time Event",
        description: null,
        start: new Date("2025-01-15T15:00:00Z"),
        end: new Date("2025-01-15T16:00:00Z"),
        allDay: false,
        color: null,
        location: null,
        ical_event: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await handler(event);
      expect(result).toBeDefined();
    });

    it("should create recurring event with timezone data", async () => {
      const event = createMockH3Event({
        method: "POST",
        body: {
          title: "Recurring Event",
          start: "2025-01-15T10:00:00Z",
          end: "2025-01-15T11:00:00Z",
          allDay: false,
          ical_event: {
            rrule: {
              freq: "DAILY",
              interval: 1,
            },
          },
        },
      });

      prisma.calendarEvent.create.mockResolvedValue({
        id: "event-4",
        title: "Recurring Event",
        description: null,
        start: new Date("2025-01-15T10:00:00Z"),
        end: new Date("2025-01-15T11:00:00Z"),
        allDay: false,
        color: null,
        location: null,
        ical_event: {
          rrule: {
            freq: "DAILY",
            interval: 1,
          },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await handler(event);
      expect(result.ical_event).toBeDefined();
      if (result.ical_event && typeof result.ical_event === "object" && "rrule" in result.ical_event) {
        const icalEvent = result.ical_event as { rrule: { freq: string } };
        expect(icalEvent.rrule.freq).toBe("DAILY");
      }
    });
  });
});
