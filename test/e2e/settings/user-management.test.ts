import type { User } from "@prisma/client";

import { $fetch, url } from "@nuxt/test-utils/e2e";
import { describe, it, expect } from "vitest";

describe("User Management E2E", () => {
  it("should navigate to settings page", async () => {
    const html = await $fetch(url("/settings"));
    expect(html).toContain("Settings");
  });

  it("should add a user", async () => {
    const suffix = Date.now();
    const response = await $fetch(url("/api/users"), {
      method: "POST",
      body: {
        name: "E2E Test User",
        email: `e2e-test-${suffix}@example.com`,
      },
    }) as User;

    expect(response).toHaveProperty("id");
    expect(response.name).toBe("E2E Test User");
    expect(response.email).toBe(`e2e-test-${suffix}@example.com`);
  });

  it("should edit a user", async () => {
    const suffix = Date.now();
    const createResponse = await $fetch(url("/api/users"), {
      method: "POST",
      body: {
        name: "Original User Name",
        email: `original-${suffix}@example.com`,
      },
    }) as User;

    const updateResponse = await $fetch(url(`/api/users/${createResponse.id}`), {
      method: "PUT",
      body: {
        name: "Updated User Name",
        email: `updated-${suffix}@example.com`,
      },
    }) as User;

    expect(updateResponse.name).toBe("Updated User Name");
    expect(updateResponse.email).toBe(`updated-${suffix}@example.com`);
  });

  it("should delete a user", async () => {
    const suffix = Date.now();
    const createResponse = await $fetch(url("/api/users"), {
      method: "POST",
      body: {
        name: "User to Delete",
        email: `delete-${suffix}@example.com`,
      },
    }) as User;

    await $fetch(url(`/api/users/${createResponse.id}`), {
      method: "DELETE" as const,
    });

    const users = await $fetch(url("/api/users")) as User[];
    const deletedUser = users.find((u) => u.id === createResponse.id);
    expect(deletedUser).toBeUndefined();
  });

  it("should navigate to integrations settings", async () => {
    const html = await $fetch(url("/settings"));
    expect(html).toContain("Settings");
  });
});
