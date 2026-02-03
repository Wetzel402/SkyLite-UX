import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";

import type { User, UserWithOrder } from "~/types/database";

vi.mock("consola", () => ({
  consola: {
    error: vi.fn(),
  },
}));

const testDate = new Date("2026-01-26T12:00:00Z");

const {
  mockUseNuxtData,
  mockRefreshNuxtData,
  mockUseAsyncData,
  usersDataRef,
  currentUserDataRef,
} = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref } = require("vue");
  const usersRef = ref([]);
  const currentUserRef = ref(null);
  const store = new Map<string, ReturnType<typeof ref>>();
  store.set("users", usersRef);
  store.set("current-user", currentUserRef);

  const useNuxtDataMock = vi.fn((key: string) => {
    if (!store.has(key)) {
      store.set(key, ref(null));
    }
    return { data: store.get(key)! };
  });

  const refreshNuxtDataMock = vi.fn(async (key: string) => {
    if (key === "users" && store.has(key)) {
      store.get(key)!.value = usersRef.value;
    }
    return undefined;
  });

  const useAsyncDataMock = vi.fn(async (key: string, fetcher: () => Promise<unknown>) => {
    const data = await fetcher();
    if (key === "current-user") {
      currentUserRef.value = data;
    }
    return { data };
  });

  return {
    mockUseNuxtData: useNuxtDataMock,
    mockRefreshNuxtData: refreshNuxtDataMock,
    mockUseAsyncData: useAsyncDataMock,
    usersDataRef: usersRef,
    currentUserDataRef: currentUserRef,
  };
});

mockNuxtImport("useNuxtData", () => mockUseNuxtData);
mockNuxtImport("refreshNuxtData", () => mockRefreshNuxtData);
mockNuxtImport("useAsyncData", () => mockUseAsyncData);

import { useUsers } from "../../../../app/composables/useUsers";

describe("useUsers", () => {
  const mockUsers: UserWithOrder[] = [
    {
      id: "user-1",
      name: "Test User",
      email: null,
      avatar: null,
      color: null,
      todoOrder: 1,
      createdAt: testDate,
      updatedAt: testDate,
    },
  ];

  const mockCurrentUser: User = {
    id: "user-1",
    name: "Test User",
    email: null,
    avatar: null,
    color: null,
    todoOrder: 1,
    createdAt: testDate,
    updatedAt: testDate,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    usersDataRef.value = [...mockUsers];
    currentUserDataRef.value = mockCurrentUser;
  });

  it("should return users from useNuxtData", () => {
    const { users } = useUsers();
    expect(users.value).toEqual(mockUsers);
  });

  it("should return current user from useNuxtData", () => {
    const { currentUser } = useUsers();
    expect(currentUser.value).toEqual(mockCurrentUser);
  });

  it("should return empty array when users data is null", () => {
    usersDataRef.value = null;
    const { users } = useUsers();
    expect(users.value).toEqual([]);
  });

  it("should have loading state", () => {
    const { loading } = useUsers();
    expect(loading.value).toBe(false);
  });

  it("should have error state", () => {
    const { error } = useUsers();
    expect(error.value).toBeNull();
  });

  describe("fetchUsers", () => {
    it("should fetch users and call refreshNuxtData", async () => {
      const { fetchUsers, loading } = useUsers();

      const result = await fetchUsers();

      expect(mockRefreshNuxtData).toHaveBeenCalledWith("users");
      expect(loading.value).toBe(false);
      expect(result).toEqual(mockUsers);
    });

    it("should set loading to true during fetch", async () => {
      mockRefreshNuxtData.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100)),
      );
      const { fetchUsers, loading } = useUsers();

      const fetchPromise = fetchUsers();
      expect(loading.value).toBe(true);

      await fetchPromise;
      expect(loading.value).toBe(false);
    });

    it("should handle fetch errors", async () => {
      mockRefreshNuxtData.mockRejectedValueOnce(new Error("Fetch failed"));
      const { fetchUsers, error } = useUsers();

      await expect(fetchUsers()).rejects.toThrow("Fetch failed");
      expect(error.value).toBe("Failed to fetch users");
    });
  });

  describe("selectUser", () => {
    it("should call useAsyncData with user", async () => {
      const { selectUser } = useUsers();

      await selectUser(mockCurrentUser);

      expect(mockUseAsyncData).toHaveBeenCalledWith(
        "current-user",
        expect.any(Function),
        { server: false, lazy: false },
      );
      expect(currentUserDataRef.value).toEqual(mockCurrentUser);
    });

    it("should set error on select failure", async () => {
      mockUseAsyncData.mockRejectedValueOnce(new Error("Select failed"));
      const { selectUser, error } = useUsers();

      await expect(selectUser(mockCurrentUser)).rejects.toThrow("Select failed");
      expect(error.value).toBe("Failed to select user");
    });
  });

  describe("loadCurrentUser", () => {
    it("should call useAsyncData with null", async () => {
      const { loadCurrentUser } = useUsers();

      await loadCurrentUser();

      expect(mockUseAsyncData).toHaveBeenCalledWith(
        "current-user",
        expect.any(Function),
        { server: false, lazy: false },
      );
      expect(currentUserDataRef.value).toBeNull();
    });

    it("should set error on load failure", async () => {
      mockUseAsyncData.mockRejectedValueOnce(new Error("Load failed"));
      const { loadCurrentUser, error } = useUsers();

      await expect(loadCurrentUser()).rejects.toThrow("Load failed");
      expect(error.value).toBe("Failed to load current user");
    });
  });

  describe("clearCurrentUser", () => {
    it("should call useAsyncData with null", async () => {
      const { clearCurrentUser } = useUsers();
      currentUserDataRef.value = mockCurrentUser;

      await clearCurrentUser();

      expect(mockUseAsyncData).toHaveBeenCalledWith(
        "current-user",
        expect.any(Function),
        { server: false, lazy: false },
      );
      expect(currentUserDataRef.value).toBeNull();
    });

    it("should set error on clear failure", async () => {
      mockUseAsyncData.mockRejectedValueOnce(new Error("Clear failed"));
      const { clearCurrentUser, error } = useUsers();

      await expect(clearCurrentUser()).rejects.toThrow("Clear failed");
      expect(error.value).toBe("Failed to clear current user");
    });
  });

});
