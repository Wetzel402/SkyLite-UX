import { consola } from "consola";

import type {
  CreateTodoInput,
  TodoWithOrder,
  UpdateTodoInput,
} from "~/types/database";

// Format as YYYY-MM-DD to preserve local date regardless of timezone
function getClientDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}T00:00:00`;
}

export function useTodos() {
  const loading = ref(false);
  const error = ref<string | null>(null);

  const { data: todos } = useNuxtData<TodoWithOrder[]>("todos");

  const currentTodos = computed(() => todos.value || []);

  const fetchTodos = async () => {
    loading.value = true;
    error.value = null;
    try {
      await refreshNuxtData("todos");
      consola.debug("Use Todos: Todos refreshed successfully");
      return currentTodos.value;
    } catch (err) {
      error.value = "Failed to fetch todos";
      consola.error("Use Todos: Error fetching todos:", err);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const createTodo = async (todoData: CreateTodoInput) => {
    try {
      // Include client's local date for timezone-aware recurrence calculations
      const clientDate = getClientDateString();

      const requestBody = {
        ...todoData,
        clientDate,
      };

      const newTodo = await $fetch<TodoWithOrder>("/api/todos", {
        method: "POST",
        body: requestBody,
      });

      await refreshNuxtData("todos");

      return newTodo;
    } catch (err) {
      error.value = "Failed to create todo";
      consola.error("Use Todos: Error creating todo:", err);
      throw err;
    }
  };

  const updateTodo = async (id: string, updates: UpdateTodoInput) => {
    try {
      // Include client's local date for timezone-aware recurrence calculations
      const clientDate = getClientDateString();

      const updatedTodo = await $fetch<TodoWithOrder>(`/api/todos/${id}`, {
        method: "PUT",
        body: {
          ...updates,
          clientDate,
        },
      });

      await refreshNuxtData("todos");

      return updatedTodo;
    } catch (err) {
      error.value = "Failed to update todo";
      consola.error("Use Todos: Error updating todo:", err);
      throw err;
    }
  };

  const toggleTodo = async (id: string, completed: boolean) => {
    return updateTodo(id, { completed });
  };

  const deleteTodo = async (id: string, stopRecurrence = false) => {
    try {
      // Include client's local date for timezone-aware recurrence calculations
      const clientDate = getClientDateString();

      const params = new URLSearchParams();
      if (stopRecurrence) {
        params.append("stopRecurrence", "true");
      }
      params.append("clientDate", clientDate);

      const url = `/api/todos/${id}?${params.toString()}`;

      await $fetch(url, {
        method: "DELETE",
      });

      await refreshNuxtData("todos");
    } catch (err) {
      error.value = "Failed to delete todo";
      consola.error("Use Todos: Error deleting todo:", err);
      throw err;
    }
  };

  const reorderTodo = async (
    todoId: string,
    direction: "up" | "down",
    todoColumnId: string | null,
  ) => {
    try {
      const currentTodo = currentTodos.value.find((t) => t.id === todoId);
      if (!currentTodo) return;

      const sameSectionTodos = currentTodos.value
        .filter(
          (t) =>
            t.todoColumnId === todoColumnId &&
            t.completed === currentTodo.completed,
        )
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      const currentIndex = sameSectionTodos.findIndex((t) => t.id === todoId);
      if (currentIndex === -1) return;

      let targetIndex;
      if (direction === "up" && currentIndex > 0) {
        targetIndex = currentIndex - 1;
      } else if (
        direction === "down" &&
        currentIndex < sameSectionTodos.length - 1
      ) {
        targetIndex = currentIndex + 1;
      } else {
        return;
      }

      const targetTodo = sameSectionTodos[targetIndex];
      if (!targetTodo) return;

      await $fetch("/api/todos/reorder", {
        method: "POST",
        body: { todoId, direction, todoColumnId },
      });

      await refreshNuxtData("todos");
    } catch (err) {
      error.value = "Failed to reorder todo";
      consola.error("Use Todos: Error reordering todo:", err);
      throw err;
    }
  };

  const clearCompleted = async (
    columnId: string,
    completedTodos?: TodoWithOrder[],
  ) => {
    try {
      let todosToDelete: TodoWithOrder[] = [];

      if (completedTodos && completedTodos.length > 0) {
        todosToDelete = completedTodos;
      } else {
        todosToDelete = currentTodos.value.filter(
          (t) => t.todoColumnId === columnId && t.completed,
        );
      }

      if (todosToDelete.length === 0) return;

      await $fetch(`/api/todo-columns/${columnId}/todos/clear-completed`, {
        method: "POST",
        body: { action: "delete" },
      });

      await refreshNuxtData("todos");
    } catch (err) {
      error.value = "Failed to clear completed todos";
      consola.error("Use Todos: Error clearing completed todos:", err);
      throw err;
    }
  };

  return {
    todos: readonly(currentTodos),
    loading: readonly(loading),
    error: readonly(error),
    fetchTodos,
    createTodo,
    updateTodo,
    toggleTodo,
    deleteTodo,
    reorderTodo,
    clearCompleted,
  };
}
