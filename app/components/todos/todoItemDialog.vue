<script setup lang="ts">
import type { CalendarDate, DateValue } from "@internationalized/date";

import { getLocalTimeZone, parseDate } from "@internationalized/date";

import type {
  Priority,
  RecurrencePattern,
  RecurrenceType,
  TodoColumnBasic,
  TodoListItem,
} from "~/types/database";

import { useStableDate } from "~/composables/useStableDate";

const props = defineProps<{
  todo: TodoListItem | null;
  isOpen: boolean;
  todoColumns: TodoColumnBasic[];
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", todo: TodoListItem): void;
  (e: "delete", todoId: string, stopRecurrence?: boolean): void;
}>();

const { parseStableDate } = useStableDate();

const todoTitle = ref("");
const todoDescription = ref("");
const todoPriority = ref<Priority>("MEDIUM");
const todoDueDate = ref<DateValue | null>(null);
const todoColumnId = ref<string | undefined>(undefined);
const todoError = ref<string | null>(null);

// Recurrence fields
const isRecurring = ref(false);
const recurrenceType = ref<RecurrenceType>("daily");
const recurrenceInterval = ref(1);
const recurrenceDaysOfWeek = ref<number[]>([]);
const recurrenceDayOfMonth = ref(1);

const priorityOptions = [
  { label: "Low", value: "LOW" },
  { label: "Medium", value: "MEDIUM" },
  { label: "High", value: "HIGH" },
  { label: "Urgent", value: "URGENT" },
];

const recurrenceTypeOptions = [
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
];

const daysOfWeekOptions = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
];

watch(
  () => [props.isOpen, props.todo],
  ([isOpen, todo]) => {
    if (isOpen) {
      resetForm();
      if (todo && typeof todo === "object") {
        if ("name" in todo) {
          todoTitle.value = todo.name || "";
          todoDescription.value = todo.description || "";
          todoPriority.value = todo.priority || "MEDIUM";
          if (todo.dueDate) {
            const date =
              todo.dueDate instanceof Date
                ? todo.dueDate
                : parseStableDate(todo.dueDate);
            todoDueDate.value = parseDate(date.toISOString().split("T")[0]!);
          }
        }
        if ("todoColumnId" in todo) {
          todoColumnId.value = todo.todoColumnId || undefined;
        }
        // Load recurrence pattern if it exists
        if ("recurrencePattern" in todo && todo.recurrencePattern) {
          const pattern = todo.recurrencePattern as RecurrencePattern;
          isRecurring.value = true;
          recurrenceType.value = pattern.type;
          recurrenceInterval.value = pattern.interval;

          if (pattern.type === "weekly" && "daysOfWeek" in pattern) {
            recurrenceDaysOfWeek.value = pattern.daysOfWeek;
          }
          if (pattern.type === "monthly" && "dayOfMonth" in pattern) {
            recurrenceDayOfMonth.value = pattern.dayOfMonth;
          }
        }
      }
    }
  },
  { immediate: true },
);

