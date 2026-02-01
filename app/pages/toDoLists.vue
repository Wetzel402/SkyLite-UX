<script setup lang="ts">
import { consola } from "consola";

import type { BaseListItem, Todo, TodoColumn, TodoList, TodoListItem } from "~/types/database";
import type { TodoListWithIntegration } from "~/types/ui";

import GlobalFloatingActionButton from "~/components/global/globalFloatingActionButton.vue";
import GlobalList from "~/components/global/globalList.vue";
import TodoColumnDialog from "~/components/todos/todoColumnDialog.vue";
import TodoItemDialog from "~/components/todos/todoItemDialog.vue";
import { useStableDate } from "~/composables/useStableDate";
import { useTodoColumns } from "~/composables/useTodoColumns";
import { useTodos } from "~/composables/useTodos";

const { parseStableDate } = useStableDate();

const { data: todoColumns } = useNuxtData<TodoColumn[]>("todo-columns");
const { data: todos } = useNuxtData<Todo[]>("todos");
const { updateTodo, createTodo, deleteTodo, toggleTodo, reorderTodo, clearCompleted, loading: todosLoading, fetchTodos } = useTodos();
const { updateTodoColumn, createTodoColumn, deleteTodoColumn, reorderTodoColumns, loading: columnsLoading } = useTodoColumns();

// Debug logging for data state
watch(() => todoColumns.value, (newVal) => {
  consola.info(`[toDoLists] todo-columns data changed: ${newVal?.length || 0} columns`, newVal);
}, { immediate: true });

watch(() => todos.value, (newVal) => {
  consola.info(`[toDoLists] todos data changed: ${newVal?.length || 0} todos`, newVal);
}, { immediate: true });

// Track if data has been fetched to avoid refetching empty arrays
const todosFetched = ref(false);
const todoColumnsFetched = ref(false);

// In Capacitor, fetch data if missing (appInit may have skipped if no server URL)
onMounted(async () => {
  const isCapacitor = typeof window !== "undefined" && "Capacitor" in window;
  if (isCapacitor) {
    consola.info("[toDoLists] Capacitor detected - checking if data needs fetching");

    // Check if todos or todo-columns are missing/invalid (don't treat empty arrays as missing if already fetched)
    const needsTodosFetch = !todosFetched.value && (!todos.value || !Array.isArray(todos.value));
    const needsColumnsFetch = !todoColumnsFetched.value && (!todoColumns.value || !Array.isArray(todoColumns.value));

    if (needsTodosFetch || needsColumnsFetch) {
      consola.info("[toDoLists] Data missing in Capacitor - fetching now", {
        needsTodosFetch,
        needsColumnsFetch,
      });

      try {
        // Fetch directly from API using $fetch
        const promises = [];

        if (needsTodosFetch) {
          consola.info("[toDoLists] Fetching todos from API");
          promises.push(
            $fetch<Todo[]>("/api/todos").then((data) => {
              consola.info("[toDoLists] Todos fetched:", data?.length || 0);
              todos.value = data;
              todosFetched.value = true;
            }),
          );
        }

        if (needsColumnsFetch) {
          consola.info("[toDoLists] Fetching todo-columns from API");
          promises.push(
            $fetch<TodoColumn[]>("/api/todo-columns").then((data) => {
              consola.info("[toDoLists] Todo-columns fetched:", data?.length || 0);
              todoColumns.value = data;
              todoColumnsFetched.value = true;
            }),
          );
        }

        await Promise.all(promises);
        consola.info("[toDoLists] Data fetched successfully - todos:", todos.value?.length, "columns:", todoColumns.value?.length);
      }
      catch (err) {
        consola.error("[toDoLists] Failed to fetch data:", err);
      }
    }
    else {
      consola.info("[toDoLists] Data already available, no fetch needed");
      todosFetched.value = true;
      todoColumnsFetched.value = true;
    }
  }
  else {
    // Non-Capacitor environment - fetch if data missing
    if (!todosFetched.value && (!todos.value || !Array.isArray(todos.value))) {
      await fetchTodos();
      todosFetched.value = true;
    }
  }

  // Fetch Google Tasks and Calendar Reminders
  await Promise.all([
    fetchGoogleTasks(),
    fetchCalendarReminders(),
  ]);
});

