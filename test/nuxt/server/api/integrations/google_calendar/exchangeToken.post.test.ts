import type { H3Event } from "h3";

import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { defineEventHandler, readBody } = useH3TestUtils();

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

import handler from "~~/server/api/integrations/google_calendar/exchangeToken.post";

describe("POST /api/integrations/google_calendar/exchangeToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("success flow", () => {
    it("exchanges auth code for refresh token", async () => {
      const { google } = await import("googleapis");
      const mockGetToken = vi.fn().mockResolvedValue({
        tokens: {
          refresh_token: "refresh-token-123",
          access_token: "access-token",
          expiry_date: Date.now() + 3600000,
        },
      });
      const mockOAuth2 = {
        getToken: mockGetToken,
      };

      vi.mocked(google.auth.OAuth2).mockImplementation(() => mockOAuth2 as never);

      const event = createMockH3Event({
        method: "POST",
        body: {
          clientId: "client-id",
          clientSecret: "client-secret",
          authCode: "auth-code-123",
        },
      });

      const response = await handler(event);

      expect(mockGetToken).toHaveBeenCalledWith("auth-code-123");
      expect(response).toEqual({ refreshToken: "refresh-token-123" });
    });

    it("works with empty clientSecret", async () => {
      const { google } = await import("googleapis");
      const mockGetToken = vi.fn().mockResolvedValue({
        tokens: {
          refresh_token: "refresh-token-123",
          access_token: "access-token",
          expiry_date: Date.now() + 3600000,
        },
      });
      const mockOAuth2 = {
        getToken: mockGetToken,
      };

      vi.mocked(google.auth.OAuth2).mockImplementation(() => mockOAuth2 as never);

      const event = createMockH3Event({
        method: "POST",
        body: {
          clientId: "client-id",
          clientSecret: "",
          authCode: "auth-code-123",
        },
      });

      const response = await handler(event);

      expect(response).toEqual({ refreshToken: "refresh-token-123" });
    });
  });

  describe("error handling", () => {
    it("throws 400 when authCode is missing", async () => {
      const event = createMockH3Event({
        method: "POST",
        body: {
          clientId: "client-id",
          clientSecret: "client-secret",
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 400 when authCode is not a string", async () => {
      const event = createMockH3Event({
        method: "POST",
        body: {
          clientId: "client-id",
          clientSecret: "client-secret",
          authCode: 123,
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 400 when clientId is missing", async () => {
      const event = createMockH3Event({
        method: "POST",
        body: {
          clientSecret: "client-secret",
          authCode: "auth-code-123",
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 400 when clientId is not a string", async () => {
      const event = createMockH3Event({
        method: "POST",
        body: {
          clientId: 123,
          clientSecret: "client-secret",
          authCode: "auth-code-123",
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("throws 400 when no refresh token received", async () => {
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

      vi.mocked(google.auth.OAuth2).mockImplementation(() => mockOAuth2 as never);

      const event = createMockH3Event({
        method: "POST",
        body: {
          clientId: "client-id",
          clientSecret: "client-secret",
          authCode: "auth-code-123",
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("handles OAuth errors", async () => {
      const { google } = await import("googleapis");
      const mockGetToken = vi.fn().mockRejectedValue(new Error("Invalid grant"));
      const mockOAuth2 = {
        getToken: mockGetToken,
      };

      vi.mocked(google.auth.OAuth2).mockImplementation(() => mockOAuth2 as never);

      const event = createMockH3Event({
        method: "POST",
        body: {
          clientId: "client-id",
          clientSecret: "client-secret",
          authCode: "auth-code-123",
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });

    it("handles Google API errors", async () => {
      const { google } = await import("googleapis");
      const apiError = {
        code: 400,
        message: "Invalid request",
      };
      const mockGetToken = vi.fn().mockRejectedValue(apiError);
      const mockOAuth2 = {
        getToken: mockGetToken,
      };

      vi.mocked(google.auth.OAuth2).mockImplementation(() => mockOAuth2 as never);

      const event = createMockH3Event({
        method: "POST",
        body: {
          clientId: "client-id",
          clientSecret: "client-secret",
          authCode: "auth-code-123",
        },
      });

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
