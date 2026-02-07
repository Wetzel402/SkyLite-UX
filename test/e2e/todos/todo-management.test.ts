import type { Todo } from "~/types/database";

import { $fetch, url } from "@nuxt/test-utils/e2e";
import { describe, it, expect } from "vitest";

describe("Todo Management E2E", () => {
  it("should navigate to todo lists page", async () => {
    const html = await $fetch(url("/todolists"));
    expect(html).toContain("Todo");
  });

  it("should create a new todo item", async () => {
    const response = await $fetch(url("/api/todos"), {
      method: "POST",
      body: {
        title: "E2E Test Todo",
        description: "Created by e2e test",
        priority: "MEDIUM",
      },
    }) as Todo;

    expect(response).toHaveProperty("id");
    expect(response.title).toBe("E2E Test Todo");
  });

  it("should edit a todo item", async () => {
    const createResponse = await $fetch(url("/api/todos"), {
      method: "POST",
      body: {
        title: "Original Title",
        priority: "MEDIUM",
      },
    }) as Todo;

    const updateResponse = await $fetch(url(`/api/todos/${createResponse.id}`), {
      method: "PUT",
      body: {
        title: "Updated Title",
        description: "Updated description",
        priority: "HIGH",
      },
    }) as Todo | { success: boolean };

    if ("title" in updateResponse) {
      expect(updateResponse.title).toBe("Updated Title");
      expect(updateResponse.description).toBe("Updated description");
      expect(updateResponse.priority).toBe("HIGH");
    }
  });

  it("should delete a todo item", async () => {
    const createResponse = await $fetch(url("/api/todos"), {
      method: "POST",
      body: {
        title: "Todo to Delete",
        priority: "MEDIUM",
      },
    }) as Todo;

    await $fetch(url(`/api/todos/${createResponse.id}`), {
      method: "DELETE" as const,
    });

    const todos = await $fetch(url("/api/todos")) as Todo[];
    const deletedTodo = todos.find((t) => t.id === createResponse.id);
    expect(deletedTodo).toBeUndefined();
  });

  it("should complete and uncomplete a todo", async () => {
    const createResponse = await $fetch(url("/api/todos"), {
      method: "POST",
      body: {
        title: "Todo to Complete",
        priority: "MEDIUM",
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

    const uncompletedResponse = await $fetch(url(`/api/todos/${createResponse.id}`), {
      method: "PUT",
      body: {
        completed: false,
      },
    }) as Todo | { success: boolean };

    if ("completed" in uncompletedResponse) {
      expect(uncompletedResponse.completed).toBe(false);
    }
  });

  it("should create a todo column", async () => {
    const response = await $fetch(url("/api/todo-columns"), {
      method: "POST",
      body: {
        name: "E2E Test Column",
      },
    }) as { id: string; name: string };

    expect(response).toHaveProperty("id");
    expect(response.name).toBe("E2E Test Column");
  });

  it("should reorder todos", async () => {
    const todo1 = await $fetch(url("/api/todos"), {
      method: "POST",
      body: {
        title: "Todo 1",
        priority: "MEDIUM",
      },
    }) as Todo;

    const todo2 = await $fetch(url("/api/todos"), {
      method: "POST",
      body: {
        title: "Todo 2",
        priority: "MEDIUM",
      },
    }) as Todo;

    await $fetch(url("/api/todos/reorder"), {
      method: "PUT",
      body: {
        todoIds: [todo2.id, todo1.id],
      },
    });

    const todos = await $fetch(url("/api/todos")) as Todo[];
    const updatedTodo1 = todos.find((t) => t.id === todo1.id);
    const updatedTodo2 = todos.find((t) => t.id === todo2.id);
    expect(updatedTodo1).toBeDefined();
    expect(updatedTodo2).toBeDefined();
    expect(updatedTodo1!.order).toBeGreaterThan(updatedTodo2!.order);
  });
});
