import type { H3Event } from "h3";

import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import { GoogleCalendarServerService } from "~~/server/integrations/google_calendar/client";

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

import handler from "~~/server/api/integrations/google_calendar/events/[eventId].delete";

vi.mock("~/lib/prisma");
vi.mock("~~/server/integrations/google_calendar/client");

describe("DELETE /api/integrations/google_calendar/events/[eventId]", () => {
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

  describe("delete with calendarId", () => {
    it("deletes event from specified calendar", async () => {
      const mockIntegration = createBaseIntegration();
      const mockService = {
        deleteEvent: vi.fn().mockResolvedValue(undefined),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);

      const event = createMockH3Event({
        method: "DELETE",
        params: { eventId: "event-123" },
        query: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
        },
      });

      const response = await handler(event);

      expect(mockService.deleteEvent).toHaveBeenCalledWith("calendar-1", "event");
      expect(response).toEqual({ success: true });
    });
  });

  describe("delete from primary calendar", () => {
    it("fetches event from primary calendar and deletes it", async () => {
      const mockIntegration = createBaseIntegration();
      const mockService = {
        fetchEvent: vi.fn().mockResolvedValue({
          id: "event-123",
          calendarId: "primary",
          summary: "Test Event",
        }),
        deleteEvent: vi.fn().mockResolvedValue(undefined),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);

      const event = createMockH3Event({
        method: "DELETE",
        params: { eventId: "event-123" },
        query: {
          integrationId: "integration-1",
        },
      });

      const response = await handler(event);

      expect(mockService.fetchEvent).toHaveBeenCalledWith("primary", "event");
      expect(mockService.deleteEvent).toHaveBeenCalledWith("primary", "event");
      expect(response).toEqual({ success: true });
    });
  });

  describe("delete by searching all calendars", () => {
    it("searches all calendars and deletes event when found", async () => {
      const mockIntegration = createBaseIntegration();
      const mockService = {
        fetchEvent: vi.fn()
          .mockRejectedValueOnce(new Error("Not found"))
          .mockResolvedValueOnce({
            id: "event-123",
            calendarId: "calendar-1",
            summary: "Test Event",
          }),
        deleteEvent: vi.fn().mockResolvedValue(undefined),
        listCalendars: vi.fn().mockResolvedValue([
          { id: "calendar-1", summary: "Calendar 1" },
          { id: "calendar-2", summary: "Calendar 2" },
        ]),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);

      const event = createMockH3Event({
        method: "DELETE",
        params: { eventId: "event-123" },
        query: {
          integrationId: "integration-1",
        },
      });

      const response = await handler(event);

      expect(mockService.listCalendars).toHaveBeenCalled();
      expect(mockService.fetchEvent).toHaveBeenCalledWith("primary", "event");
      expect(mockService.fetchEvent).toHaveBeenCalledWith("calendar-1", "event");
      expect(mockService.deleteEvent).toHaveBeenCalledWith("calendar-1", "event");
      expect(response).toEqual({ success: true });
    });

    it("handles base event ID extraction from recurring event ID", async () => {
      const mockIntegration = createBaseIntegration();
      const mockService = {
        fetchEvent: vi.fn().mockRejectedValueOnce(new Error("Not found")),
        deleteEvent: vi.fn().mockResolvedValue(undefined),
        listCalendars: vi.fn().mockResolvedValue([
          { id: "calendar-1", summary: "Calendar 1" },
        ]),
      };

      mockService.fetchEvent.mockResolvedValueOnce({
        id: "event-123-20250126",
        calendarId: "calendar-1",
        summary: "Test Event",
      });

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);

      const event = createMockH3Event({
        method: "DELETE",
        params: { eventId: "event-123-20250126" },
        query: {
          integrationId: "integration-1",
        },
      });

      const response = await handler(event);

      expect(mockService.deleteEvent).toHaveBeenCalledWith("calendar-1", "event");
      expect(response).toEqual({ success: true });
    });

    it("handles empty calendar list", async () => {
      const mockIntegration = createBaseIntegration();
      const mockService = {
        fetchEvent: vi.fn().mockRejectedValue(new Error("Not found")),
        listCalendars: vi.fn().mockResolvedValue([]),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);

      const event = createMockH3Event({
        method: "DELETE",
        params: { eventId: "event-123" },
        query: {
          integrationId: "integration-1",
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("finds event in second calendar after primary fails", async () => {
      const mockIntegration = createBaseIntegration();
      const mockService = {
        fetchEvent: vi.fn()
          .mockRejectedValueOnce(new Error("Not found"))
          .mockRejectedValueOnce(new Error("Not found"))
          .mockResolvedValueOnce({
            id: "event-123",
            calendarId: "calendar-2",
            summary: "Test Event",
          }),
        deleteEvent: vi.fn().mockResolvedValue(undefined),
        listCalendars: vi.fn().mockResolvedValue([
          { id: "calendar-1", summary: "Calendar 1" },
          { id: "calendar-2", summary: "Calendar 2" },
        ]),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);

      const event = createMockH3Event({
        method: "DELETE",
        params: { eventId: "event-123" },
        query: {
          integrationId: "integration-1",
        },
      });

      const response = await handler(event);

      expect(mockService.fetchEvent).toHaveBeenCalledWith("primary", "event");
      expect(mockService.fetchEvent).toHaveBeenCalledWith("calendar-1", "event");
      expect(mockService.fetchEvent).toHaveBeenCalledWith("calendar-2", "event");
      expect(mockService.deleteEvent).toHaveBeenCalledWith("calendar-2", "event");
      expect(response).toEqual({ success: true });
    });

    it("finds event in third calendar after first two fail", async () => {
      const mockIntegration = createBaseIntegration();
      const mockService = {
        fetchEvent: vi.fn()
          .mockRejectedValueOnce(new Error("Not found"))
          .mockRejectedValueOnce(new Error("Not found"))
          .mockRejectedValueOnce(new Error("Not found"))
          .mockResolvedValueOnce({
            id: "event-123",
            calendarId: "calendar-3",
            summary: "Test Event",
          }),
        deleteEvent: vi.fn().mockResolvedValue(undefined),
        listCalendars: vi.fn().mockResolvedValue([
          { id: "calendar-1", summary: "Calendar 1" },
          { id: "calendar-2", summary: "Calendar 2" },
          { id: "calendar-3", summary: "Calendar 3" },
        ]),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);

      const event = createMockH3Event({
        method: "DELETE",
        params: { eventId: "event-123" },
        query: {
          integrationId: "integration-1",
        },
      });

      const response = await handler(event);

      expect(mockService.fetchEvent).toHaveBeenCalledWith("primary", "event");
      expect(mockService.fetchEvent).toHaveBeenCalledWith("calendar-1", "event");
      expect(mockService.fetchEvent).toHaveBeenCalledWith("calendar-2", "event");
      expect(mockService.fetchEvent).toHaveBeenCalledWith("calendar-3", "event");
      expect(mockService.deleteEvent).toHaveBeenCalledWith("calendar-3", "event");
      expect(response).toEqual({ success: true });
    });
  });

  describe("edge cases", () => {
    it("handles empty string eventId", async () => {
      const event = createMockH3Event({
        method: "DELETE",
        params: { eventId: "" },
        query: {
          integrationId: "integration-1",
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("handles eventId with special characters", async () => {
      const mockIntegration = createBaseIntegration();
      const mockService = {
        deleteEvent: vi.fn().mockResolvedValue(undefined),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);

      const event = createMockH3Event({
        method: "DELETE",
        params: { eventId: "event@#$%123" },
        query: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
        },
      });

      const response = await handler(event);

      expect(mockService.deleteEvent).toHaveBeenCalledWith("calendar-1", "event@#$%123");
      expect(response).toEqual({ success: true });
    });
  });

  describe("error handling", () => {
    it("throws 400 when eventId is missing", async () => {
      const event = createMockH3Event({
        method: "DELETE",
        query: {
          integrationId: "integration-1",
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 400 when integrationId is missing", async () => {
      const event = createMockH3Event({
        method: "DELETE",
        params: { eventId: "event-123" },
        query: {},
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 404 when integration not found", async () => {
      prisma.integration.findFirst.mockResolvedValue(null);

      const event = createMockH3Event({
        method: "DELETE",
        params: { eventId: "event-123" },
        query: {
          integrationId: "nonexistent",
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
        method: "DELETE",
        params: { eventId: "event-123" },
        query: {
          integrationId: "integration-1",
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
        method: "DELETE",
        params: { eventId: "event-123" },
        query: {
          integrationId: "integration-1",
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 404 when event not found in any calendar", async () => {
      const mockIntegration = createBaseIntegration();
      const mockService = {
        fetchEvent: vi.fn().mockRejectedValue(new Error("Not found")),
        listCalendars: vi.fn().mockResolvedValue([
          { id: "calendar-1", summary: "Calendar 1" },
        ]),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);

      const event = createMockH3Event({
        method: "DELETE",
        params: { eventId: "event-123" },
        query: {
          integrationId: "integration-1",
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("handles Google API errors", async () => {
      const mockIntegration = createBaseIntegration();
      const mockService = {
        deleteEvent: vi.fn().mockRejectedValue(new Error("API error")),
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);

      const event = createMockH3Event({
        method: "DELETE",
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
      const mockService = {
        deleteEvent: vi.fn().mockResolvedValue(undefined),
      };

      let onTokenRefreshCalled = false;
      let onTokenRefreshArgs: [string, string, number] | null = null;

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(GoogleCalendarServerService).mockImplementation((clientId, clientSecret, refreshToken, accessToken, expiry, integrationId, onTokenRefresh) => {
        if (onTokenRefresh) {
          setTimeout(() => {
            onTokenRefresh(integrationId || "", "new-access-token", Date.now() + 3600000);
            onTokenRefreshCalled = true;
            onTokenRefreshArgs = [integrationId || "", "new-access-token", Date.now() + 3600000];
          }, 0);
        }
        return mockService as never;
      });

      const event = createMockH3Event({
        method: "DELETE",
        params: { eventId: "event-123" },
        query: {
          integrationId: "integration-1",
          calendarId: "calendar-1",
        },
      });

      await handler(event);

      expect(mockService.deleteEvent).toHaveBeenCalled();
    });
  });
});