// Google Tasks and Calendar Reminders
const googleTasks = ref<any[]>([]);
const calendarReminders = ref<any[]>([]);

// Fetch Google Tasks
async function fetchGoogleTasks() {
  try {
    const response = await $fetch<{ tasks: any[] }>("/api/integrations/google_tasks/all-tasks");
    googleTasks.value = response.tasks || [];
  }
  catch {
    googleTasks.value = [];
  }
}

// Fetch Calendar Reminders
async function fetchCalendarReminders() {
  try {
    const response = await $fetch<{ reminders: any[] }>("/api/integrations/google_calendar/reminders");
    calendarReminders.value = response.reminders || [];
  }
  catch {
    calendarReminders.value = [];
  }
}

const mutableTodoColumns = computed(() => todoColumns.value?.map(col => ({
  ...col,
  user: col.user === null
    ? undefined
    : {
        id: col.user.id,
        name: col.user.name,
        avatar: col.user.avatar,
      },
})) || []);

const todoItemDialog = ref(false);
const todoColumnDialog = ref(false);
const editingTodo = ref<TodoListItem | null>(null);
const editingColumn = ref<TodoList | null>(null);
const reorderingTodos = ref(new Set<string>());
const reorderingColumns = ref(new Set<string>());

const editingTodoTyped = computed<TodoListItem | undefined>(() =>
  editingTodo.value as TodoListItem | undefined,
);

const todoLists = computed<TodoListWithIntegration[]>(() => {
  consola.debug("[toDoLists] Computing todoLists. todoColumns:", todoColumns.value?.length || 0, "todos:", todos.value?.length || 0);

  if (!todoColumns.value || !todos.value) {
    consola.warn("[toDoLists] Missing data - todoColumns:", !!todoColumns.value, "todos:", !!todos.value);
    return [];
  }

  const localColumns = todoColumns.value.map(column => ({
    id: column.id,
    name: column.name,
    order: column.order,
    createdAt: parseStableDate(column.createdAt),
    updatedAt: parseStableDate(column.updatedAt),
    isDefault: column.isDefault,
    source: "native" as const,
    items: todos.value!
      .filter(todo => todo.todoColumnId === column.id)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map(todo => ({
        id: todo.id,
        name: todo.title,
        checked: todo.completed,
        order: todo.order,
        notes: todo.description,
        shoppingListId: todo.todoColumnId || "",
        priority: todo.priority,
        dueDate: todo.dueDate,
        description: todo.description ?? "",
        todoColumnId: todo.todoColumnId || "",
        source: "local",
      })),
    _count: column._count ? { items: column._count.todos } : undefined,
  }));

  const allColumns: TodoListWithIntegration[] = [...localColumns];

  // Add Google Tasks column if there are any Google Tasks
  if (googleTasks.value.length > 0) {
    const filteredTasks = googleTasks.value.filter(task => task.title && task.title.trim());
    if (filteredTasks.length > 0) {
      allColumns.push({
        id: "google-tasks-virtual",
        name: "Google Tasks",
        order: 9999,
        createdAt: parseStableDate(new Date(0)), // Use epoch for stable date
        updatedAt: parseStableDate(new Date(0)),
        isDefault: false,
        source: "integration" as const,
        items: filteredTasks.map((task, index) => ({
          id: `google-${task.id}`,
          name: task.title,
          checked: task.status === "completed",
          order: index,
          notes: task.notes ?? null,
          shoppingListId: "google-tasks-virtual",
          priority: "MEDIUM" as const,
          dueDate: task.due ? new Date(task.due) : null,
          description: task.notes ?? "",
          todoColumnId: "google-tasks-virtual",
          source: "google_tasks",
        })),
        _count: { items: filteredTasks.length },
      });
    }
  }

  // Add Calendar Reminders column if there are any reminders
  if (calendarReminders.value.length > 0) {
    const filteredReminders = calendarReminders.value.filter(reminder => reminder.title && reminder.title.trim());
    if (filteredReminders.length > 0) {
      allColumns.push({
        id: "calendar-reminders-virtual",
        name: "Calendar Reminders",
        order: 10000,
        createdAt: parseStableDate(new Date(0)), // Use epoch for stable date
        updatedAt: parseStableDate(new Date(0)),
        isDefault: false,
        source: "integration" as const,
        items: filteredReminders.map((reminder, index) => ({
          id: `calendar-${reminder.id}`,
          name: reminder.title,
          checked: false,
          order: index,
          notes: reminder.description ?? null,
          shoppingListId: "calendar-reminders-virtual",
          priority: "MEDIUM" as const,
          dueDate: reminder.dueDate ? new Date(reminder.dueDate) : null,
          description: reminder.description ?? "",
          todoColumnId: "calendar-reminders-virtual",
          source: "calendar_reminder",
        })),
        _count: { items: filteredReminders.length },
      });
    }
  }

  consola.info("[toDoLists] Computed todoLists result:", allColumns.length, "lists with", allColumns.reduce((sum, col) => sum + (col.items?.length || 0), 0), "total items");
  return allColumns;
});

