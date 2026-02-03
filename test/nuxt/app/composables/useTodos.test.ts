import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";

import type { TodoWithOrder } from "~/types/database";

vi.mock("consola", () => ({
  consola: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

const testDate = new Date("2026-01-26T00:00:00Z");

const { mockUseNuxtData, mockRefreshNuxtData, todosDataRef } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref } = require("vue");
  const todosRef = ref([]);
  const store = new Map();
  store.set("todos", todosRef);

  const useNuxtDataMock = vi.fn((key: string) => {
    if (!store.has(key)) {
      store.set(key, ref(null));
    }
    return { data: store.get(key)! };
  });

  const refreshNuxtDataMock = vi.fn(async (key: string) => {
    if (key === "todos" && store.has(key)) {
      store.get(key)!.value = todosRef.value;
    }
    return undefined;
  });

  return {
    mockUseNuxtData: useNuxtDataMock,
    mockRefreshNuxtData: refreshNuxtDataMock,
    todosDataRef: todosRef,
  };
});

mockNuxtImport("useNuxtData", () => mockUseNuxtData);
mockNuxtImport("refreshNuxtData", () => mockRefreshNuxtData);

import { useTodos } from "../../../../app/composables/useTodos";

describe("useTodos", () => {
  const todoColumn = {
    id: "column-1",
    name: "To Do",
    order: 1,
    isDefault: true,
    userId: "user-1",
    createdAt: testDate,
    updatedAt: testDate,
    user: { id: "user-1", name: "Test User", avatar: null },
  };

  const mockTodos: TodoWithOrder[] = [
    {
      id: "todo-1",
      title: "Test Todo 1",
      description: "Description 1",
      priority: "MEDIUM",
      completed: false,
      order: 1,
      dueDate: null,
      todoColumnId: "column-1",
      recurringGroupId: null,
      rrule: null,
      createdAt: testDate,
      updatedAt: testDate,
      todoColumn,
    },
    {
      id: "todo-2",
      title: "Test Todo 2",
      description: "Description 2",
      priority: "HIGH",
      completed: false,
      order: 2,
      dueDate: null,
      todoColumnId: "column-1",
      recurringGroupId: null,
      rrule: null,
      createdAt: testDate,
      updatedAt: testDate,
      todoColumn,
    },
    {
      id: "todo-3",
      title: "Test Todo 3",
      description: "Description 3",
      priority: "LOW",
      completed: true,
      order: 3,
      dueDate: null,
      todoColumnId: "column-1",
      recurringGroupId: null,
      rrule: null,
      createdAt: testDate,
      updatedAt: testDate,
      todoColumn,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    todosDataRef.value = [...mockTodos];
  });

  it("should return todos from useNuxtData", () => {
    const { todos } = useTodos();
    expect(todos.value).toEqual(mockTodos);
  });

  it("should return empty array when todos data is null", () => {
    todosDataRef.value = null;
    const { todos } = useTodos();
    expect(todos.value).toEqual([]);
  });

  it("should have loading state", () => {
    const { loading } = useTodos();
    expect(loading.value).toBe(false);
  });

  it("should have error state", () => {
    const { error } = useTodos();
    expect(error.value).toBeNull();
  });

  describe("fetchTodos", () => {
    it("should fetch todos successfully", async () => {
      const { fetchTodos, loading } = useTodos();

      const result = await fetchTodos();

      expect(mockRefreshNuxtData).toHaveBeenCalledWith("todos");
      expect(loading.value).toBe(false);
      expect(result).toEqual(mockTodos);
    });

    it("should set loading to true during fetch", async () => {
      mockRefreshNuxtData.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100)),
      );
      const { fetchTodos, loading } = useTodos();

      const fetchPromise = fetchTodos();
      expect(loading.value).toBe(true);

      await fetchPromise;
      expect(loading.value).toBe(false);
    });

    it("should handle fetch errors", async () => {
      const error = new Error("Fetch failed");
      mockRefreshNuxtData.mockRejectedValue(error);
      const { fetchTodos, error: errorState } = useTodos();

      await expect(fetchTodos()).rejects.toThrow("Fetch failed");
      expect(errorState.value).toBe("Failed to fetch todos");
    });
  });

  describe("reorderTodo", () => {
    it("should not reorder if todo not found", async () => {
      const { reorderTodo } = useTodos();
      await reorderTodo("non-existent", "up", "column-1");
      expect(mockRefreshNuxtData).not.toHaveBeenCalled();
    });

    it("should not reorder if already at top", async () => {
      const { reorderTodo } = useTodos();
      await reorderTodo("todo-1", "up", "column-1");
      expect(mockRefreshNuxtData).not.toHaveBeenCalled();
    });
  });

  describe("clearCompleted", () => {
    it("should not call API if no completed todos", async () => {
      todosDataRef.value = [mockTodos[0]!];
      const { clearCompleted } = useTodos();
      await clearCompleted("column-1");
      expect(mockRefreshNuxtData).not.toHaveBeenCalled();
    });
  });
});