function resetForm() {
  todoTitle.value = "";
  todoDescription.value = "";
  todoPriority.value = "MEDIUM";
  todoDueDate.value = null;
  todoColumnId.value = undefined;
  todoError.value = null;
  isRecurring.value = false;
  recurrenceType.value = "daily";
  recurrenceInterval.value = 1;
  recurrenceDaysOfWeek.value = [];
  recurrenceDayOfMonth.value = 1;
  showDeleteConfirm.value = false;
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

  // Validate recurrence fields
  if (isRecurring.value) {
    if (recurrenceInterval.value < 1) {
      todoError.value = "Interval must be at least 1";
      return;
    }
    if (
      recurrenceType.value === "weekly" &&
      recurrenceDaysOfWeek.value.length === 0
    ) {
      todoError.value = "Please select at least one day of the week";
      return;
    }
    if (
      recurrenceType.value === "monthly" &&
      (recurrenceDayOfMonth.value < 1 || recurrenceDayOfMonth.value > 31)
    ) {
      todoError.value = "Day of month must be between 1 and 31";
      return;
    }
  }

  // Build recurrence pattern
  let recurrencePattern: RecurrencePattern | null = null;
  if (isRecurring.value) {
    if (recurrenceType.value === "daily") {
      recurrencePattern = {
        type: "daily",
        interval: recurrenceInterval.value,
      };
    } else if (recurrenceType.value === "weekly") {
      recurrencePattern = {
        type: "weekly",
        interval: recurrenceInterval.value,
        daysOfWeek: recurrenceDaysOfWeek.value,
      };
    } else if (recurrenceType.value === "monthly") {
      recurrencePattern = {
        type: "monthly",
        interval: recurrenceInterval.value,
        dayOfMonth: recurrenceDayOfMonth.value,
      };
    }
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
    todoColumnId:
      todoColumnId.value ||
      (props.todoColumns.length > 0
        ? (props.todoColumns[0]?.id ?? undefined)
        : undefined),
    checked: props.todo?.checked || false,
    order: props.todo?.order || 0,
    recurrencePattern,
  };

  emit("save", todoData as unknown as TodoListItem);
  resetForm();
  emit("close");
}

const showDeleteConfirm = ref(false);

function handleDelete() {
  if (props.todo?.id) {
    // If it's a recurring todo, show confirmation with options
    if (props.todo.recurringGroupId) {
      showDeleteConfirm.value = true;
    } else {
      emit("delete", props.todo.id);
      emit("close");
    }
  }
}

function confirmDeleteThisOnly() {
  if (props.todo?.id) {
    emit("delete", props.todo.id, false);
    showDeleteConfirm.value = false;
    emit("close");
  }
}

function confirmDeleteAndStop() {
  if (props.todo?.id) {
    emit("delete", props.todo.id, true);
    showDeleteConfirm.value = false;
    emit("close");
  }
}