function openCreateTodo(todoColumnId?: string) {
  editingTodo.value = { todoColumnId: todoColumnId ?? "" } as TodoListItem;
  todoItemDialog.value = true;
}

function openEditTodo(item: BaseListItem) {
  if (!todos.value)
    return;
  const todo = todos.value.find(t => t.id === item.id);
  if (!todo)
    return;

  editingTodo.value = {
    id: todo.id,
    name: todo.title,
    description: todo.description ?? "",
    priority: todo.priority,
    dueDate: todo.dueDate ? parseStableDate(todo.dueDate) : null,
    todoColumnId: todo.todoColumnId ?? "",
    checked: todo.completed,
    order: todo.order,
    shoppingListId: todo.todoColumnId || "",
    notes: todo.description,
  };
  todoItemDialog.value = true;
}

async function handleTodoSave(todoData: TodoListItem) {
  try {
    if (editingTodo.value?.id) {
      const { data: cachedTodos } = useNuxtData("todos");
      const previousTodos = cachedTodos.value ? [...cachedTodos.value] : [];

      if (cachedTodos.value && Array.isArray(cachedTodos.value)) {
        const todoIndex = cachedTodos.value.findIndex((t: Todo) => t.id === editingTodo.value!.id);
        if (todoIndex !== -1) {
          const currentTodo = cachedTodos.value[todoIndex];
          const updatedTodo = {
            ...currentTodo,
            title: todoData.name,
            description: todoData.description,
            priority: todoData.priority,
            dueDate: todoData.dueDate,
            completed: todoData.checked,
            order: todoData.order,
            todoColumnId: todoData.todoColumnId,
            isCountdown: todoData.isCountdown || false,
          };
          const updatedTodos = [...cachedTodos.value];
          updatedTodos[todoIndex] = updatedTodo;
          cachedTodos.value = updatedTodos;
        }
      }

      try {
        await updateTodo(editingTodo.value.id, {
          title: todoData.name,
          description: todoData.description,
          priority: todoData.priority,
          dueDate: todoData.dueDate,
          completed: todoData.checked,
          order: todoData.order,
          todoColumnId: todoData.todoColumnId,
          isCountdown: todoData.isCountdown || false,
        });
        consola.debug("Todo Lists: Todo updated successfully");
      }
      catch (error) {
        if (cachedTodos.value && previousTodos.length > 0) {
          cachedTodos.value.splice(0, cachedTodos.value.length, ...previousTodos);
        }
        throw error;
      }
    }
    else {
      const { data: cachedTodos } = useNuxtData("todos");
      const previousTodos = cachedTodos.value ? [...cachedTodos.value] : [];
      const newTodo: Todo = {
        id: `temp-${Date.now()}`,
        title: todoData.name,
        description: todoData.description,
        priority: todoData.priority,
        dueDate: todoData.dueDate,
        completed: todoData.checked,
        order: todoData.order,
        todoColumnId: todoData.todoColumnId,
        createdAt: new Date(),
        updatedAt: new Date(),
        isCountdown: todoData.isCountdown || false,
        countdownMessage: null,
        messageGeneratedAt: null,
      };

      if (cachedTodos.value && Array.isArray(cachedTodos.value)) {
        const updatedTodos = [...cachedTodos.value, newTodo];
        cachedTodos.value = updatedTodos;
      }

      try {
        const createdTodo = await createTodo({
          title: todoData.name,
          description: todoData.description,
          priority: todoData.priority,
          dueDate: todoData.dueDate,
          completed: todoData.checked,
          order: todoData.order,
          todoColumnId: todoData.todoColumnId,
          isCountdown: todoData.isCountdown || false,
          countdownMessage: null,
          messageGeneratedAt: null,
        });
        consola.debug("Todo Lists: Todo created successfully");

        if (cachedTodos.value && Array.isArray(cachedTodos.value)) {
          const tempIndex = cachedTodos.value.findIndex((t: Todo) => t.id === newTodo.id);
          if (tempIndex !== -1) {
            const updatedTodos = [...cachedTodos.value];
            updatedTodos[tempIndex] = createdTodo;
            cachedTodos.value = updatedTodos;
          }
        }
      }
      catch (error) {
        if (cachedTodos.value && previousTodos.length > 0) {
          cachedTodos.value.splice(0, cachedTodos.value.length, ...previousTodos);
        }
        throw error;
      }
    }

    todoItemDialog.value = false;
    editingTodo.value = null;
  }
  catch (error) {
    consola.error("Todo Lists: Failed to save todo:", error);
  }
}

