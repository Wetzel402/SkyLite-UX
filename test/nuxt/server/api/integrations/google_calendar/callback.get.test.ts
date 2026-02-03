import type { H3Event } from "h3";

import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { beforeEach, describe, expect, it, vi } from "vitest";

import prisma from "~/lib/__mocks__/prisma";

const { defineEventHandler, getQuery } = useH3TestUtils();

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
    sendRedirect: vi.fn(),
  };
});

vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: vi.fn(),
    },
  },
}));

import { sendRedirect } from "h3";
import handler from "~~/server/api/integrations/google_calendar/callback.get";

vi.mock("~/lib/prisma");

describe("GET /api/integrations/google_calendar/callback", () => {
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
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const createStateData = (isReAuth = false) => {
    const baseData = {
      name: "Google Calendar",
      type: "calendar" as const,
      service: "google" as const,
      enabled: true,
      settings: {
        clientId: "client-id",
        clientSecret: "client-secret",
      },
      redirectUri: "http://localhost:3000/callback",
    };

    if (isReAuth) {
      return {
        ...baseData,
        integrationId: "integration-1",
      };
    }

    return baseData;
  };

  describe("new integration creation", () => {
    it("creates new integration with refresh token", async () => {
      const { google } = await import("googleapis");
      const stateData = createStateData(false);
      const state = encodeURIComponent(JSON.stringify(stateData));
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

      const mockIntegration = {
        ...createBaseIntegration(),
        id: "new-integration-1",
      };

      prisma.integration.create.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.create>>);

      vi.mocked(google.auth.OAuth2).mockImplementation(() => mockOAuth2 as never);

      const event = createMockH3Event({
        method: "GET",
        query: {
          code: "auth-code-123",
          state,
        },
      });

      await handler(event);

      expect(prisma.integration.create).toHaveBeenCalledWith({
        data: {
          name: "Google Calendar",
          type: "calendar",
          service: "google",
          apiKey: "refresh-token",
          baseUrl: null,
          icon: null,
          enabled: true,
          settings: {
            clientId: "client-id",
            clientSecret: "client-secret",
            accessToken: "access-token",
            tokenExpiry: expect.any(Number),
            needsReauth: undefined,
          },
        },
      });
      expect(sendRedirect).toHaveBeenCalledWith(
        event,
        `/settings?success=google_calendar_added&integrationId=${mockIntegration.id}`,
      );
    });
  });

  describe("re-authentication", () => {
    it("updates existing integration with new refresh token", async () => {
      const { google } = await import("googleapis");
      const stateData = createStateData(true);
      const state = encodeURIComponent(JSON.stringify(stateData));
      const mockIntegration = createBaseIntegration();
      const mockGetToken = vi.fn().mockResolvedValue({
        tokens: {
          refresh_token: "new-refresh-token",
          access_token: "new-access-token",
          expiry_date: Date.now() + 3600000,
        },
      });
      const mockOAuth2 = {
        getToken: mockGetToken,
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);
      prisma.integration.update.mockResolvedValue({
        ...mockIntegration,
        apiKey: "new-refresh-token",
      } as Awaited<ReturnType<typeof prisma.integration.update>>);

      vi.mocked(google.auth.OAuth2).mockImplementation(() => mockOAuth2 as never);

      const event = createMockH3Event({
        method: "GET",
        query: {
          code: "auth-code-123",
          state,
        },
      });

      await handler(event);

      expect(prisma.integration.findFirst).toHaveBeenCalledWith({
        where: {
          id: "integration-1",
          type: "calendar",
          service: "google",
        },
      });
      expect(prisma.integration.update).toHaveBeenCalledWith({
        where: { id: "integration-1" },
        data: {
          apiKey: "new-refresh-token",
          settings: expect.objectContaining({
            accessToken: "new-access-token",
            tokenExpiry: expect.any(Number),
            needsReauth: undefined,
          }),
        },
      });
      expect(sendRedirect).toHaveBeenCalledWith(
        event,
        `/settings?success=google_calendar_added&integrationId=integration-1`,
      );
    });
  });

  describe("OAuth error handling", () => {
    it("redirects with error when OAuth error is present", async () => {
      const event = createMockH3Event({
        method: "GET",
        query: {
          error: "access_denied",
        },
      });

      await handler(event);

      expect(sendRedirect).toHaveBeenCalledWith(
        event,
        `/settings?error=${encodeURIComponent("access_denied")}`,
      );
    });
  });

  describe("error handling", () => {
    it("throws 400 when code is missing", async () => {
      const stateData = createStateData(false);
      const state = encodeURIComponent(JSON.stringify(stateData));

      const event = createMockH3Event({
        method: "GET",
        query: {
          state,
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 400 when state is missing", async () => {
      const event = createMockH3Event({
        method: "GET",
        query: {
          code: "auth-code-123",
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("redirects with error when state JSON is invalid", async () => {
      const event = createMockH3Event({
        method: "GET",
        query: {
          code: "auth-code-123",
          state: "invalid-json",
        },
      });

      await handler(event);

      expect(sendRedirect).toHaveBeenCalledWith(
        event,
        expect.stringContaining("/settings?error="),
      );
    });

    it("redirects with error when redirectUri is missing in state", async () => {
      const stateData = {
        name: "Google Calendar",
        type: "calendar",
        service: "google",
        enabled: true,
        settings: {
          clientId: "client-id",
          clientSecret: "client-secret",
        },
      };
      const state = encodeURIComponent(JSON.stringify(stateData));

      const event = createMockH3Event({
        method: "GET",
        query: {
          code: "auth-code-123",
          state,
        },
      });

      await handler(event);

      expect(sendRedirect).toHaveBeenCalledWith(
        event,
        expect.stringContaining("/settings?error="),
      );
    });

    it("redirects with error when clientId is missing in new integration data", async () => {
      const stateData = {
        name: "Google Calendar",
        type: "calendar",
        service: "google",
        enabled: true,
        settings: {},
        redirectUri: "http://localhost:3000/callback",
      };
      const state = encodeURIComponent(JSON.stringify(stateData));

      const event = createMockH3Event({
        method: "GET",
        query: {
          code: "auth-code-123",
          state,
        },
      });

      await handler(event);

      expect(sendRedirect).toHaveBeenCalledWith(
        event,
        expect.stringContaining("/settings?error="),
      );
    });

    it("redirects with error when clientSecret is missing in new integration data", async () => {
      const stateData = {
        name: "Google Calendar",
        type: "calendar",
        service: "google",
        enabled: true,
        settings: {
          clientId: "client-id",
        },
        redirectUri: "http://localhost:3000/callback",
      };
      const state = encodeURIComponent(JSON.stringify(stateData));

      const event = createMockH3Event({
        method: "GET",
        query: {
          code: "auth-code-123",
          state,
        },
      });

      await handler(event);

      expect(sendRedirect).toHaveBeenCalledWith(
        event,
        expect.stringContaining("/settings?error="),
      );
    });

    it("redirects with error when integration not found in re-auth", async () => {
      const stateData = createStateData(true);
      const state = encodeURIComponent(JSON.stringify(stateData));

      prisma.integration.findFirst.mockResolvedValue(null);

      const event = createMockH3Event({
        method: "GET",
        query: {
          code: "auth-code-123",
          state,
        },
      });

      await handler(event);

      expect(sendRedirect).toHaveBeenCalledWith(
        event,
        expect.stringContaining("/settings?error="),
      );
    });

    it("redirects with error when clientId is missing in re-auth integration settings", async () => {
      const stateData = createStateData(true);
      const state = encodeURIComponent(JSON.stringify(stateData));
      const mockIntegration = {
        ...createBaseIntegration(),
        settings: {},
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);

      const event = createMockH3Event({
        method: "GET",
        query: {
          code: "auth-code-123",
          state,
        },
      });

      await handler(event);

      expect(sendRedirect).toHaveBeenCalledWith(
        event,
        expect.stringContaining("/settings?error="),
      );
    });

    it("redirects with error when clientSecret is missing in re-auth integration settings", async () => {
      const stateData = createStateData(true);
      const state = encodeURIComponent(JSON.stringify(stateData));
      const mockIntegration = {
        ...createBaseIntegration(),
        settings: {
          clientId: "client-id",
        },
      };

      prisma.integration.findFirst.mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findFirst>>);

      const event = createMockH3Event({
        method: "GET",
        query: {
          code: "auth-code-123",
          state,
        },
      });

      await handler(event);

      expect(sendRedirect).toHaveBeenCalledWith(
        event,
        expect.stringContaining("/settings?error="),
      );
    });

    it("redirects with error when no refresh token received", async () => {
      const { google } = await import("googleapis");
      const stateData = createStateData(false);
      const state = encodeURIComponent(JSON.stringify(stateData));
      const mockGetToken = vi.fn().mockResolvedValue({
        tokens: {
          access_token: "access-token",
          expiry_date: Date.now() + 3600000,
        },
      });
      const mockOAuth2 = {
        getToken: mockGetToken,
      };

      vi.mocked(google.auth.OAuth2).mockImplementation(() => mockOAuth2 as never);

      const event = createMockH3Event({
        method: "GET",
        query: {
          code: "auth-code-123",
          state,
        },
      });

      await handler(event);

      expect(sendRedirect).toHaveBeenCalledWith(
        event,
        expect.stringContaining("/settings?error="),
      );
    });

    it("handles OAuth errors and redirects with error", async () => {
      const { google } = await import("googleapis");
      const stateData = createStateData(false);
      const state = encodeURIComponent(JSON.stringify(stateData));
      const mockGetToken = vi.fn().mockRejectedValue(new Error("Invalid grant"));
      const mockOAuth2 = {
        getToken: mockGetToken,
      };

      vi.mocked(google.auth.OAuth2).mockImplementation(() => mockOAuth2 as never);

      const event = createMockH3Event({
        method: "GET",
        query: {
          code: "auth-code-123",
          state,
        },
      });

      await handler(event);

      expect(sendRedirect).toHaveBeenCalledWith(
        event,
        expect.stringContaining("/settings?error="),
      );
    });
  });
});
