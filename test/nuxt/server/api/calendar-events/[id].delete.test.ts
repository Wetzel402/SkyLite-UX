import type { CalendarEvent } from "@prisma/client";

import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import handler from "~~/server/api/calendar-events/[id].delete";

const { defineEventHandler } = useH3TestUtils();

vi.mock("~/lib/prisma");

describe("dELETE /api/calendar-events/[id]", () => {
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

  describe("deletes event successfully", () => {
    it.each([
      {
        name: "single event",
        params: { id: "event-1" },
        mockEvent: createBaseEvent(),
        expectExpanded: false,
      },
      {
        name: "recurring event series (expanded ID)",
        params: { id: "event-1-20250115T100000Z" },
        mockEvent: createBaseEvent(),
        expectExpanded: true,
      },
    ])("$name", async ({ params, mockEvent, expectExpanded }) => {
      prisma.calendarEvent.findUnique.mockResolvedValue(mockEvent);
      prisma.calendarEvent.delete.mockResolvedValue(mockEvent);

      const event = createMockH3Event({
        params,
      });

      const response = await handler(event);

      const actualId = expectExpanded ? params.id.split("-")[0] : params.id;

      expect(prisma.calendarEvent.findUnique).toHaveBeenCalledWith({
        where: { id: actualId },
      });

      expect(prisma.calendarEvent.delete).toHaveBeenCalledWith({
        where: { id: actualId },
      });

      expect(response).toEqual({
        success: true,
        message: expectExpanded
          ? "Entire recurring series deleted"
          : "Event deleted successfully",
      });
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
      prisma.calendarEvent.findUnique.mockResolvedValue(createBaseEvent());
      prisma.calendarEvent.delete.mockRejectedValue(
        new Error("Database error"),
      );

      const event = createMockH3Event({
        params: { id: "event-1" },
      });

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
