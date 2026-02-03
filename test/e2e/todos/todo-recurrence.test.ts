import type { Todo } from "~/types/database";
import type { ICalEvent } from "~~/server/integrations/iCal/types";

import { $fetch, url } from "@nuxt/test-utils/e2e";
import { describe, it, expect } from "vitest";

describe("Todo Recurrence E2E", () => {
  it("should create a recurring todo", async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const response = await $fetch(url("/api/todos"), {
      method: "POST",
      body: {
        title: "Recurring Daily Todo",
        priority: "MEDIUM",
        rrule: {
          freq: "DAILY",
          interval: 1,
        },
        dueDate: today.toISOString(),
      },
    }) as Todo;

    expect(response).toHaveProperty("id");
    expect(response).toHaveProperty("recurringGroupId");
    if (response.rrule && typeof response.rrule === "object" && "freq" in response.rrule) {
      const rrule = response.rrule as ICalEvent["rrule"];
      expect(rrule).toBeDefined();
      if (rrule) {
        expect(rrule.freq).toBe("DAILY");
      }
    }
  });

  it("should complete a recurring todo and create next instance", async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const createResponse = await $fetch(url("/api/todos"), {
      method: "POST",
      body: {
        title: "Recurring Weekly Todo",
        priority: "MEDIUM",
        rrule: {
          freq: "WEEKLY",
          interval: 1,
          byday: ["MO"],
        },
        dueDate: today.toISOString(),
      },
    }) as Todo;

    const completedResponse = await $fetch(url(`/api/todos/${createResponse.id}`), {
      method: "PUT",
      body: {
        completed: true,
      },
    }) as Todo | { success: boolean };

    if ("completed" in completedResponse) {
      expect(completedResponse.completed).toBe(true);
    }

    const todos = await $fetch(url("/api/todos")) as Todo[];
    const nextInstance = todos.find(
      (t: Todo) =>
        t.recurringGroupId === createResponse.recurringGroupId && !t.completed,
    );

    if (!nextInstance) {
      throw new Error("Next instance not found");
    }
    expect(nextInstance).toBeDefined();
    expect(nextInstance.recurringGroupId).toBe(createResponse.recurringGroupId);
  });

  it("should delete a recurring todo without stopping recurrence", async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const createResponse = await $fetch(url("/api/todos"), {
      method: "POST",
      body: {
        title: "Recurring Monthly Todo",
        priority: "MEDIUM",
        rrule: {
          freq: "MONTHLY",
          interval: 1,
        },
        dueDate: today.toISOString(),
      },
    }) as Todo;

    await $fetch(url(`/api/todos/${createResponse.id}?stopRecurrence=false`), {
      method: "DELETE" as const,
    });

    const todos = await $fetch(url("/api/todos")) as Todo[];
    const nextInstance = todos.find(
      (t: Todo) =>
        t.recurringGroupId === createResponse.recurringGroupId,
    );

    expect(nextInstance).toBeDefined();
  });

  it("should delete a recurring todo and stop recurrence", async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const createResponse = await $fetch(url("/api/todos"), {
      method: "POST",
      body: {
        title: "Recurring Yearly Todo",
        priority: "MEDIUM",
        rrule: {
          freq: "YEARLY",
          interval: 1,
        },
        dueDate: today.toISOString(),
      },
    }) as Todo;

    await $fetch(url(`/api/todos/${createResponse.id}?stopRecurrence=true`), {
      method: "DELETE" as const,
    });

    const todos = await $fetch(url("/api/todos")) as Todo[];
    const remainingInstances = todos.filter(
      (t: Todo) =>
        t.recurringGroupId === createResponse.recurringGroupId,
    );

    expect(remainingInstances.length).toBe(0);
  });
});
