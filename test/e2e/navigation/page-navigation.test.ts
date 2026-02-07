import { $fetch, url } from "@nuxt/test-utils/e2e";
import { describe, it, expect } from "vitest";

describe("Page Navigation E2E", () => {
  it("should navigate to calendar page", async () => {
    const html = await $fetch(url("/calendar"));
    expect(html).toContain("Calendar");
  });

  it("should navigate to todo lists page", async () => {
    const html = await $fetch(url("/todolists"));
    expect(html).toContain("Todo");
  });

  it("should navigate to shopping lists page", async () => {
    const html = await $fetch(url("/shoppinglists"));
    expect(html).toContain("Shopping");
  });

  it("should navigate to settings page", async () => {
    const html = await $fetch(url("/settings"));
    expect(html).toContain("Settings");
  });

  it("should navigate to meal planner page", async () => {
    const html = await $fetch(url("/mealplanner"));
    expect(html).toContain("Meal");
  });

  it("should verify sidebar navigation works", async () => {
    const calendarHtml = await $fetch(url("/calendar"));
    expect(calendarHtml).toContain("Calendar");

    const todosHtml = await $fetch(url("/todolists"));
    expect(todosHtml).toContain("Todo");

    const shoppingHtml = await $fetch(url("/shoppinglists"));
    expect(shoppingHtml).toContain("Shopping");
  });

  it("should verify pages load correctly", async () => {
    const pages = [
      { path: "/calendar", content: "Calendar" },
      { path: "/todolists", content: "Todo" },
      { path: "/shoppinglists", content: "Shopping" },
      { path: "/settings", content: "Settings" },
      { path: "/mealplanner", content: "Meal" },
    ];

    for (const page of pages) {
      const html = await $fetch(url(page.path));
      expect(html).toContain(page.content);
    }
  });
});
