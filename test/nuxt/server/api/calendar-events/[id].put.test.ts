import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi, beforeEach } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import handler from "~~/server/api/calendar-events/[id].put";

import type { ICalEvent } from "~~/server/integrations/iCal/types";

const { defineEventHandler } = useH3TestUtils();

vi.mock("~/lib/prisma");

describe("pUT /api/calendar-events/[id]", () => {
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

  const createBaseUpdateBody = () => ({
    title: "Updated Event",
    description: "Updated Description",
    start: "2025-01-16T10:00:00Z",
    end: "2025-01-16T11:00:00Z",
    allDay: false,
  });

  describe("updates event successfully", () => {
    it.each([
      {
        name: "basic update",
        params: { id: "event-1" },
        body: (base: ReturnType<typeof createBaseUpdateBody>) => ({
          ...base,
          title: "Updated Title",
          description: "Updated Description",
        }),
        currentEvent: () => createBaseEvent(),
        expectedUpdate: (
          base: ReturnType<typeof createBaseUpdateBody>,
        ) => ({
          title: "Updated Title",
          description: base.description,
          start: new Date(base.start),
          end: new Date(base.end),
          allDay: base.allDay,
          color: null,
          location: null,
          ical_event: null,
          users: {
            deleteMany: {},
            create: [],
          },
        }),
      },
      {
        name: "update with color and location",
        params: { id: "event-1" },
        body: (base: ReturnType<typeof createBaseUpdateBody>) => ({
          ...base,
          color: "#FF0000",
          location: "New Location",
        }),
        currentEvent: () => createBaseEvent(),
        expectedUpdate: (
          base: ReturnType<typeof createBaseUpdateBody>,
        ) => ({
          title: base.title,
          description: base.description,
          start: new Date(base.start),
          end: new Date(base.end),
          allDay: base.allDay,
          color: "#FF0000",
          location: "New Location",
          ical_event: null,
          users: {
            deleteMany: {},
            create: [],
          },
        }),
      },
      {
        name: "update to all-day event",
        params: { id: "event-1" },
        body: (base: ReturnType<typeof createBaseUpdateBody>) => ({
          ...base,
          allDay: true,
          start: "2025-01-16T00:00:00Z",
          end: "2025-01-17T00:00:00Z",
        }),
        currentEvent: () => createBaseEvent(),
        expectedUpdate: (
          base: ReturnType<typeof createBaseUpdateBody>,
        ) => ({
          title: base.title,
          description: base.description,
          start: new Date("2025-01-16T00:00:00Z"),
          end: new Date("2025-01-17T00:00:00Z"),
          allDay: true,
          color: null,
          location: null,
          ical_event: null,
          users: {
            deleteMany: {},
            create: [],
          },
        }),
      },
      {
        name: "update with users",
        params: { id: "event-1" },
        body: (base: ReturnType<typeof createBaseUpdateBody>) => ({
          ...base,
          users: [{ id: "user-1" }, { id: "user-2" }],
        }),
        currentEvent: () => createBaseEvent(),
        expectedUpdate: (
          base: ReturnType<typeof createBaseUpdateBody>,
        ) => ({
          title: base.title,
          description: base.description,
          start: new Date(base.start),
          end: new Date(base.end),
          allDay: base.allDay,
          color: null,
          location: null,
          ical_event: null,
          users: {
            deleteMany: {},
            create: [{ userId: "user-1" }, { userId: "user-2" }],
          },
        }),
      },
      {
        name: "update recurring event series",
        params: { id: "event-1" },
        body: (base: ReturnType<typeof createBaseUpdateBody>) => ({
          ...base,
          ical_event: {
            rrule: {
              freq: "WEEKLY",
              interval: 1,
            },
          } as ICalEvent,
        }),
        currentEvent: () => createBaseEvent(),
        expectedUpdate: (
          base: ReturnType<typeof createBaseUpdateBody>,
        ) => ({
          title: base.title,
          description: base.description,
          start: new Date(base.start),
          end: new Date(base.end),
          allDay: base.allDay,
          color: null,
          location: null,
          ical_event: {
            rrule: {
              freq: "WEEKLY",
              interval: 1,
            },
          } as ICalEvent,
          users: {
            deleteMany: {},
            create: [],
          },
        }),
      },
    ])(
      "$name",
      async ({ params, body, currentEvent, expectedUpdate }) => {
        const requestBody = body(createBaseUpdateBody()) as {
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
        const mockCurrentEvent = currentEvent();
        const expectedUpdateData = expectedUpdate(createBaseUpdateBody());

        const mockResponse = {
          ...mockCurrentEvent,
          ...expectedUpdateData,
          users: requestBody.users?.map((u: { id: string }) => ({
            user: {
              id: u.id,
              name: "Test User",
              avatar: null,
              color: null,
            },
          })) || [],
        };

        prisma.calendarEvent.update.mockResolvedValue(mockResponse);

        const event = createMockH3Event({
          params,
          body: requestBody,
        });

        const response = await handler(event);

        expect(prisma.calendarEvent.update).toHaveBeenCalledWith({
          where: { id: params.id },
          data: expectedUpdateData,
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
        expect(response.title).toBe(requestBody.title);
      },
    );
  });

  describe("error handling", () => {
    it("throws 400 when id is missing", async () => {
      const event = createMockH3Event({
        params: {},
        body: createBaseUpdateBody(),
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("handles database errors", async () => {
      prisma.calendarEvent.update.mockRejectedValue(
        new Error("Database error"),
      );

      const event = createMockH3Event({
        params: { id: "event-1" },
        body: createBaseUpdateBody(),
      });

      await expect(handler(event)).rejects.toThrow();
    });
  });

  describe("timezone", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should handle event updates across timezone changes", async () => {
      const event = createMockH3Event({
        method: "PUT",
        body: {
          title: "Updated Event",
          start: "2025-01-15T14:00:00Z",
          end: "2025-01-15T15:00:00Z",
          allDay: false,
        },
        params: { id: "event-1" },
      });

      prisma.calendarEvent.findUnique.mockResolvedValue({
        id: "event-1",
        title: "Original Event",
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

      prisma.calendarEvent.update.mockResolvedValue({
        id: "event-1",
        title: "Updated Event",
        description: null,
        start: new Date("2025-01-15T14:00:00Z"),
        end: new Date("2025-01-15T15:00:00Z"),
        allDay: false,
        color: null,
        location: null,
        ical_event: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await handler(event);
      expect(result.title).toBe("Updated Event");
    });
  });
});
