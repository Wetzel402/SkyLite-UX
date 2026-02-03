import type { Integration } from "~/types/database";

import { $fetch, url } from "@nuxt/test-utils/e2e";
import { describe, it, expect } from "vitest";

describe("Integration CRUD E2E", () => {
  it("should create, update, and delete an integration", async () => {
    const suffix = Date.now();
    const createName = `E2E CRUD iCal ${suffix}`;
    const updatedName = `E2E CRUD Updated ${suffix}`;
    const created = await $fetch(url("/api/integrations"), {
      method: "POST",
      body: {
        name: createName,
        type: "calendar",
        service: "iCal",
        baseUrl: "https://www.1823.gov.hk/common/ical/en.ics",
        enabled: true,
      },
    }) as Integration;

    expect(created).toHaveProperty("id");
    expect(created.name).toBe(createName);
    expect(created.enabled).toBe(true);

    const listBefore = await $fetch(url("/api/integrations")) as Integration[];
    expect(listBefore.some(i => i.id === created.id)).toBe(true);

    const updated = await $fetch(url(`/api/integrations/${created.id}`), {
      method: "PUT",
      body: { name: updatedName, enabled: false },
    }) as Integration;

    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe(updatedName);
    expect(updated.enabled).toBe(false);

    const deleteResult = await $fetch(url(`/api/integrations/${created.id}`), {
      method: "DELETE" as const,
    }) as { success?: boolean };

    expect(deleteResult).toMatchObject({ success: true });

    const listAfter = await $fetch(url("/api/integrations")) as Integration[];
    expect(listAfter.some(i => i.id === created.id)).toBe(false);
  });
});