async function handleTodoDelete(todoId: string) {
  try {
    const { data: cachedTodos } = useNuxtData("todos");
    const previousTodos = cachedTodos.value ? [...cachedTodos.value] : [];

    if (cachedTodos.value && Array.isArray(cachedTodos.value)) {
      const updatedTodos = cachedTodos.value.filter((t: Todo) => t.id !== todoId);
      cachedTodos.value = updatedTodos;
    }

    try {
      await deleteTodo(todoId);
      consola.debug("Todo Lists: Todo deleted successfully");
    }
    catch (error) {
      if (cachedTodos.value && previousTodos.length > 0) {
        cachedTodos.value.splice(0, cachedTodos.value.length, ...previousTodos);
      }
      throw error;
    }
  }
  catch (error) {
    consola.error("Todo Lists: Failed to delete todo:", error);
  }
}

async function handleColumnSave(columnData: { name: string }) {
  try {
    if (editingColumn.value?.id) {
      const { data: cachedColumns } = useNuxtData("todo-columns");
      const previousColumns = cachedColumns.value ? [...cachedColumns.value] : [];

      if (cachedColumns.value && Array.isArray(cachedColumns.value)) {
        const columnIndex = cachedColumns.value.findIndex((c: TodoColumn) => c.id === editingColumn.value!.id);
        if (columnIndex !== -1) {
          cachedColumns.value[columnIndex] = { ...cachedColumns.value[columnIndex], ...columnData };
        }
      }

      try {
        await updateTodoColumn(editingColumn.value.id, columnData);
        consola.debug("Todo Lists: Todo column updated successfully");
      }
      catch (error) {
        if (cachedColumns.value && previousColumns.length > 0) {
          cachedColumns.value.splice(0, cachedColumns.value.length, ...previousColumns);
        }
        throw error;
      }
    }
    else {
      const { data: cachedColumns } = useNuxtData("todo-columns");
      const previousColumns = cachedColumns.value ? [...cachedColumns.value] : [];
      const newColumn = {
        ...columnData,
        id: `temp-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        isDefault: false,
        order: (cachedColumns.value?.length || 0) + 1,
        user: null,
        _count: { todos: 0 },
      };

      if (cachedColumns.value && Array.isArray(cachedColumns.value)) {
        cachedColumns.value.push(newColumn);
      }

      try {
        const createdColumn = await createTodoColumn(columnData);
        consola.debug("Todo Lists: Todo column created successfully");

        if (cachedColumns.value && Array.isArray(cachedColumns.value)) {
          const tempIndex = cachedColumns.value.findIndex((c: TodoColumn) => c.id === newColumn.id);
          if (tempIndex !== -1) {
            cachedColumns.value[tempIndex] = createdColumn;
          }
        }
      }
      catch (error) {
        if (cachedColumns.value && previousColumns.length > 0) {
          cachedColumns.value.splice(0, cachedColumns.value.length, ...previousColumns);
        }
        throw error;
      }
    }

    todoColumnDialog.value = false;
    editingColumn.value = null;
  }
  catch (error) {
    consola.error("Todo Lists: Failed to save todo column:", error);
  }
}

async function handleColumnDelete(columnId: string) {
  try {
    const { data: cachedColumns } = useNuxtData("todo-columns");
    const previousColumns = cachedColumns.value ? [...cachedColumns.value] : [];

    if (cachedColumns.value && Array.isArray(cachedColumns.value)) {
      cachedColumns.value.splice(0, cachedColumns.value.length, ...cachedColumns.value.filter((c: TodoColumn) => c.id !== columnId));
    }

    try {
      await deleteTodoColumn(columnId);
      consola.debug("Todo Lists: Todo column deleted successfully");
    }
    catch (error) {
      if (cachedColumns.value && previousColumns.length > 0) {
        cachedColumns.value.splice(0, cachedColumns.value.length, ...previousColumns);
      }
      throw error;
    }
  }
  catch (error) {
    consola.error("Todo Lists: Failed to delete todo column:", error);
  }
}

async function handleReorderColumn(columnIndex: number, direction: "left" | "right") {
  if (!todoColumns.value)
    return;

  const column = todoColumns.value[columnIndex];
  if (!column)
    return;

  if (reorderingColumns.value.has(column.id))
    return;

  const targetIndex = direction === "left" ? columnIndex - 1 : columnIndex + 1;

  if (targetIndex < 0 || targetIndex >= todoColumns.value.length)
    return;

  reorderingColumns.value.add(column.id);

  try {
    const { data: cachedColumns } = useNuxtData("todo-columns");
    const previousColumns = cachedColumns.value ? [...cachedColumns.value] : [];

    try {
      await reorderTodoColumns(columnIndex, targetIndex);
      consola.debug("Todo Lists: Column reordered successfully");

      if (cachedColumns.value && Array.isArray(cachedColumns.value)) {
        const columns = [...cachedColumns.value].sort((a, b) => (a.order || 0) - (b.order || 0));
        const currentIndex = columns.findIndex((c: TodoColumn) => c.id === column.id);

        if (currentIndex !== -1) {
          if (direction === "left" && currentIndex > 0) {
            [columns[currentIndex], columns[currentIndex - 1]] = [columns[currentIndex - 1], columns[currentIndex]];
            columns[currentIndex].order = currentIndex;
            columns[currentIndex - 1].order = currentIndex - 1;
          }
          else if (direction === "right" && currentIndex < columns.length - 1) {
            [columns[currentIndex], columns[currentIndex + 1]] = [columns[currentIndex + 1], columns[currentIndex]];
            columns[currentIndex].order = currentIndex;
            columns[currentIndex + 1].order = currentIndex + 1;
          }

          cachedColumns.value.splice(0, cachedColumns.value.length, ...columns);
        }
      }
    }
    catch (error) {
      if (cachedColumns.value && previousColumns.length > 0) {
        cachedColumns.value.splice(0, cachedColumns.value.length, ...previousColumns);
      }
      throw error;
    }
  }
  catch (error) {
    consola.error("Todo Lists: Failed to reorder column:", error);
    useAlertToast().showError("Failed to reorder column. Please try again.");
  }
  finally {
    reorderingColumns.value.delete(column.id);
  }
}

async function handleReorderTodo(itemId: string, direction: "up" | "down") {
  if (reorderingTodos.value.has(itemId))
    return;
  reorderingTodos.value.add(itemId);

  try {
    if (!todos.value)
      throw new Error("Todos not loaded");
    const item = todos.value.find(t => t.id === itemId);
    if (!item)
      throw new Error("Todo not found");

    const { data: cachedTodos } = useNuxtData("todos");
    const previousTodos = cachedTodos.value ? [...cachedTodos.value] : [];

    try {
      await reorderTodo(itemId, direction, item.todoColumnId ?? null);
      consola.debug("Todo Lists: Todo reordered successfully");

      if (cachedTodos.value && Array.isArray(cachedTodos.value)) {
        const sameColumnTodos = cachedTodos.value
          .filter((t: Todo) => t.todoColumnId === item.todoColumnId && t.completed === item.completed)
          .sort((a, b) => (a.order || 0) - (b.order || 0));

        const currentIndex = sameColumnTodos.findIndex((t: Todo) => t.id === itemId);

        if (currentIndex !== -1) {
          if (direction === "up" && currentIndex > 0) {
            const todoAbove = sameColumnTodos[currentIndex - 1];
            const currentTodo = sameColumnTodos[currentIndex];

            const currentTodoIndex = cachedTodos.value.findIndex((t: Todo) => t.id === currentTodo.id);
            const todoAboveIndex = cachedTodos.value.findIndex((t: Todo) => t.id === todoAbove.id);

            if (currentTodoIndex !== -1 && todoAboveIndex !== -1) {
              const tempOrder = cachedTodos.value[currentTodoIndex].order;
              cachedTodos.value[currentTodoIndex].order = cachedTodos.value[todoAboveIndex].order;
              cachedTodos.value[todoAboveIndex].order = tempOrder;
            }
          }
          else if (direction === "down" && currentIndex < sameColumnTodos.length - 1) {
            const todoBelow = sameColumnTodos[currentIndex + 1];
            const currentTodo = sameColumnTodos[currentIndex];

            const currentTodoIndex = cachedTodos.value.findIndex((t: Todo) => t.id === currentTodo.id);
            const todoBelowIndex = cachedTodos.value.findIndex((t: Todo) => t.id === todoBelow.id);

            if (currentTodoIndex !== -1 && todoBelowIndex !== -1) {
              const tempOrder = cachedTodos.value[currentTodoIndex].order;
              cachedTodos.value[currentTodoIndex].order = cachedTodos.value[todoBelowIndex].order;
              cachedTodos.value[todoBelowIndex].order = tempOrder;
            }
          }
        }
      }
    }
    catch (error) {
      if (cachedTodos.value && previousTodos.length > 0) {
        cachedTodos.value.splice(0, cachedTodos.value.length, ...previousTodos);
      }
      throw error;
    }
  }
  catch (error) {
    consola.error("Todo Lists: Failed to reorder todo:", error);
    useAlertToast().showError("Failed to reorder todo. Please try again.");
  }
  finally {
    reorderingTodos.value.delete(itemId);
  }
}

async function handleClearCompleted(columnId: string) {
  try {
    const { data: cachedTodos } = useNuxtData("todos");
    const previousTodos = cachedTodos.value ? [...cachedTodos.value] : [];
    const completedTodos = cachedTodos.value?.filter((t: Todo) => t.todoColumnId === columnId && t.completed) || [];

    if (cachedTodos.value && Array.isArray(cachedTodos.value)) {
      const updatedTodos = cachedTodos.value.filter((t: Todo) => !(t.todoColumnId === columnId && t.completed));
      cachedTodos.value = updatedTodos;
    }

    try {
      await clearCompleted(columnId, completedTodos);
      consola.debug("Todo Lists: Completed todos cleared successfully");
    }
    catch (error) {
      if (cachedTodos.value && previousTodos.length > 0) {
        cachedTodos.value.splice(0, cachedTodos.value.length, ...previousTodos);
      }
      throw error;
    }
  }
  catch (error) {
    consola.error("Todo Lists: Failed to clear completed todos:", error);
  }
}

function openEditColumn(column: TodoListWithIntegration) {
  editingColumn.value = { ...column };
  todoColumnDialog.value = true;
}

async function handleToggleTodo(itemId: string, completed: boolean) {
  try {
    const { data: cachedTodos } = useNuxtData("todos");
    const previousTodos = cachedTodos.value ? [...cachedTodos.value] : [];

    if (cachedTodos.value && Array.isArray(cachedTodos.value)) {
      const todoIndex = cachedTodos.value.findIndex((t: Todo) => t.id === itemId);
      if (todoIndex !== -1) {
        const currentTodo = cachedTodos.value[todoIndex];
        const updatedTodo = { ...currentTodo, completed };
        const updatedTodos = [...cachedTodos.value];
        updatedTodos[todoIndex] = updatedTodo;
        cachedTodos.value = updatedTodos;
      }
    }

    try {
      await toggleTodo(itemId, completed);
      consola.debug("Todo Lists: Todo toggled successfully");
    }
    catch (error) {
      if (cachedTodos.value && previousTodos.length > 0) {
        cachedTodos.value.splice(0, cachedTodos.value.length, ...previousTodos);
      }
      throw error;
    }
  }
  catch (error) {
    consola.error("Todo Lists: Failed to toggle todo:", error);
  }
}
</script>

<template>
  <div class="flex h-screen w-full flex-col overflow-x-hidden overflow-y-hidden">
    <div class="py-5 sm:px-4 flex-shrink-0 bg-default border-b border-default">
      <GlobalDateHeader />
    </div>

    <div class="flex-1 min-h-0 md:p-4 overflow-x-hidden">
      <GlobalList
        :lists="todoLists"
        :loading="columnsLoading || todosLoading"
        empty-state-icon="i-lucide-list-todo"
        empty-state-title="No todo lists found"
        empty-state-description="Create your first todo column to get started"
        show-reorder
        :show-edit="(list) => 'isDefault' in list ? !list.isDefault : true"
        show-add
        show-edit-item
        show-completed
        show-progress
        show-integration-icons
        @create="todoColumnDialog = true; editingColumn = null"
        @edit="openEditColumn($event as TodoListWithIntegration)"
        @add-item="openCreateTodo($event)"
        @edit-item="openEditTodo($event)"
        @toggle-item="handleToggleTodo"
        @reorder-item="handleReorderTodo"
        @reorder-list="(listId, direction) => handleReorderColumn(todoLists.findIndex(l => l.id === listId), direction === 'up' ? 'left' : 'right')"
        @clear-completed="handleClearCompleted"
      />
    </div>

    <GlobalFloatingActionButton
      icon="i-lucide-plus"
      label="Add new todo column"
      color="primary"
      size="lg"
      position="bottom-right"
      @click="todoColumnDialog = true; editingColumn = null"
    />

    <TodoItemDialog
      :is-open="todoItemDialog"
      :todo-columns="mutableTodoColumns"
      :todo="editingTodoTyped || null"
      @close="todoItemDialog = false; editingTodo = null"
      @save="handleTodoSave"
      @delete="handleTodoDelete"
    />

    <TodoColumnDialog
      :is-open="todoColumnDialog"
      :column="editingColumn ?? undefined"
      @close="todoColumnDialog = false; editingColumn = null"
      @save="handleColumnSave"
      @delete="handleColumnDelete"
    />
  </div>
</template>
