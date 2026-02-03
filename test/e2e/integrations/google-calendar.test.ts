import type { Integration } from "~/types/database";

import { $fetch, url } from "@nuxt/test-utils/e2e";
import { describe, it, expect } from "vitest";

describe("Google Calendar Integration E2E", () => {
  it("should configure Google Calendar integration", async () => {
    const suffix = Date.now();
    const response = await $fetch(url("/api/integrations"), {
      method: "POST",
      body: {
        name: `Test Google Calendar ${suffix}`,
        type: "calendar",
        service: "google",
        enabled: true,
        settings: {
          clientId: "e2e-client-id",
          clientSecret: "e2e-client-secret",
          calendarIds: ["primary"],
        },
      },
    }) as Integration;

    expect(response).toHaveProperty("id");
    expect(response.service).toBe("google");
    expect(response.enabled).toBe(true);
  });

  it("should verify events sync from Google Calendar", async () => {
    const suffix = Date.now();
    const integrationResponse = await $fetch(url("/api/integrations"), {
      method: "POST",
      body: {
        name: `Test Google Calendar Sync ${suffix}`,
        type: "calendar",
        service: "google",
        enabled: true,
        settings: {
          clientId: "e2e-client-id",
          clientSecret: "e2e-client-secret",
        },
      },
    }) as Integration;

    const syncResponse = await $fetch(url("/api/sync/trigger"), {
      method: "POST",
      body: {
        integrationId: integrationResponse.id,
        integrationType: "calendar",
      },
    });

    expect(syncResponse).toBeDefined();
  });
});
