import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";

import type { TodoColumn } from "~/types/database";

vi.mock("consola", () => ({
  consola: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

const testDate = new Date("2026-01-26T12:00:00Z");

const {
  mockUseNuxtData,
  mockRefreshNuxtData,
  mockFetch,
  columnsDataRef,
} = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref } = require("vue");
  const dataRef = ref([]);
  const store = new Map();
  store.set("todo-columns", dataRef);

  const useNuxtDataMock = vi.fn((key: string) => {
    if (!store.has(key)) {
      store.set(key, ref(null));
    }
    return { data: store.get(key)! };
  });

  const refreshNuxtDataMock = vi.fn(async (key: string) => {
    if (key === "todo-columns" && store.has(key)) {
      store.get(key)!.value = dataRef.value;
    }
    return undefined;
  });

  const fetchMock = vi.fn();
  return {
    mockUseNuxtData: useNuxtDataMock,
    mockRefreshNuxtData: refreshNuxtDataMock,
    mockFetch: fetchMock,
    columnsDataRef: dataRef,
  };
});

mockNuxtImport("useNuxtData", () => mockUseNuxtData);
mockNuxtImport("refreshNuxtData", () => mockRefreshNuxtData);

import { useTodoColumns } from "../../../../app/composables/useTodoColumns";

describe("useTodoColumns", () => {
  const mockColumns: TodoColumn[] = [
    {
      id: "col-1",
      name: "To Do",
      order: 1,
      isDefault: true,
      userId: "user-1",
      createdAt: testDate.toISOString(),
      updatedAt: testDate.toISOString(),
      user: { id: "user-1", name: "Test User", avatar: null },
      _count: { todos: 0 },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    columnsDataRef.value = [...mockColumns];
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should return todo columns from useNuxtData", () => {
    const { todoColumns } = useTodoColumns();
    expect(todoColumns.value).toEqual(mockColumns);
  });

  it("should return empty array when columns data is null", () => {
    columnsDataRef.value = null;
    const { todoColumns } = useTodoColumns();
    expect(todoColumns.value).toEqual([]);
  });

  it("should return multiple columns when data has many items", () => {
    const many = [
      ...mockColumns,
      { ...mockColumns[0]!, id: "col-2", name: "Second", order: 2 },
      { ...mockColumns[0]!, id: "col-3", name: "Third", order: 3 },
    ];
    columnsDataRef.value = many;
    const { todoColumns } = useTodoColumns();
    expect(todoColumns.value).toHaveLength(3);
  });

  it("should have loading state", () => {
    const { loading } = useTodoColumns();
    expect(loading.value).toBe(false);
  });

  it("should have error state", () => {
    const { error } = useTodoColumns();
    expect(error.value).toBeNull();
  });

  describe("fetchTodoColumns", () => {
    it("should fetch columns and call refreshNuxtData", async () => {
      const { fetchTodoColumns, loading } = useTodoColumns();

      await fetchTodoColumns();

      expect(mockRefreshNuxtData).toHaveBeenCalledWith("todo-columns");
      expect(loading.value).toBe(false);
    });

    it("should set loading to true during fetch", async () => {
      mockRefreshNuxtData.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100)),
      );
      const { fetchTodoColumns, loading } = useTodoColumns();

      const fetchPromise = fetchTodoColumns();
      expect(loading.value).toBe(true);

      await fetchPromise;
      expect(loading.value).toBe(false);
    });

    it("should handle fetch errors", async () => {
      mockRefreshNuxtData.mockRejectedValueOnce(new Error("Fetch failed"));
      const { fetchTodoColumns, error } = useTodoColumns();

      await expect(fetchTodoColumns()).rejects.toThrow("Fetch failed");
      expect(error.value).toBe("Fetch failed");
    });
  });

  describe("deleteTodoColumn", () => {
    it("should delete and refresh when fetch ok", async () => {
      mockFetch.mockResolvedValue({ ok: true });
      const { deleteTodoColumn } = useTodoColumns();

      const result = await deleteTodoColumn("col-1");

      expect(mockFetch).toHaveBeenCalledWith("/api/todo-columns/col-1", {
        method: "DELETE",
      });
      expect(mockRefreshNuxtData).toHaveBeenCalledWith("todo-columns");
      expect(result).toBe(true);
    });

    it("should set error when fetch not ok", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      const { deleteTodoColumn, error } = useTodoColumns();

      await expect(deleteTodoColumn("col-1")).rejects.toThrow(
        "Failed to delete todo column",
      );
      expect(error.value).toBe("Failed to delete todo column");
    });
  });
});
