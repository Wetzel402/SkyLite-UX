import type { H3Event } from "h3";

import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import { isGoogleApiError } from "~/types/errors";
import { GoogleCalendarServerService } from "~~/server/integrations/google_calendar/client";
import { parseRRuleString } from "~~/server/utils/rrule";

const { defineEventHandler, readBody } = useH3TestUtils();

vi.mock("@prisma/client", async () => {
  const actual = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
  return {
    ...actual,
    PrismaClient: vi.fn(() => prisma),
  };
});

vi.mock("h3", async () => {
  const actual = await vi.importActual("h3");
  return {
    ...actual,
    readBody: vi.fn((event: H3Event) => {
      if (event?._requestBody) {
        return Promise.resolve(event._requestBody);
      }
      return Promise.resolve({});
    }),
  };
});

vi.mock("ical.js", () => ({
  default: {
    Time: {
      fromJSDate: vi.fn((date: Date, useUTC: boolean) => ({
        toString: () => `20250126T120000Z`,
      })),
    },
  },
}));

vi.mock("~~/server/utils/rrule", () => ({
  parseRRuleString: vi.fn(),
}));

vi.mock("~/types/errors", () => ({
  isGoogleApiError: vi.fn((error: unknown) => {
    return typeof error === "object" && error !== null && "code" in error;
  }),
}));

import handler from "~~/server/api/integrations/google_calendar/events/index.post";

vi.mock("~/lib/prisma");
vi.mock("~~/server/integrations/google_calendar/client");

