import { consola } from "consola";

import type { TodoColumn } from "~/types/database";

export function useTodoColumns() {
  const loading = ref(false);
  const error = ref<string | null>(null);

  const { data: todoColumns } = useNuxtData<TodoColumn[]>("todo-columns");

  const currentTodoColumns = computed(() => todoColumns.value || []);

  const fetchTodoColumns = async () => {
    loading.value = true;
    try {
      await refreshNuxtData("todo-columns");
      consola.debug("Use Todo Columns: Todo columns refreshed successfully");
    }
    catch (err) {
      error.value
        = err instanceof Error ? err.message : "Failed to fetch todo columns";
      consola.error("Use Todo Columns: Failed to fetch todo columns:", err);
      throw err;
    }
    finally {
      loading.value = false;
    }
  };

  const createTodoColumn = async (columnData: {
    name: string;
    userId?: string;
    isDefault?: boolean;
  }) => {
    loading.value = true;
    try {
      const newColumn = await $fetch("/api/todo-columns", {
        method: "POST",
        body: columnData,
      });

      await refreshNuxtData("todo-columns");

      error.value = null;
      return newColumn;
    }
    catch (err) {
      error.value
        = err instanceof Error ? err.message : "Failed to create todo column";
      consola.error("Use Todo Columns: Failed to create todo column:", err);
      throw err;
    }
    finally {
      loading.value = false;
    }
  };

  const updateTodoColumn = async (
    columnId: string,
    updates: { name?: string },
  ) => {
    try {
      const updatedColumn = await $fetch<TodoColumn>(
        `/api/todo-columns/${columnId}`,
        {
          method: "PUT",
          body: updates,
        },
      );

      await refreshNuxtData("todo-columns");

      error.value = null;
      return updatedColumn;
    }
    catch (err) {
      error.value
        = err instanceof Error ? err.message : "Failed to update todo column";
      consola.error("Use Todo Columns: Failed to update todo column:", err);
      throw err;
    }
  };

  const deleteTodoColumn = async (columnId: string) => {
    try {
      const response = await fetch(`/api/todo-columns/${columnId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete todo column");
      }

      await refreshNuxtData("todo-columns");

      error.value = null;
      return true;
    }
    catch (err) {
      error.value
        = err instanceof Error ? err.message : "Failed to delete todo column";
      consola.error("Use Todo Columns: Failed to delete todo column:", err);
      throw err;
    }
  };

  const reorderTodoColumns = async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex)
      return;

    const columns = [...currentTodoColumns.value];
    const movedColumn = columns.splice(fromIndex, 1)[0];
    if (movedColumn) {
      columns.splice(toIndex, 0, movedColumn);
    }

    const reorders = columns.map((column, index) => ({
      id: column.id,
      order: index,
    }));

    try {
      await $fetch("/api/todo-columns/reorder", {
        method: "PUT",
        body: { reorders },
      });

      await refreshNuxtData("todo-columns");

      error.value = null;
    }
    catch (err) {
      error.value
        = err instanceof Error ? err.message : "Failed to reorder todo columns";
      consola.error("Use Todo Columns: Failed to reorder todo columns:", err);
      throw err;
    }
  };

  return {
    todoColumns: readonly(currentTodoColumns),
    loading: readonly(loading),
    error: readonly(error),
    fetchTodoColumns,
    createTodoColumn,
    updateTodoColumn,
    deleteTodoColumn,
    reorderTodoColumns,
  };
}
