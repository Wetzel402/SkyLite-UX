import type { H3Event } from "h3";

import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";

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

vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: vi.fn(),
    },
  },
}));

import handler from "~~/server/api/integrations/google_calendar/authCallback.post";

vi.mock("~/lib/prisma");

describe("POST /api/integrations/google_calendar/authCallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createBaseIntegration = () => ({
    id: "integration-1",
    name: "Google Calendar",
    type: "calendar" as const,
    service: "google" as const,
    enabled: true,
    apiKey: null,
    baseUrl: null,
    icon: null,
    settings: {
      clientId: "client-id",
      clientSecret: "client-secret",
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  describe("success flow", () => {
    it("exchanges auth code for refresh token and updates integration", async () => {
      const mockIntegration = createBaseIntegration();
      const { google } = await import("googleapis");
      const mockGetToken = vi.fn().mockResolvedValue({
        tokens: {
          refresh_token: "refresh-token",
          access_token: "access-token",
          expiry_date: Date.now() + 3600000,
        },
      });
      const mockOAuth2 = {
        getToken: mockGetToken,
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.update.mockResolvedValue({
        ...mockIntegration,
        apiKey: "refresh-token",
      } as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(google.auth.OAuth2).mockImplementation(() => mockOAuth2 as never);

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          authCode: "auth-code-123",
        },
      });

      const response = await handler(event);

      expect(prisma.integration.findFirst).toHaveBeenCalledWith({
        where: {
          id: "integration-1",
          type: "calendar",
          service: "google",
        },
      });
      expect(mockGetToken).toHaveBeenCalledWith("auth-code-123");
      expect(prisma.integration.update).toHaveBeenCalledWith({
        where: { id: "integration-1" },
        data: { apiKey: "refresh-token" },
      });
      expect(response).toEqual({ success: true });
    });
  });

  describe("error handling", () => {
    it("throws 400 when integrationId is missing", async () => {
      const event = createMockH3Event({
        method: "POST",
        body: {
          authCode: "auth-code-123",
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 400 when integrationId is not a string", async () => {
      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: 123,
          authCode: "auth-code-123",
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 400 when authCode is missing", async () => {
      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 400 when authCode is not a string", async () => {
      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          authCode: 123,
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
          authCode: "auth-code-123",
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
          authCode: "auth-code-123",
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 400 when no refresh token received", async () => {
      const mockIntegration = createBaseIntegration();
      const { google } = await import("googleapis");
      const mockGetToken = vi.fn().mockResolvedValue({
        tokens: {
          access_token: "access-token",
          expiry_date: Date.now() + 3600000,
        },
      });
      const mockOAuth2 = {
        getToken: mockGetToken,
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);

      vi.mocked(google.auth.OAuth2).mockImplementation(() => mockOAuth2 as never);

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          authCode: "auth-code-123",
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("handles OAuth errors", async () => {
      const mockIntegration = createBaseIntegration();
      const { google } = await import("googleapis");
      const mockGetToken = vi.fn().mockRejectedValue(new Error("Invalid grant"));
      const mockOAuth2 = {
        getToken: mockGetToken,
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);

      vi.mocked(google.auth.OAuth2).mockImplementation(() => mockOAuth2 as never);

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          authCode: "auth-code-123",
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("handles Google API errors", async () => {
      const mockIntegration = createBaseIntegration();
      const { google } = await import("googleapis");
      const apiError = {
        code: 400,
        message: "Invalid request",
      };
      const mockGetToken = vi.fn().mockRejectedValue(apiError);
      const mockOAuth2 = {
        getToken: mockGetToken,
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);

      vi.mocked(google.auth.OAuth2).mockImplementation(() => mockOAuth2 as never);

      const event = createMockH3Event({
        method: "POST",
        body: {
          integrationId: "integration-1",
          authCode: "auth-code-123",
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
