import { consola } from "consola";

import type { CreateUserInput, User, UserWithOrder } from "~/types/database";

export function useUsers() {
  const loading = ref(false);
  const error = ref<string | null>(null);

  const { data: users } = useNuxtData<UserWithOrder[]>("users");

  const { data: currentUser } = useNuxtData<User | null>("current-user");

  const currentUsers = computed(() => users.value || []);

  const fetchUsers = async () => {
    loading.value = true;
    error.value = null;
    try {
      await refreshNuxtData("users");
      return currentUsers.value;
    } catch (err) {
      error.value = "Failed to fetch users";
      consola.error("Use Users: Error fetching users:", err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const createUser = async (userData: CreateUserInput) => {
    try {
      const newUser = await $fetch<UserWithOrder>("/api/users", {
        method: "POST",
        body: userData,
      });

      await refreshNuxtData("users");

      await refreshNuxtData("todo-columns");

      return newUser;
    } catch (err) {
      error.value = "Failed to create user";
      consola.error("Use Users: Error creating user:", err);
      throw err;
    }
  };

  const updateUser = async (id: string, updates: Partial<User>) => {
    try {
      const updatedUser = await $fetch<User>(`/api/users/${id}`, {
        method: "PUT",
        body: updates,
      });

      await refreshNuxtData("users");
      await refreshNuxtData("todo-columns");

      return updatedUser;
    } catch (err) {
      error.value = "Failed to update user";
      consola.error("Use Users: Error updating user:", err);
      throw err;
    }
  };

  const selectUser = async (user: User) => {
    try {
      await useAsyncData("current-user", () => Promise.resolve(user), {
        server: false,
        lazy: false,
      });
    } catch (err) {
      error.value = "Failed to select user";
      consola.error("Use Users: Error selecting user:", err);
      throw err;
    }
  };

  const loadCurrentUser = async () => {
    try {
      await useAsyncData("current-user", () => Promise.resolve(null), {
        server: false,
        lazy: false,
      });
    } catch (err) {
      error.value = "Failed to load current user";
      consola.error("Use Users: Error loading current user:", err);
      throw err;
    }
  };

  const clearCurrentUser = async () => {
    try {
      await useAsyncData("current-user", () => Promise.resolve(null), {
        server: false,
        lazy: false,
      });
    } catch (err) {
      error.value = "Failed to clear current user";
      consola.error("Use Users: Error clearing current user:", err);
      throw err;
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      await $fetch(`/api/users/${userId}`, {
        method: "DELETE" as const,
      });

      if (currentUser.value?.id === userId) {
        await clearCurrentUser();
      }

      await refreshNuxtData("users");
      await refreshNuxtData("todo-columns");

      return true;
    } catch (err) {
      error.value = "Failed to delete user";
      consola.error("Use Users: Error deleting user:", err);
      throw err;
    }
  };

  const reorderUser = async (userId: string, direction: "up" | "down") => {
    try {
      const sortedUsers = [...currentUsers.value].sort(
        (a, b) => (a.todoOrder || 0) - (b.todoOrder || 0),
      );
      const currentIndex = sortedUsers.findIndex((user) => user.id === userId);

      if (currentIndex === -1) return;

      let targetIndex;
      if (direction === "up" && currentIndex > 0) {
        targetIndex = currentIndex - 1;
      } else if (
        direction === "down" &&
        currentIndex < sortedUsers.length - 1
      ) {
        targetIndex = currentIndex + 1;
      } else {
        return;
      }

      const currentUser = sortedUsers[currentIndex];
      const targetUser = sortedUsers[targetIndex];

      if (!currentUser || !targetUser) return;

      const currentOrder = currentUser.todoOrder || 0;
      const targetOrder = targetUser.todoOrder || 0;

      const updatedUsers = currentUsers.value.map((user) => {
        if (user.id === currentUser.id) {
          return { ...user, todoOrder: targetOrder };
        }
        if (user.id === targetUser.id) {
          return { ...user, todoOrder: currentOrder };
        }
        return user;
      });

      const newOrder = updatedUsers
        .sort((a, b) => (a.todoOrder || 0) - (b.todoOrder || 0))
        .map((user) => user.id);

      await $fetch("/api/users/reorder", {
        method: "POST",
        body: { userIds: newOrder },
      });

      await refreshNuxtData("users");
      await refreshNuxtData("todo-columns");
    } catch (err) {
      error.value = "Failed to reorder user";
      consola.error("Use Users: Error reordering user:", err);
      throw err;
    }
  };

  return {
    users: readonly(currentUsers),
    currentUser: readonly(currentUser),
    loading: readonly(loading),
    error: readonly(error),
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
    selectUser,
    loadCurrentUser,
    clearCurrentUser,
    reorderUser,
  };
}
