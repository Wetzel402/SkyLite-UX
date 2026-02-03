import type { H3Event } from "h3";

import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";
import { ICalServerService } from "~~/server/integrations/iCal/client";

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

import handler from "~~/server/api/integrations/iCal/index.get";

vi.mock("~/lib/prisma");
vi.mock("~~/server/integrations/iCal/client");

describe("gET /api/integrations/iCal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createBaseIntegration = () => ({
    id: "integration-1",
    name: "iCal Integration",
    type: "calendar" as const,
    service: "iCal" as const,
    enabled: true,
    apiKey: null,
    baseUrl: "https://example.com/calendar.ics",
    icon: null,
    settings: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  describe("fetches events successfully", () => {
    it("fetches events from saved integration", async () => {
      const mockIntegration = createBaseIntegration();
      const mockEvents = [
        {
          type: "VEVENT" as const,
          uid: "event-1",
          summary: "Test Event",
          description: "Test Description",
          dtstart: "20250115T100000Z",
          dtend: "20250115T110000Z",
          location: undefined,
          attendees: undefined,
          rrule: undefined,
        },
      ];

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      vi.mocked(ICalServerService).mockImplementation(() => ({
        fetchEventsFromUrl: vi.fn().mockResolvedValue(mockEvents),
      }) as unknown as ICalServerService);

      const event = createMockH3Event({
        method: "GET",
        query: { integrationId: "integration-1" },
      });

      const response = await handler(event);

      expect(prisma.integration.findFirst).toHaveBeenCalledWith({
        where: {
          id: "integration-1",
          type: "calendar",
          service: "iCal",
          enabled: true,
        },
      });
      expect(response).toEqual({ events: mockEvents });
    });

    it("fetches events from temporary integration", async () => {
      const mockEvents = [
        {
          type: "VEVENT" as const,
          uid: "event-1",
          summary: "Test Event",
          description: "Test Description",
          dtstart: "20250115T100000Z",
          dtend: "20250115T110000Z",
          location: undefined,
          attendees: undefined,
          rrule: undefined,
        },
      ];

      vi.mocked(ICalServerService).mockImplementation(() => ({
        fetchEventsFromUrl: vi.fn().mockResolvedValue(mockEvents),
      }) as unknown as ICalServerService);

      const event = createMockH3Event({
        method: "GET",
        query: { integrationId: "temp", baseUrl: "https://example.com/calendar.ics" },
      });

      const response = await handler(event);

      expect(prisma.integration.findFirst).not.toHaveBeenCalled();
      expect(response).toEqual({ events: mockEvents });
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

    it("throws 400 when baseUrl is missing for temp integration", async () => {
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

    it("throws 404 when integration has no baseUrl", async () => {
      const mockIntegration = {
        ...createBaseIntegration(),
        baseUrl: null,
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);

      const event = createMockH3Event({
        method: "GET",
        query: { integrationId: "integration-1" },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 400 when integration type is invalid", async () => {
      const mockIntegration = {
        ...createBaseIntegration(),
        type: "shopping" as const,
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);

      const event = createMockH3Event({
        method: "GET",
        query: { integrationId: "integration-1" },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("handles service fetch errors", async () => {
      const mockIntegration = createBaseIntegration();

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      vi.mocked(ICalServerService).mockImplementation(() => ({
        fetchEventsFromUrl: vi.fn().mockRejectedValue(new Error("Failed to fetch calendar")),
      }) as unknown as ICalServerService);

      const event = createMockH3Event({
        method: "GET",
        query: { integrationId: "integration-1" },
      });

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
