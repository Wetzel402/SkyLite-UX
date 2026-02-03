import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";

import type { ShoppingListWithOrder } from "~/types/database";

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
  listsDataRef,
} = vi.hoisted(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ref } = require("vue");
    const dataRef = ref([]);
    const store = new Map();
    store.set("native-shopping-lists", dataRef);

    const useNuxtDataMock = vi.fn((key: string) => {
      if (!store.has(key)) {
        store.set(key, ref(null));
      }
      return { data: store.get(key)! };
    });

    const refreshNuxtDataMock = vi.fn(async (key: string) => {
      if (key === "native-shopping-lists" && store.has(key)) {
        store.get(key)!.value = dataRef.value;
      }
      return undefined;
    });

    const fetchMock = vi.fn();
    return {
      mockUseNuxtData: useNuxtDataMock,
      mockRefreshNuxtData: refreshNuxtDataMock,
      mockFetch: fetchMock,
      listsDataRef: dataRef,
    };
  },
);

mockNuxtImport("useNuxtData", () => mockUseNuxtData);
mockNuxtImport("refreshNuxtData", () => mockRefreshNuxtData);

import { useShoppingLists } from "../../../../app/composables/useShoppingLists";

describe("useShoppingLists", () => {
  const mockLists: ShoppingListWithOrder[] = [
    {
      id: "list-1",
      name: "Groceries",
      order: 1,
      createdAt: testDate,
      updatedAt: testDate,
      items: [],
      _count: { items: 0 },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    listsDataRef.value = [...mockLists];
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should return shopping lists from useNuxtData", () => {
    const { shoppingLists } = useShoppingLists();
    expect(shoppingLists.value).toEqual(mockLists);
  });

  it("should return empty array when lists data is null", () => {
    listsDataRef.value = null;
    const { shoppingLists } = useShoppingLists();
    expect(shoppingLists.value).toEqual([]);
  });

  it("should return multiple lists when data has many items", () => {
    const many = [
      ...mockLists,
      { ...mockLists[0]!, id: "list-2", name: "Second", order: 2 },
      { ...mockLists[0]!, id: "list-3", name: "Third", order: 3 },
    ];
    listsDataRef.value = many;
    const { shoppingLists } = useShoppingLists();
    expect(shoppingLists.value).toHaveLength(3);
  });

  it("should have loading state", () => {
    const { loading } = useShoppingLists();
    expect(loading.value).toBe(false);
  });

  it("should have error state", () => {
    const { error } = useShoppingLists();
    expect(error.value).toBeNull();
  });

  describe("getShoppingLists", () => {
    it("should call refreshNuxtData and return lists", async () => {
      const { getShoppingLists, loading } = useShoppingLists();

      await getShoppingLists();

      expect(mockRefreshNuxtData).toHaveBeenCalledWith("native-shopping-lists");
      expect(loading.value).toBe(false);
    });

    it("should set loading to true during fetch", async () => {
      mockRefreshNuxtData.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100)),
      );
      const { getShoppingLists, loading } = useShoppingLists();

      const fetchPromise = getShoppingLists();
      expect(loading.value).toBe(true);

      await fetchPromise;
      expect(loading.value).toBe(false);
    });

    it("should handle fetch errors", async () => {
      mockRefreshNuxtData.mockRejectedValueOnce(new Error("Fetch failed"));
      const { getShoppingLists, error } = useShoppingLists();

      await expect(getShoppingLists()).rejects.toThrow("Fetch failed");
      expect(error.value).toBe("Failed to fetch shopping lists");
    });
  });

  describe("deleteShoppingList", () => {
    it("should delete and refresh when fetch ok", async () => {
      mockFetch.mockResolvedValue({ ok: true });
      const { deleteShoppingList } = useShoppingLists();

      await deleteShoppingList("list-1");

      expect(mockFetch).toHaveBeenCalledWith("/api/shopping-lists/list-1", {
        method: "DELETE",
      });
      expect(mockRefreshNuxtData).toHaveBeenCalledWith("native-shopping-lists");
    });

    it("should set error when fetch not ok", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      const { deleteShoppingList, error } = useShoppingLists();

      await expect(deleteShoppingList("list-1")).rejects.toThrow(
        "Failed to delete shopping list",
      );
      expect(error.value).toBe("Failed to delete shopping list");
    });
  });
});
