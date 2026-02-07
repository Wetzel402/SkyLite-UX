import type { CalendarEvent } from "@prisma/client";

import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import handler from "~~/server/api/calendar-events/[id].get";

const { defineEventHandler } = useH3TestUtils();

vi.mock("~/lib/prisma");

describe("gET /api/calendar-events/[id]", () => {
  it("is registered as an event handler", () =>
    expect(defineEventHandler).toHaveBeenCalled());

  const createBaseEvent = (overrides = {}): CalendarEvent => ({
    id: "event-1",
    title: "Test Event",
    description: "Test Description",
    start: new Date("2025-01-15T10:00:00Z"),
    end: new Date("2025-01-15T11:00:00Z"),
    allDay: false,
    color: null,
    location: null,
    ical_event: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as CalendarEvent);

  describe("fetches event successfully", () => {
    it("retrieves single event", async () => {
      const mockEvent = createBaseEvent({
        users: [
          {
            user: {
              id: "user-1",
              name: "Test User",
              avatar: null,
              color: null,
            },
          },
        ],
      });

      prisma.calendarEvent.findUnique.mockResolvedValue(mockEvent);

      const event = createMockH3Event({
        params: { id: "event-1" },
      });

      const response = await handler(event);

      expect(prisma.calendarEvent.findUnique).toHaveBeenCalledWith({
        where: { id: "event-1" },
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
      });

      const mockEventWithUsers = mockEvent as typeof mockEvent & {
        users: Array<{ user: { id: string; name: string; avatar: string | null; color: string | null } }>;
      };

      expect(response).toEqual({
        id: mockEventWithUsers.id,
        title: mockEventWithUsers.title,
        description: mockEventWithUsers.description,
        start: mockEventWithUsers.start,
        end: mockEventWithUsers.end,
        allDay: mockEventWithUsers.allDay,
        color: mockEventWithUsers.color,
        location: mockEventWithUsers.location,
        ical_event: mockEventWithUsers.ical_event,
        users: mockEventWithUsers.users.map((ce) => ce.user),
      });
    });

    it("retrieves recurring event", async () => {
      const mockEvent = createBaseEvent({
        ical_event: {
          rrule: {
            freq: "DAILY",
            interval: 1,
          },
        },
      });

      prisma.calendarEvent.findUnique.mockResolvedValue(mockEvent);

      const event = createMockH3Event({
        params: { id: "event-1" },
      });

      const response = await handler(event);

      expect(response.ical_event).toBeDefined();
    });
  });

  describe("error handling", () => {
    it("throws 400 when id is missing", async () => {
      const event = createMockH3Event({
        params: {},
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 404 when event not found", async () => {
      prisma.calendarEvent.findUnique.mockResolvedValue(null);

      const event = createMockH3Event({
        params: { id: "nonexistent" },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("handles database errors", async () => {
      prisma.calendarEvent.findUnique.mockRejectedValue(
        new Error("Database error"),
      );

      const event = createMockH3Event({
        params: { id: "event-1" },
      });

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
