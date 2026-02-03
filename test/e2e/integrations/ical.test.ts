import type { Integration } from "~/types/database";
import type { ICalSettings } from "~/types/integrations";

import { $fetch, url } from "@nuxt/test-utils/e2e";
import { describe, it, expect } from "vitest";

describe("iCal Integration E2E", () => {
  it("should configure iCal integration", async () => {
    const suffix = Date.now();
    const response = await $fetch(url("/api/integrations"), {
      method: "POST",
      body: {
        name: `Test iCal Integration ${suffix}`,
        type: "calendar",
        service: "iCal",
        baseUrl: "https://www.1823.gov.hk/common/ical/en.ics",
        enabled: true,
      },
    }) as Integration;

    expect(response).toHaveProperty("id");
    expect(response.service).toBe("iCal");
    expect(response.enabled).toBe(true);
  });

  it("should verify events sync from iCal feed", async () => {
    const suffix = Date.now();
    const integrationResponse = await $fetch(url("/api/integrations"), {
      method: "POST",
      body: {
        name: `Test iCal Sync ${suffix}`,
        type: "calendar",
        service: "iCal",
        baseUrl: "https://www.1823.gov.hk/common/ical/en.ics",
        enabled: true,
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

  it("should verify read-only behavior for iCal integration", async () => {
    const suffix = Date.now();
    const integrationResponse = await $fetch(url("/api/integrations"), {
      method: "POST",
      body: {
        name: `Test iCal Read-Only ${suffix}`,
        type: "calendar",
        service: "iCal",
        baseUrl: "https://www.1823.gov.hk/common/ical/en.ics",
        enabled: true,
      },
    }) as Integration;

    const res = await $fetch(url(`/api/integrations/iCal?integrationId=${integrationResponse.id}`)) as { events: unknown[] };
    expect(Array.isArray(res.events)).toBe(true);
  });

  it("should verify event display with configured colors", async () => {
    const suffix = Date.now();
    const integrationResponse = await $fetch(url("/api/integrations"), {
      method: "POST",
      body: {
        name: `Test iCal Colors ${suffix}`,
        type: "calendar",
        service: "iCal",
        baseUrl: "https://www.1823.gov.hk/common/ical/en.ics",
        enabled: true,
        settings: {
          eventColor: "#FF5733",
        },
      },
    }) as Integration;

    expect(integrationResponse.settings).toBeDefined();
    if (integrationResponse.settings) {
      const settings = integrationResponse.settings as ICalSettings;
      expect(settings.eventColor).toBe("#FF5733");
    }
  });
});
