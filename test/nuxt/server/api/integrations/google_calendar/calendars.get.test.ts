import type { H3Event } from "h3";

import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import { GoogleCalendarServerService } from "~~/server/integrations/google_calendar/client";
import { isGoogleApiError } from "~/types/errors";

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

import handler from "~~/server/api/integrations/google_calendar/calendars.get";

vi.mock("~/lib/prisma");
vi.mock("~~/server/integrations/google_calendar/client");
vi.mock("~/types/errors", () => ({
  isGoogleApiError: vi.fn((error: unknown) => {
    return typeof error === "object" && error !== null && "code" in error;
  }),
}));

describe("gET /api/integrations/google_calendar/calendars", () => {
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

  describe("lists calendars successfully", () => {
    it("returns list of calendars", async () => {
      const mockIntegration = createBaseIntegration();
      const mockCalendars = [
        { id: "primary", summary: "Primary Calendar", accessRole: "owner" },
        { id: "cal-1", summary: "Work Calendar", accessRole: "reader" },
      ];

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.findUnique.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      const mockService = {
        listCalendars: vi.fn().mockResolvedValue(mockCalendars),
      };

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);

      const event = createMockH3Event({
        method: "GET",
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
      expect(mockService.listCalendars).toHaveBeenCalled();
      expect(response).toEqual({ calendars: mockCalendars });
    });
  });

  describe("error handling", () => {
    it("throws 400 when integrationId is missing", async () => {
      const event = createMockH3Event({
        method: "GET",
        query: {},
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 400 when integrationId is 'temp'", async () => {
      const event = createMockH3Event({
        method: "GET",
        query: { integrationId: "temp" },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 404 when integration not found", async () => {
      prisma.integration.findFirst.mockResolvedValue(null);

      const event = createMockH3Event({
        method: "GET",
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
        method: "GET",
        query: { integrationId: "integration-1" },
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
        query: { integrationId: "integration-1" },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("handles authentication errors and marks for reauth", async () => {
      const mockIntegration = createBaseIntegration();

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.update.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.update>>);

      const authError = {
        code: 401,
        message: "Invalid Credentials",
      };

      const mockService = {
        listCalendars: vi.fn().mockRejectedValue(authError),
      };

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);
      vi.mocked(isGoogleApiError).mockReturnValue(true);

      const event = createMockH3Event({
        method: "GET",
        query: { integrationId: "integration-1" },
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

    it("handles service errors", async () => {
      const mockIntegration = createBaseIntegration();

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);

      const mockService = {
        listCalendars: vi.fn().mockRejectedValue(new Error("Service error")),
      };

      vi.mocked(GoogleCalendarServerService).mockImplementation(() => mockService as never);
      vi.mocked(isGoogleApiError).mockReturnValue(false);

      const event = createMockH3Event({
        method: "GET",
        query: { integrationId: "integration-1" },
      });

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