describe("POST /api/integrations/google_calendar/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createBaseIntegration = () => ({
    id: "integration-1",
    name: "Google Calendar",
    type: "calendar" as const,
    service: "google" as const,
    enabled: true,
    apiKey: "refresh-token",
    baseUrl: null,
    icon: null,
    settings: {
      clientId: "client-id",
      clientSecret: "client-secret",
      accessToken: "access-token",
      tokenExpiry: Date.now() + 3600000,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  describe("response validation", () => {
    it("returns all required response fields", async () => {
      const mockIntegration = createBaseIntegration();
      const mockCreatedEvent = {
        id: "event-123",
        summary: "Test Event",
        description: "Event description",
        start: { dateTime: "2025-01-26T12:00:00Z" },
        end: { dateTime: "2025-01-26T13:00:00Z" },
        location: "Test Location",
        recurrence: undefined,
        status: "confirmed",
        calendarId: "calendar-1",
      };

      const mockService = {
        addEvent: vi.fn().mockResolvedValue(mockCreatedEvent),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
          title: "Test Event",
          description: "Event description",
          start: "2025-01-26T12:00:00Z",
          end: "2025-01-26T13:00:00Z",
          allDay: false,
          location: "Test Location",
        },
      });

      const response = await handler(event);

      expect(response).toHaveProperty("id");
      expect(response).toHaveProperty("title");
      expect(response).toHaveProperty("description");
      expect(response).toHaveProperty("start");
      expect(response).toHaveProperty("end");
      expect(response).toHaveProperty("allDay");
      expect(response).toHaveProperty("location");
      expect(response).toHaveProperty("integrationId");
      expect(response).toHaveProperty("calendarId");
      expect(response).toHaveProperty("ical_event");
    });

    it("converts dates correctly from Google Calendar format", async () => {
      const mockIntegration = createBaseIntegration();
      const mockCreatedEvent = {
        id: "event-123",
        summary: "Test Event",
        description: "",
        start: { dateTime: "2025-01-26T14:30:00Z" },
        end: { dateTime: "2025-01-26T15:45:00Z" },
        location: undefined,
        recurrence: undefined,
        status: "confirmed",
        calendarId: "calendar-1",
      };

      const mockService = {
        addEvent: vi.fn().mockResolvedValue(mockCreatedEvent),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
          title: "Test Event",
          description: "",
          start: "2025-01-26T12:00:00Z",
          end: "2025-01-26T13:00:00Z",
          allDay: false,
        },
      });

      const response = await handler(event);

      expect(response.start).toBeInstanceOf(Date);
      expect(response.end).toBeInstanceOf(Date);
      expect(response.start.getTime()).toBe(new Date("2025-01-26T14:30:00Z").getTime());
      expect(response.end.getTime()).toBe(new Date("2025-01-26T15:45:00Z").getTime());
    });

    it("defaults description to empty string when undefined", async () => {
      const mockIntegration = createBaseIntegration();
      const mockCreatedEvent = {
        id: "event-123",
        summary: "Test Event",
        description: undefined,
        start: { dateTime: "2025-01-26T12:00:00Z" },
        end: { dateTime: "2025-01-26T13:00:00Z" },
        location: undefined,
        recurrence: undefined,
        status: "confirmed",
        calendarId: "calendar-1",
      };

      const mockService = {
        addEvent: vi.fn().mockResolvedValue(mockCreatedEvent),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
          title: "Test Event",
          start: "2025-01-26T12:00:00Z",
          end: "2025-01-26T13:00:00Z",
          allDay: false,
        },
      });

      const response = await handler(event);

      expect(response.description).toBe("");
    });

    it("includes iCal event structure when rrule is present", async () => {
      const mockIntegration = createBaseIntegration();
      const mockRrule = {
        freq: "DAILY",
        interval: 1,
      };
      const mockCreatedEvent = {
        id: "event-123",
        summary: "Recurring Event",
        description: "",
        start: { dateTime: "2025-01-26T12:00:00Z" },
        end: { dateTime: "2025-01-26T13:00:00Z" },
        location: undefined,
        recurrence: ["RRULE:FREQ=DAILY"],
        status: "confirmed",
        calendarId: "calendar-1",
      };

      const mockService = {
        addEvent: vi.fn().mockResolvedValue(mockCreatedEvent),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);
      vi.mocked(parseRRuleString).mockReturnValue(mockRrule);

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
          title: "Recurring Event",
          description: "",
          start: "2025-01-26T12:00:00Z",
          end: "2025-01-26T13:00:00Z",
          allDay: false,
          ical_event: {
            rrule: mockRrule,
          },
        },
      });

      const response = await handler(event);

      expect(response.ical_event).toBeDefined();
      expect(response.ical_event?.type).toBe("VEVENT");
      expect(response.ical_event?.uid).toBe("event-123");
      expect(response.ical_event?.summary).toBe("Recurring Event");
      expect(response.ical_event?.rrule).toEqual(mockRrule);
      expect(response.ical_event?.dtstart).toBeDefined();
      expect(response.ical_event?.dtend).toBeDefined();
    });

    it("returns undefined ical_event when rrule is absent", async () => {
      const mockIntegration = createBaseIntegration();
      const mockCreatedEvent = {
        id: "event-123",
        summary: "Non-Recurring Event",
        description: "",
        start: { dateTime: "2025-01-26T12:00:00Z" },
        end: { dateTime: "2025-01-26T13:00:00Z" },
        location: undefined,
        recurrence: undefined,
        status: "confirmed",
        calendarId: "calendar-1",
      };

      const mockService = {
        addEvent: vi.fn().mockResolvedValue(mockCreatedEvent),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
          title: "Non-Recurring Event",
          description: "",
          start: "2025-01-26T12:00:00Z",
          end: "2025-01-26T13:00:00Z",
          allDay: false,
        },
      });

      const response = await handler(event);

      expect(response.ical_event).toBeUndefined();
    });
  });

  describe("success creation", () => {
    it("creates event successfully", async () => {
      const mockIntegration = createBaseIntegration();
      const mockCreatedEvent = {
        id: "event-123",
        summary: "New Event",
        description: "Event description",
        start: { dateTime: "2025-01-26T12:00:00Z" },
        end: { dateTime: "2025-01-26T13:00:00Z" },
        location: "Test Location",
        recurrence: undefined,
        status: "confirmed",
        calendarId: "calendar-1",
      };

      const mockService = {
        addEvent: vi.fn().mockResolvedValue(mockCreatedEvent),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
          title: "New Event",
          description: "Event description",
          start: "2025-01-26T12:00:00Z",
          end: "2025-01-26T13:00:00Z",
          allDay: false,
          location: "Test Location",
        },
      });

      const response = await handler(event);

      expect(mockService.addEvent).toHaveBeenCalledWith(
        "calendar-1",
        expect.objectContaining({
          summary: "New Event",
          description: "Event description",
          location: "Test Location",
        }),
      );
      expect(response).toEqual({
        id: "event-123",
        title: "New Event",
        description: "Event description",
        start: new Date("2025-01-26T12:00:00Z"),
        end: new Date("2025-01-26T13:00:00Z"),
        allDay: false,
        location: "Test Location",
        integrationId: "integration-1",
        calendarId: "calendar-1",
        ical_event: undefined,
      });
    });
  });

  describe("all-day events", () => {
    it("handles all-day events correctly", async () => {
      const mockIntegration = createBaseIntegration();
      const mockCreatedEvent = {
        id: "event-123",
        summary: "All Day Event",
        description: "",
        start: { date: "2025-01-26" },
        end: { date: "2025-01-27" },
        location: undefined,
        recurrence: undefined,
        status: "confirmed",
        calendarId: "calendar-1",
      };

      const mockService = {
        addEvent: vi.fn().mockResolvedValue(mockCreatedEvent),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
          title: "All Day Event",
          description: "",
          start: "2025-01-26T00:00:00Z",
          end: "2025-01-27T00:00:00Z",
          allDay: true,
        },
      });

      const response = await handler(event);

      expect(mockService.addEvent).toHaveBeenCalledWith(
        "calendar-1",
        expect.objectContaining({
          start: { date: "2025-01-26" },
          end: { date: "2025-01-27" },
        }),
      );
      expect(response.allDay).toBe(true);
    });
  });

  describe("recurring events", () => {
    it("converts rrule to RRULE string for recurring events", async () => {
      const mockIntegration = createBaseIntegration();
      const mockRrule = {
        freq: "DAILY",
        interval: 1,
      };
      const mockCreatedEvent = {
        id: "event-123",
        summary: "Recurring Event",
        description: "",
        start: { dateTime: "2025-01-26T12:00:00Z" },
        end: { dateTime: "2025-01-26T13:00:00Z" },
        location: undefined,
        recurrence: ["RRULE:FREQ=DAILY;INTERVAL=1"],
        status: "confirmed",
        calendarId: "calendar-1",
      };

      const mockService = {
        addEvent: vi.fn().mockResolvedValue(mockCreatedEvent),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);
      vi.mocked(parseRRuleString).mockReturnValue(mockRrule);

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
          title: "Recurring Event",
          description: "",
          start: "2025-01-26T12:00:00Z",
          end: "2025-01-26T13:00:00Z",
          allDay: false,
          ical_event: {
            rrule: mockRrule,
          },
        },
      });

      const response = await handler(event);

      expect(mockService.addEvent).toHaveBeenCalledWith(
        "calendar-1",
        expect.objectContaining({
          recurrence: ["RRULE:FREQ=DAILY"],
        }),
      );
      expect(response.ical_event?.rrule).toEqual(mockRrule);
    });

    it("handles interval > 1 in rrule", async () => {
      const mockIntegration = createBaseIntegration();
      const mockRrule = {
        freq: "DAILY",
        interval: 3,
      };
      const mockCreatedEvent = {
        id: "event-123",
        summary: "Every 3 Days Event",
        description: "",
        start: { dateTime: "2025-01-26T12:00:00Z" },
        end: { dateTime: "2025-01-26T13:00:00Z" },
        location: undefined,
        recurrence: ["RRULE:FREQ=DAILY;INTERVAL=3"],
        status: "confirmed",
        calendarId: "calendar-1",
      };

      const mockService = {
        addEvent: vi.fn().mockResolvedValue(mockCreatedEvent),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);
      vi.mocked(parseRRuleString).mockReturnValue(mockRrule);

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
          title: "Every 3 Days Event",
          description: "",
          start: "2025-01-26T12:00:00Z",
          end: "2025-01-26T13:00:00Z",
          allDay: false,
          ical_event: {
            rrule: mockRrule,
          },
        },
      });

      const response = await handler(event);

      expect(mockService.addEvent).toHaveBeenCalledWith(
        "calendar-1",
        expect.objectContaining({
          recurrence: ["RRULE:FREQ=DAILY;INTERVAL=3"],
        }),
      );
      expect(response.ical_event?.rrule).toEqual(mockRrule);
    });

    it("handles COUNT in rrule", async () => {
      const mockIntegration = createBaseIntegration();
      const mockRrule = {
        freq: "WEEKLY",
        interval: 1,
        count: 10,
      };
      const mockCreatedEvent = {
        id: "event-123",
        summary: "Weekly Event with Count",
        description: "",
        start: { dateTime: "2025-01-26T12:00:00Z" },
        end: { dateTime: "2025-01-26T13:00:00Z" },
        location: undefined,
        recurrence: ["RRULE:FREQ=WEEKLY;COUNT=10"],
        status: "confirmed",
        calendarId: "calendar-1",
      };

      const mockService = {
        addEvent: vi.fn().mockResolvedValue(mockCreatedEvent),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);
      vi.mocked(parseRRuleString).mockReturnValue(mockRrule);

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
          title: "Weekly Event with Count",
          description: "",
          start: "2025-01-26T12:00:00Z",
          end: "2025-01-26T13:00:00Z",
          allDay: false,
          ical_event: {
            rrule: mockRrule,
          },
        },
      });

      const response = await handler(event);

      expect(mockService.addEvent).toHaveBeenCalledWith(
        "calendar-1",
        expect.objectContaining({
          recurrence: ["RRULE:FREQ=WEEKLY;COUNT=10"],
        }),
      );
      expect(response.ical_event?.rrule).toEqual(mockRrule);
    });

    it("handles UNTIL in rrule", async () => {
      const mockIntegration = createBaseIntegration();
      const mockRrule = {
        freq: "MONTHLY",
        interval: 1,
        until: "20251231T235959Z",
      };
      const mockCreatedEvent = {
        id: "event-123",
        summary: "Monthly Event with Until",
        description: "",
        start: { dateTime: "2025-01-26T12:00:00Z" },
        end: { dateTime: "2025-01-26T13:00:00Z" },
        location: undefined,
        recurrence: ["RRULE:FREQ=MONTHLY;UNTIL=20251231T235959Z"],
        status: "confirmed",
        calendarId: "calendar-1",
      };

      const mockService = {
        addEvent: vi.fn().mockResolvedValue(mockCreatedEvent),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);
      vi.mocked(parseRRuleString).mockReturnValue(mockRrule);

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
          title: "Monthly Event with Until",
          description: "",
          start: "2025-01-26T12:00:00Z",
          end: "2025-01-26T13:00:00Z",
          allDay: false,
          ical_event: {
            rrule: mockRrule,
          },
        },
      });

      const response = await handler(event);

      expect(mockService.addEvent).toHaveBeenCalledWith(
        "calendar-1",
        expect.objectContaining({
          recurrence: ["RRULE:FREQ=MONTHLY;UNTIL=20251231T235959Z"],
        }),
      );
      expect(response.ical_event?.rrule).toEqual(mockRrule);
    });

    it("handles BYDAY for weekly patterns", async () => {
      const mockIntegration = createBaseIntegration();
      const mockRrule = {
        freq: "WEEKLY",
        interval: 1,
        byday: ["MO", "WE", "FR"],
      };
      const mockCreatedEvent = {
        id: "event-123",
        summary: "Weekly Event on Mon/Wed/Fri",
        description: "",
        start: { dateTime: "2025-01-26T12:00:00Z" },
        end: { dateTime: "2025-01-26T13:00:00Z" },
        location: undefined,
        recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"],
        status: "confirmed",
        calendarId: "calendar-1",
      };

      const mockService = {
        addEvent: vi.fn().mockResolvedValue(mockCreatedEvent),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);
      vi.mocked(parseRRuleString).mockReturnValue(mockRrule);

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
          title: "Weekly Event on Mon/Wed/Fri",
          description: "",
          start: "2025-01-26T12:00:00Z",
          end: "2025-01-26T13:00:00Z",
          allDay: false,
          ical_event: {
            rrule: mockRrule,
          },
        },
      });

      const response = await handler(event);

      expect(mockService.addEvent).toHaveBeenCalledWith(
        "calendar-1",
        expect.objectContaining({
          recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"],
        }),
      );
      expect(response.ical_event?.rrule).toEqual(mockRrule);
    });

    it("handles BYDAY for monthly patterns", async () => {
      const mockIntegration = createBaseIntegration();
      const mockRrule = {
        freq: "MONTHLY",
        interval: 1,
        byday: ["1MO"],
      };
      const mockCreatedEvent = {
        id: "event-123",
        summary: "First Monday of Month",
        description: "",
        start: { dateTime: "2025-01-26T12:00:00Z" },
        end: { dateTime: "2025-01-26T13:00:00Z" },
        location: undefined,
        recurrence: ["RRULE:FREQ=MONTHLY;BYDAY=1MO"],
        status: "confirmed",
        calendarId: "calendar-1",
      };

      const mockService = {
        addEvent: vi.fn().mockResolvedValue(mockCreatedEvent),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);
      vi.mocked(parseRRuleString).mockReturnValue(mockRrule);

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
          title: "First Monday of Month",
          description: "",
          start: "2025-01-26T12:00:00Z",
          end: "2025-01-26T13:00:00Z",
          allDay: false,
          ical_event: {
            rrule: mockRrule,
          },
        },
      });

      const response = await handler(event);

      expect(mockService.addEvent).toHaveBeenCalledWith(
        "calendar-1",
        expect.objectContaining({
          recurrence: ["RRULE:FREQ=MONTHLY;BYDAY=1MO"],
        }),
      );
      expect(response.ical_event?.rrule).toEqual(mockRrule);
    });

    it("handles BYMONTH for yearly patterns", async () => {
      const mockIntegration = createBaseIntegration();
      const mockRrule = {
        freq: "YEARLY",
        interval: 1,
        bymonth: [1, 6, 12],
      };
      const mockCreatedEvent = {
        id: "event-123",
        summary: "Yearly Event in Jan/Jun/Dec",
        description: "",
        start: { dateTime: "2025-01-26T12:00:00Z" },
        end: { dateTime: "2025-01-26T13:00:00Z" },
        location: undefined,
        recurrence: ["RRULE:FREQ=YEARLY;BYMONTH=1,6,12"],
        status: "confirmed",
        calendarId: "calendar-1",
      };

      const mockService = {
        addEvent: vi.fn().mockResolvedValue(mockCreatedEvent),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);
      vi.mocked(parseRRuleString).mockReturnValue(mockRrule);

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
          title: "Yearly Event in Jan/Jun/Dec",
          description: "",
          start: "2025-01-26T12:00:00Z",
          end: "2025-01-26T13:00:00Z",
          allDay: false,
          ical_event: {
            rrule: mockRrule,
          },
        },
      });

      const response = await handler(event);

      expect(mockService.addEvent).toHaveBeenCalledWith(
        "calendar-1",
        expect.objectContaining({
          recurrence: ["RRULE:FREQ=YEARLY;BYMONTH=1,6,12"],
        }),
      );
      expect(response.ical_event?.rrule).toEqual(mockRrule);
    });

    it("handles complex rrule combinations", async () => {
      const mockIntegration = createBaseIntegration();
      const mockRrule = {
        freq: "WEEKLY",
        interval: 2,
        byday: ["MO", "WE"],
        count: 10,
      };
      const mockCreatedEvent = {
        id: "event-123",
        summary: "Complex Recurring Event",
        description: "",
        start: { dateTime: "2025-01-26T12:00:00Z" },
        end: { dateTime: "2025-01-26T13:00:00Z" },
        location: undefined,
        recurrence: ["RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=10"],
        status: "confirmed",
        calendarId: "calendar-1",
      };

      const mockService = {
        addEvent: vi.fn().mockResolvedValue(mockCreatedEvent),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);
      vi.mocked(parseRRuleString).mockReturnValue(mockRrule);

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
          title: "Complex Recurring Event",
          description: "",
          start: "2025-01-26T12:00:00Z",
          end: "2025-01-26T13:00:00Z",
          allDay: false,
          ical_event: {
            rrule: mockRrule,
          },
        },
      });

      const response = await handler(event);

      expect(mockService.addEvent).toHaveBeenCalledWith(
        "calendar-1",
        expect.objectContaining({
          recurrence: ["RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=10;BYDAY=MO,WE"],
        }),
      );
      expect(response.ical_event?.rrule).toEqual(mockRrule);
    });
  });

  describe("non-recurring events", () => {
    it("handles non-recurring events without rrule", async () => {
      const mockIntegration = createBaseIntegration();
      const mockCreatedEvent = {
        id: "event-123",
        summary: "Non-Recurring Event",
        description: "",
        start: { dateTime: "2025-01-26T12:00:00Z" },
        end: { dateTime: "2025-01-26T13:00:00Z" },
        location: undefined,
        recurrence: undefined,
        status: "confirmed",
        calendarId: "calendar-1",
      };

      const mockService = {
        addEvent: vi.fn().mockResolvedValue(mockCreatedEvent),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
          title: "Non-Recurring Event",
          description: "",
          start: "2025-01-26T12:00:00Z",
          end: "2025-01-26T13:00:00Z",
          allDay: false,
        },
      });

      const response = await handler(event);

      expect(mockService.addEvent).toHaveBeenCalledWith(
        "calendar-1",
        expect.objectContaining({
          recurrence: undefined,
        }),
      );
      expect(response.ical_event).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("throws error when start is missing", async () => {
      const mockIntegration = createBaseIntegration();

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
          title: "Test Event",
          end: "2025-01-26T13:00:00Z",
          allDay: false,
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws error when end is missing", async () => {
      const mockIntegration = createBaseIntegration();

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
          title: "Test Event",
          start: "2025-01-26T12:00:00Z",
          allDay: false,
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("handles missing title (becomes undefined summary)", async () => {
      const mockIntegration = createBaseIntegration();
      const mockCreatedEvent = {
        id: "event-123",
        summary: undefined,
        description: "",
        start: { dateTime: "2025-01-26T12:00:00Z" },
        end: { dateTime: "2025-01-26T13:00:00Z" },
        location: undefined,
        recurrence: undefined,
        status: "confirmed",
        calendarId: "calendar-1",
      };

      const mockService = {
        addEvent: vi.fn().mockResolvedValue(mockCreatedEvent),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
          start: "2025-01-26T12:00:00Z",
          end: "2025-01-26T13:00:00Z",
          allDay: false,
        },
      });

      const response = await handler(event);

      expect(mockService.addEvent).toHaveBeenCalledWith(
        "calendar-1",
        expect.objectContaining({
          summary: undefined,
        }),
      );
      expect(response.title).toBeUndefined();
    });

    it("handles invalid date format gracefully", async () => {
      const mockIntegration = createBaseIntegration();

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
          title: "Test Event",
          start: "invalid-date",
          end: "2025-01-26T13:00:00Z",
          allDay: false,
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("handles empty string for description", async () => {
      const mockIntegration = createBaseIntegration();
      const mockCreatedEvent = {
        id: "event-123",
        summary: "Test Event",
        description: "",
        start: { dateTime: "2025-01-26T12:00:00Z" },
        end: { dateTime: "2025-01-26T13:00:00Z" },
        location: undefined,
        recurrence: undefined,
        status: "confirmed",
        calendarId: "calendar-1",
      };

      const mockService = {
        addEvent: vi.fn().mockResolvedValue(mockCreatedEvent),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
          title: "Test Event",
          description: "",
          start: "2025-01-26T12:00:00Z",
          end: "2025-01-26T13:00:00Z",
          allDay: false,
        },
      });

      const response = await handler(event);

      expect(response.description).toBe("");
    });

    it("handles special characters in event data", async () => {
      const mockIntegration = createBaseIntegration();
      const mockCreatedEvent = {
        id: "event-123",
        summary: "Test Event <script>alert('xss')</script>",
        description: "Description with\nnewlines & special chars: <>&\"'",
        start: { dateTime: "2025-01-26T12:00:00Z" },
        end: { dateTime: "2025-01-26T13:00:00Z" },
        location: "Location with émojis 🎉",
        recurrence: undefined,
        status: "confirmed",
        calendarId: "calendar-1",
      };

      const mockService = {
        addEvent: vi.fn().mockResolvedValue(mockCreatedEvent),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
          title: "Test Event <script>alert('xss')</script>",
          description: "Description with\nnewlines & special chars: <>&\"'",
          start: "2025-01-26T12:00:00Z",
          end: "2025-01-26T13:00:00Z",
          allDay: false,
          location: "Location with émojis 🎉",
        },
      });

      const response = await handler(event);

      expect(mockService.addEvent).toHaveBeenCalledWith(
        "calendar-1",
        expect.objectContaining({
          summary: "Test Event <script>alert('xss')</script>",
          description: "Description with\nnewlines & special chars: <>&\"'",
          location: "Location with émojis 🎉",
        }),
      );
      expect(response.title).toBe("Test Event <script>alert('xss')</script>");
      expect(response.description).toBe("Description with\nnewlines & special chars: <>&\"'");
      expect(response.location).toBe("Location with émojis 🎉");
    });
  });

  describe("error handling", () => {
    it("throws 400 when integrationId is missing", async () => {
      const event = createMockH3Event({
        method: "POST",
        body: {
          calendarId: "calendar-1",
          title: "Test Event",
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 400 when calendarId is missing", async () => {
      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          title: "Test Event",
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 404 when integration not found", async () => {
      prisma.integration.findFirst.mockResolvedValue(null);

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "nonexistent",
          calendarId: "calendar-1",
          title: "Test Event",
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 400 when integration is not authenticated", async () => {
      const mockIntegration = {
        ...createBaseIntegration(),
        apiKey: null,
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
          title: "Test Event",
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 400 when clientId is missing", async () => {
      const mockIntegration = {
        ...createBaseIntegration(),
        settings: {},
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
          title: "Test Event",
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("handles 401 errors and sets needsReauth", async () => {
      const mockIntegration = createBaseIntegration();
      const mockService = {
        addEvent: vi.fn().mockRejectedValue({
          code: 401,
          message: "Invalid Credentials",
        }),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);
      vi.mocked(isGoogleApiError).mockReturnValue(true);

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
          title: "Test Event",
          description: "",
          start: "2025-01-26T12:00:00Z",
          end: "2025-01-26T13:00:00Z",
          allDay: false,
        },
      });

      await expect(handler(event)).rejects.toThrow();

      expect(prisma.integration.update).toHaveBeenCalledWith({
        where: { id: "integration-1" },
        data: {
          apiKey: null,
          settings: expect.objectContaining({
            needsReauth: true,
          }),
        },
      });
    });

    it("handles 401 error with invalid_grant message", async () => {
      const mockIntegration = createBaseIntegration();
      const mockService = {
        addEvent: vi.fn().mockRejectedValue({
          code: 401,
          message: "invalid_grant",
        }),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);
      vi.mocked(isGoogleApiError).mockReturnValue(true);

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
          title: "Test Event",
          description: "",
          start: "2025-01-26T12:00:00Z",
          end: "2025-01-26T13:00:00Z",
          allDay: false,
        },
      });

      await expect(handler(event)).rejects.toThrow();

      expect(prisma.integration.update).toHaveBeenCalledWith({
        where: { id: "integration-1" },
        data: {
          apiKey: null,
          settings: expect.objectContaining({
            needsReauth: true,
          }),
        },
      });
    });

    it("handles 403 Forbidden errors", async () => {
      const mockIntegration = createBaseIntegration();
      const mockService = {
        addEvent: vi.fn().mockRejectedValue({
          code: 403,
          message: "Forbidden",
        }),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);
      vi.mocked(isGoogleApiError).mockReturnValue(true);

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
          title: "Test Event",
          description: "",
          start: "2025-01-26T12:00:00Z",
          end: "2025-01-26T13:00:00Z",
          allDay: false,
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("handles 404 Not Found errors", async () => {
      const mockIntegration = createBaseIntegration();
      const mockService = {
        addEvent: vi.fn().mockRejectedValue({
          code: 404,
          message: "Not Found",
        }),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);
      vi.mocked(isGoogleApiError).mockReturnValue(true);

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
          title: "Test Event",
          description: "",
          start: "2025-01-26T12:00:00Z",
          end: "2025-01-26T13:00:00Z",
          allDay: false,
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("handles 500 Internal Server errors", async () => {
      const mockIntegration = createBaseIntegration();
      const mockService = {
        addEvent: vi.fn().mockRejectedValue({
          code: 500,
          message: "Internal Server Error",
        }),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);
      vi.mocked(isGoogleApiError).mockReturnValue(true);

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
          title: "Test Event",
          description: "",
          start: "2025-01-26T12:00:00Z",
          end: "2025-01-26T13:00:00Z",
          allDay: false,
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("handles token refresh callback failure gracefully", async () => {
      const mockIntegration = createBaseIntegration();
      const mockCreatedEvent = {
        id: "event-123",
        summary: "Test Event",
        description: "",
        start: { dateTime: "2025-01-26T12:00:00Z" },
        end: { dateTime: "2025-01-26T13:00:00Z" },
        location: undefined,
        recurrence: undefined,
        status: "confirmed",
        calendarId: "calendar-1",
      };

      const mockService = {
        addEvent: vi.fn().mockResolvedValue(mockCreatedEvent),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockRejectedValue(new Error("Database error"));
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation((clientId, clientSecret, refreshToken, accessToken, expiry, integrationId, onTokenRefresh) => {
        if (onTokenRefresh) {
          setTimeout(() => {
            onTokenRefresh(integrationId || "", "new-access-token", Date.now() + 3600000);
          }, 0);
        }
        return mockService as never;
      });

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
          title: "Test Event",
          description: "",
          start: "2025-01-26T12:00:00Z",
          end: "2025-01-26T13:00:00Z",
          allDay: false,
        },
      });

      const response = await handler(event);

      expect(mockService.addEvent).toHaveBeenCalled();
      expect(response.id).toBe("event-123");
    });

    it("handles integration with enabled: false", async () => {
      const mockIntegration = {
        ...createBaseIntegration(),
        enabled: false,
      };

      prisma.integration.findFirst.mockResolvedValue(null);

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
          title: "Test Event",
          description: "",
          start: "2025-01-26T12:00:00Z",
          end: "2025-01-26T13:00:00Z",
          allDay: false,
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("handles Google API errors", async () => {
      const mockIntegration = createBaseIntegration();
      const mockService = {
        addEvent: vi.fn().mockRejectedValue(new Error("API error")),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);
      vi.mocked(isGoogleApiError).mockReturnValue(false);

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
          title: "Test Event",
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("calls token refresh callback when token is refreshed", async () => {
      const mockIntegration = createBaseIntegration();
      const mockCreatedEvent = {
        id: "event-123",
        summary: "Test Event",
        description: "",
        start: { dateTime: "2025-01-26T12:00:00Z" },
        end: { dateTime: "2025-01-26T13:00:00Z" },
        location: undefined,
        recurrence: undefined,
        status: "confirmed",
        calendarId: "calendar-1",
      };

      const mockService = {
        addEvent: vi.fn().mockResolvedValue(mockCreatedEvent),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation((clientId, clientSecret, refreshToken, accessToken, expiry, integrationId, onTokenRefresh) => {
        if (onTokenRefresh) {
          setTimeout(() => {
            onTokenRefresh(integrationId || "", "new-access-token", Date.now() + 3600000);
          }, 0);
        }
        return mockService as never;
      });

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
          title: "Test Event",
          description: "",
          start: "2025-01-26T12:00:00Z",
          end: "2025-01-26T13:00:00Z",
          allDay: false,
        },
      });

      await handler(event);

      expect(mockService.addEvent).toHaveBeenCalled();
    });
  });
});
