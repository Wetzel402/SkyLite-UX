import type { H3Event } from "h3";

import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi, beforeEach } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import { GoogleCalendarServerService } from "~~/server/integrations/google_calendar/client";
import { expandRecurringEvents, parseRRuleString } from "~~/server/utils/rrule";

const { defineEventHandler } = useH3TestUtils();

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
    getQuery: vi.fn((event: H3Event) => {
      if (event?.context?.query) {
        return event.context.query;
      }
      return {};
    }),
  };
});

import handler from "~~/server/api/integrations/google_calendar/events/index.get";

vi.mock("~/lib/prisma");
vi.mock("~~/server/integrations/google_calendar/client");
vi.mock("~~/server/utils/rrule", () => ({
  expandRecurringEvents: vi.fn((events) => events),
  parseRRuleString: vi.fn((rrule) => ({ freq: "DAILY", interval: 1 })),
}));

describe("gET /api/integrations/google_calendar/events", () => {
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
      calendars: [
        { id: "cal-1", enabled: true },
        { id: "cal-2", enabled: false },
      ],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  describe("fetches events successfully", () => {
    it("fetches and expands events from selected calendars", async () => {
      const mockIntegration = createBaseIntegration();

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);

      const mockEvents = [
        {
          id: "event-1",
          summary: "Test Event",
          description: "Test Description",
          start: { dateTime: "2025-01-15T10:00:00Z" },
          end: { dateTime: "2025-01-15T11:00:00Z" },
          location: "Test Location",
          calendarId: "cal-1",
        },
      ];

      const mockService = {
        fetchEvents: vi.fn().mockResolvedValue(mockEvents),
      };

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);

      const event = createMockH3Event({
        query: { integrationId: "integration-1" },
      });

      const response = await handler(event);

      expect(prisma.integration.findFirst).toHaveBeenCalledWith({
        where: {
          id: "integration-1",
          type: "calendar",
          service: "google",
          enabled: true,
        },
      });

      expect(mockService.fetchEvents).toHaveBeenCalledWith(["cal-1"]);
      expect(expandRecurringEvents).toHaveBeenCalled();
      expect(response).toHaveProperty("events");
      expect(response).toHaveProperty("calendars");
    });

    it("returns empty array when no calendars are selected", async () => {
      const mockIntegration = {
        ...createBaseIntegration(),
        settings: {
          ...createBaseIntegration().settings,
          calendars: [
            { id: "cal-1", enabled: false },
            { id: "cal-2", enabled: false },
          ],
        },
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);

      const event = createMockH3Event({
        query: { integrationId: "integration-1" },
      });

      const response = await handler(event);

      expect(response).toEqual({ events: [], calendars: [] });
    });
  });

  describe("error handling", () => {
    it("throws 400 when integrationId is missing", async () => {
      const event = createMockH3Event({
        query: {},
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 400 when integrationId is 'temp'", async () => {
      const event = createMockH3Event({
        query: { integrationId: "temp" },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 404 when integration not found", async () => {
      prisma.integration.findFirst.mockResolvedValue(null as Awaited<ReturnType<typeof prisma.integration.findFirst>>);

      const event = createMockH3Event({
        query: { integrationId: "nonexistent" },
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
        query: { integrationId: "integration-1" },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("handles authentication errors and marks integration for reauth", async () => {
      const mockIntegration = {
        ...createBaseIntegration(),
        settings: {
          ...createBaseIntegration().settings,
          accessToken: "token",
          tokenExpiry: Date.now() + 3600000,
          calendars: [
            { id: "cal-1", enabled: true },
            { id: "cal-2", enabled: false },
          ],
        },
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.update.mockResolvedValue(mockIntegration);

      const authError = {
        code: 401,
        message: "Invalid Credentials",
      };

      const mockService = {
        fetchEvents: vi.fn().mockRejectedValue(authError),
      };

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);

      const event = createMockH3Event({
        query: { integrationId: "integration-1" },
      });

      await expect(handler(event)).rejects.toThrow();

      expect(prisma.integration.update).toHaveBeenCalledWith({
        where: { id: "integration-1" },
        data: expect.objectContaining({
          apiKey: null,
          settings: expect.objectContaining({
            needsReauth: true,
          }),
        }),
      });
    });
  });
});
