<script setup lang="ts">
import type { CalendarDate, DateValue } from "@internationalized/date";

import { getLocalTimeZone, parseDate } from "@internationalized/date";

import type { Priority, TodoColumnBasic, TodoListItem } from "~/types/database";

import { useStableDate } from "~/composables/useStableDate";

const props = defineProps<{
  todo: TodoListItem | null;
  isOpen: boolean;
  todoColumns: TodoColumnBasic[];
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", todo: TodoListItem): void;
  (e: "delete", todoId: string): void;
}>();

const { parseStableDate } = useStableDate();

const todoTitle = ref("");
const todoDescription = ref("");
const todoPriority = ref<Priority>("MEDIUM");
const todoDueDate = ref<DateValue | null>(null);
const todoColumnId = ref<string | undefined>(undefined);
const todoIsCountdown = ref(false);
const todoError = ref<string | null>(null);

const priorityOptions = [
  { label: "Low", value: "LOW" },
  { label: "Medium", value: "MEDIUM" },
  { label: "High", value: "HIGH" },
  { label: "Urgent", value: "URGENT" },
];

watch(() => [props.isOpen, props.todo], ([isOpen, todo]) => {
  if (isOpen) {
    resetForm();
    if (todo && typeof todo === "object") {
      if ("name" in todo) {
        todoTitle.value = todo.name || "";
        todoDescription.value = todo.description || "";
        todoPriority.value = todo.priority || "MEDIUM";
        if (todo.dueDate) {
          const date = todo.dueDate instanceof Date ? todo.dueDate : parseStableDate(todo.dueDate);
          todoDueDate.value = parseDate(date.toISOString().split("T")[0]!);
        }
      }
      if ("todoColumnId" in todo) {
        todoColumnId.value = todo.todoColumnId || undefined;
      }
      if ("isCountdown" in todo) {
        todoIsCountdown.value = todo.isCountdown || false;
      }
    }
  }
}, { immediate: true });

function resetForm() {
  todoTitle.value = "";
  todoDescription.value = "";
  todoPriority.value = "MEDIUM";
  todoDueDate.value = null;
  todoColumnId.value = undefined;
  todoIsCountdown.value = false;
  todoError.value = null;
}

function handleSave() {
  if (!todoTitle.value.trim()) {
    todoError.value = "Title is required";
    return;
  }

  if (!todoColumnId.value && props.todoColumns.length > 0) {
    todoError.value = "Please select a column";
    return;
  }

  const todoData = {
    id: props.todo?.id,
    name: todoTitle.value.trim(),
    description: todoDescription.value.trim() || null,
    priority: todoPriority.value,
    dueDate: todoDueDate.value
      ? (() => {
          const date = todoDueDate.value!.toDate(getLocalTimeZone());
          date.setHours(23, 59, 59, 999);
          return date;
        })()
      : null,
    todoColumnId: todoColumnId.value || (props.todoColumns.length > 0 ? props.todoColumns[0]?.id ?? undefined : undefined),
    checked: props.todo?.checked || false,
    order: props.todo?.order || 0,
    isCountdown: todoIsCountdown.value,
  };

  emit("save", todoData as unknown as TodoListItem);
  resetForm();
  emit("close");
}

function handleDelete() {
  if (props.todo?.id) {
    emit("delete", props.todo.id);
    emit("close");
  }
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
    @click="emit('close')"
  >
    <div
      class="w-full mx-4 sm:w-[425px] sm:mx-0 max-h-[90vh] overflow-y-auto bg-default rounded-lg border border-default shadow-lg"
      @click.stop
    >
      <div class="flex items-center justify-between p-4 border-b border-default">
        <h3 class="text-base font-semibold leading-6">
          {{ todo?.id ? 'Edit Todo' : 'Add Todo' }}
        </h3>
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-x"
          class="-my-1"
          @click="emit('close')"
        />
      </div>

      <div class="p-4 space-y-6">
        <div v-if="todoError" class="bg-error/10 text-error rounded-md px-3 py-2 text-sm">
          {{ todoError }}
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Title</label>
          <UInput
            v-model="todoTitle"
            placeholder="Todo title"
            class="w-full"
            :ui="{ base: 'w-full' }"
          />
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Description</label>
          <UTextarea
            v-model="todoDescription"
            placeholder="Todo description (optional)"
            :rows="3"
            class="w-full"
            :ui="{ base: 'w-full' }"
          />
        </div>

        <div class="flex flex-col sm:flex-row gap-4">
          <div class="w-full sm:w-1/2 space-y-2">
            <label class="block text-sm font-medium text-highlighted">Priority</label>
            <USelect
              v-model="todoPriority"
              :items="priorityOptions"
              option-attribute="label"
              value-attribute="value"
              class="w-full"
              :ui="{ base: 'w-full' }"
            />
          </div>

          <div class="w-full sm:w-1/2 space-y-2">
            <label class="block text-sm font-medium text-highlighted">Due Date</label>
            <UPopover>
              <UButton
                color="neutral"
                variant="subtle"
                icon="i-lucide-calendar"
                class="w-full justify-between"
              >
                <NuxtTime
                  v-if="todoDueDate"
                  :datetime="todoDueDate.toDate(getLocalTimeZone())"
                  year="numeric"
                  month="short"
                  day="numeric"
                />
                <span v-else>No due date</span>
              </UButton>

              <template #content>
                <div class="p-2 space-y-2">
                  <UButton
                    v-if="todoDueDate"
                    color="neutral"
                    variant="ghost"
                    class="w-full justify-start"
                    @click="todoDueDate = null"
                  >
                    <template #leading>
                      <UIcon name="i-lucide-x" />
                    </template>
                    Clear due date
                  </UButton>
                  <UCalendar
                    :model-value="todoDueDate as unknown as DateValue"
                    class="p-2"
                    @update:model-value="todoDueDate = $event as CalendarDate"
                  />
                </div>
              </template>
            </UPopover>
          </div>
        </div>

        <div class="space-y-2">
          <TodoCountdownCheckbox v-model="todoIsCountdown" />
          <p class="text-xs text-muted ml-6">
            Display this event on the home screen with days remaining and AI-generated messages
          </p>
        </div>
      </div>

      <div class="flex justify-between p-4 border-t border-default">
        <UButton
          v-if="todo?.id"
          color="error"
          variant="ghost"
          icon="i-lucide-trash"
          @click="handleDelete"
        >
          Delete
        </UButton>
        <div class="flex gap-2" :class="{ 'ml-auto': !todo?.id }">
          <UButton
            color="neutral"
            variant="ghost"
            @click="emit('close')"
          >
            Cancel
          </UButton>
          <UButton
            color="primary"
            @click="handleSave"
          >
            {{ todo?.id ? 'Update Todo' : 'Add Todo' }}
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