function toggleDayOfWeek(day: number) {
  if (recurrenceDaysOfWeek.value.includes(day)) {
    recurrenceDaysOfWeek.value = recurrenceDaysOfWeek.value.filter(
      (d) => d !== day,
    );
  } else {
    recurrenceDaysOfWeek.value = [...recurrenceDaysOfWeek.value, day];
  }
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
    @click.self="emit('close')"
  >
    <div
      class="w-[425px] max-h-[90vh] overflow-y-auto bg-default rounded-lg border border-default shadow-lg"
      @click.stop
    >
      <div
        class="flex items-center justify-between p-4 border-b border-default"
      >
        <h3 class="text-base font-semibold leading-6">
          {{ todo?.id ? "Edit Todo" : "Add Todo" }}
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
        <div
          v-if="todoError"
          class="bg-error/10 text-error rounded-md px-3 py-2 text-sm"
        >
          {{ todoError }}
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted"
            >Title</label
          >
          <UInput
            v-model="todoTitle"
            placeholder="Todo title"
            class="w-full"
            :ui="{ base: 'w-full' }"
          />
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted"
            >Description</label
          >
          <UTextarea
            v-model="todoDescription"
            placeholder="Todo description (optional)"
            :rows="3"
            class="w-full"
            :ui="{ base: 'w-full' }"
          />
        </div>

        <div class="flex gap-4">
          <div class="w-1/2 space-y-2">
            <label class="block text-sm font-medium text-highlighted"
              >Priority</label
            >
            <USelect
              v-model="todoPriority"
              :items="priorityOptions"
              option-attribute="label"
              value-attribute="value"
              class="w-full"
              :ui="{ base: 'w-full' }"
            />
          </div>

          <div class="w-1/2 space-y-2">
            <label class="block text-sm font-medium text-highlighted"
              >Due Date</label
            >
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

        <div class="space-y-3 pt-2 border-t border-default">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <UIcon
                name="i-lucide-repeat"
                class="h-4 w-4 transition-colors"
                :class="isRecurring ? 'text-primary' : 'text-muted'"
              />
              <label
                class="text-sm font-medium cursor-pointer transition-colors"
                :class="isRecurring ? 'text-primary' : 'text-highlighted'"
                @click="isRecurring = !isRecurring"
              >
                Repeat
                <span v-if="isRecurring" class="text-xs text-primary/70 ml-1"
                  >(enabled)</span
                >
              </label>
            </div>
            <UToggle v-model="isRecurring" size="md" />
          </div>

          <div
            v-if="isRecurring"
            class="space-y-3 pl-4 border-l-2 border-primary/20"
          >
            <div class="flex gap-3">
              <div class="flex-1 space-y-2">
                <label class="block text-xs font-medium text-muted"
                  >Frequency</label
                >
                <USelect
                  v-model="recurrenceType"
                  :items="recurrenceTypeOptions"
                  option-attribute="label"
                  value-attribute="value"
                  class="w-full"
                  :ui="{ base: 'w-full' }"
                />
              </div>

              <div class="w-24 space-y-2">
                <label class="block text-xs font-medium text-muted"
                  >Every</label
                >
                <UInput
                  v-model.number="recurrenceInterval"
                  type="number"
                  min="1"
                  class="w-full"
                  :ui="{ base: 'w-full' }"
                />
              </div>
            </div>

            <div v-if="recurrenceType === 'weekly'" class="space-y-2">
              <label class="block text-xs font-medium text-muted"
                >Days of Week</label
              >
              <div class="flex flex-wrap gap-2">
                <UButton
                  v-for="day in daysOfWeekOptions"
                  :key="day.value"
                  :color="
                    recurrenceDaysOfWeek.includes(day.value)
                      ? 'primary'
                      : 'neutral'
                  "
                  :variant="
                    recurrenceDaysOfWeek.includes(day.value)
                      ? 'solid'
                      : 'outline'
                  "
                  size="xs"
                  @click="toggleDayOfWeek(day.value)"
                >
                  {{ day.label }}
                </UButton>
              </div>
            </div>

            <div v-if="recurrenceType === 'monthly'" class="space-y-2">
              <label class="block text-xs font-medium text-muted"
                >Day of Month</label
              >
              <UInput
                v-model.number="recurrenceDayOfMonth"
                type="number"
                min="1"
                max="31"
                class="w-full"
                :ui="{ base: 'w-full' }"
              />
            </div>
          </div>
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
          <UButton color="neutral" variant="ghost" @click="emit('close')">
            Cancel
          </UButton>
          <UButton color="primary" @click="handleSave">
            {{ todo?.id ? "Update Todo" : "Add Todo" }}
          </UButton>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Dialog for Recurring Todos -->
    <div
      v-if="showDeleteConfirm"
      class="fixed inset-0 z-[110] flex items-center justify-center bg-black/50"
      @click="showDeleteConfirm = false"
    >
      <div
        class="w-[400px] bg-default rounded-lg border border-default shadow-lg"
        @click.stop
      >
        <div class="p-4 border-b border-default">
          <h3 class="text-base font-semibold leading-6">
            Delete Recurring Todo
          </h3>
        </div>

        <div class="p-4 space-y-3">
          <p class="text-sm text-muted">
            This is a recurring todo. What would you like to do?
          </p>

          <div class="space-y-2">
            <UButton
              color="neutral"
              variant="outline"
              class="w-full justify-start"
              @click="confirmDeleteThisOnly"
            >
              <template #leading>
                <UIcon name="i-lucide-skip-forward" />
              </template>
              Delete this and create next occurrence
            </UButton>

            <UButton
              color="error"
              variant="outline"
              class="w-full justify-start"
              @click="confirmDeleteAndStop"
            >
              <template #leading>
                <UIcon name="i-lucide-x-circle" />
              </template>
              Delete and stop recurrence
            </UButton>
          </div>
        </div>

        <div class="flex justify-end gap-2 p-4 border-t border-default">
          <UButton
            color="neutral"
            variant="ghost"
            @click="showDeleteConfirm = false"
          >
            Cancel
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
