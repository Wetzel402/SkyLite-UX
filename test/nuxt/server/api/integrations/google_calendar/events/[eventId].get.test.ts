import type { H3Event } from "h3";

import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import { GoogleCalendarServerService } from "~~/server/integrations/google_calendar/client";
import { parseRRuleString } from "~~/server/utils/rrule";

const { defineEventHandler, getRouterParam, getQuery } = useH3TestUtils();

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
    getRouterParam: vi.fn((event: H3Event, name: string) => {
      if (event?.context?.params && name in event.context.params) {
        return event.context.params[name];
      }
      return undefined;
    }),
    getQuery: vi.fn((event: H3Event) => {
      if (event?.context?.query) {
        return event.context.query;
      }
      return {};
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

import handler from "~~/server/api/integrations/google_calendar/events/[eventId].get";

vi.mock("~/lib/prisma");
vi.mock("~~/server/integrations/google_calendar/client");

describe("GET /api/integrations/google_calendar/events/[eventId]", () => {
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

  describe("success with all fields", () => {
    it("returns event with all fields", async () => {
      const mockIntegration = createBaseIntegration();
      const mockGoogleEvent = {
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
        fetchEvent: vi.fn().mockResolvedValue(mockGoogleEvent),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);

      const event = createMockH3Event({
        method: "GET",
        params: { eventId: "event-123" },
        query: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
        },
      });

      const response = await handler(event);

      expect(mockService.fetchEvent).toHaveBeenCalledWith("calendar-1", "event-123");
      expect(response).toEqual({
        id: "event-123",
        title: "Test Event",
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
      const mockGoogleEvent = {
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
        fetchEvent: vi.fn().mockResolvedValue(mockGoogleEvent),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);

      const event = createMockH3Event({
        method: "GET",
        params: { eventId: "event-123" },
        query: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
        },
      });

      const response = await handler(event);

      expect(response).toEqual({
        id: "event-123",
        title: "All Day Event",
        description: "",
        start: new Date("2025-01-26"),
        end: new Date("2025-01-27"),
        allDay: true,
        location: undefined,
        integrationId: "integration-1",
        calendarId: "calendar-1",
        ical_event: undefined,
      });
    });
  });

  describe("recurring events", () => {
    it("parses rrule for recurring events", async () => {
      const mockIntegration = createBaseIntegration();
      const mockRrule = {
        freq: "DAILY",
        interval: 1,
      };

      const mockGoogleEvent = {
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
        fetchEvent: vi.fn().mockResolvedValue(mockGoogleEvent),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);
      vi.mocked(parseRRuleString).mockReturnValue(mockRrule);

      const event = createMockH3Event({
        method: "GET",
        params: { eventId: "event-123" },
        query: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
        },
      });

      const response = await handler(event);

      expect(parseRRuleString).toHaveBeenCalledWith("RRULE:FREQ=DAILY;INTERVAL=1");
      expect(response.ical_event).toBeDefined();
      expect(response.ical_event?.rrule).toEqual(mockRrule);
    });
  });

  describe("non-recurring events", () => {
    it("returns undefined ical_event for non-recurring events", async () => {
      const mockIntegration = createBaseIntegration();
      const mockGoogleEvent = {
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
        fetchEvent: vi.fn().mockResolvedValue(mockGoogleEvent),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);

      const event = createMockH3Event({
        method: "GET",
        params: { eventId: "event-123" },
        query: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
        },
      });

      const response = await handler(event);

      expect(response.ical_event).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("throws 400 when eventId is missing", async () => {
      const event = createMockH3Event({
        method: "GET",
        query: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 400 when eventId is not a string", async () => {
      const event = createMockH3Event({
        method: "GET",
        params: { eventId: 123 as unknown as string },
        query: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 400 when integrationId is missing", async () => {
      const event = createMockH3Event({
        method: "GET",
        params: { eventId: "event-123" },
        query: {
          calendarId: "calendar-1",
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 400 when integrationId is not a string", async () => {
      const event = createMockH3Event({
        method: "GET",
        params: { eventId: "event-123" },
        query: {
          integrationId: 123,
          calendarId: "calendar-1",
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 400 when calendarId is missing", async () => {
      const event = createMockH3Event({
        method: "GET",
        params: { eventId: "event-123" },
        query: {
          integrationId: "integration-1",
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 400 when calendarId is not a string", async () => {
      const event = createMockH3Event({
        method: "GET",
        params: { eventId: "event-123" },
        query: {
          integrationId: "integration-1",
          calendarId: 123,
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 404 when integration not found", async () => {
      prisma.integration.findFirst.mockResolvedValue(null);

      const event = createMockH3Event({
        method: "GET",
        params: { eventId: "event-123" },
        query: {
          integrationId: "nonexistent",
          calendarId: "calendar-1",
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
        method: "GET",
        params: { eventId: "event-123" },
        query: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
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
        method: "GET",
        params: { eventId: "event-123" },
        query: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("handles Google API errors", async () => {
      const mockIntegration = createBaseIntegration();
      const mockService = {
        fetchEvent: vi.fn().mockRejectedValue(new Error("API error")),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);

      const event = createMockH3Event({
        method: "GET",
        params: { eventId: "event-123" },
        query: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("calls token refresh callback when token is refreshed", async () => {
      const mockIntegration = createBaseIntegration();
      const mockGoogleEvent = {
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
        fetchEvent: vi.fn().mockResolvedValue(mockGoogleEvent),
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
        method: "GET",
        params: { eventId: "event-123" },
        query: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
        },
      });

      await handler(event);

      expect(mockService.fetchEvent).toHaveBeenCalled();
    });
  });
});
