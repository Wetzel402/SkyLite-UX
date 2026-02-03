<script setup lang="ts">
import type { DateValue } from "@internationalized/date";

import {
  CalendarDate,
  getLocalTimeZone,
  parseDate,
} from "@internationalized/date";

import type { Priority, TodoColumnBasic, TodoListItem } from "~/types/database";
import type { RecurrenceState } from "~/types/recurrence";

import {
  getDefaultDateToday,
  getDefaultRecurrenceUntil,
  useRecurrence,
} from "~/composables/useRecurrence";
import { useStableDate } from "~/composables/useStableDate";

import type { ICalEvent } from "../../../server/integrations/iCal/types";

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
const {
  parseRecurrenceFromICal,
  generateRecurrenceRule,
  resetRecurrenceFields,
} = useRecurrence();

const todoTitle = ref("");
const todoDescription = ref("");
const todoPriority = ref<Priority>("MEDIUM");
const todoDueDate = ref<DateValue | null>(null);
const todoDueDateForPicker = computed(() => todoDueDate.value as DateValue | null);
const todoColumnId = ref<string | undefined>(undefined);
const todoError = ref<string | null>(null);

const isRecurring = ref(false);
const recurrenceType = ref<"daily" | "weekly" | "monthly" | "yearly">("daily");
const recurrenceInterval = ref(1);
const recurrenceEndType = ref<"never" | "count" | "until">("never");
const recurrenceCount = ref(10);
const recurrenceUntil = ref<DateValue>(getDefaultDateToday());
const recurrenceDays = ref<number[]>([]);
const recurrenceMonthlyType = ref<"day" | "weekday">("day");
const recurrenceMonthlyWeekday = ref<{ week: number; day: number }>({
  week: 1,
  day: 1,
});
const recurrenceYearlyType = ref<"day" | "weekday">("day");
const recurrenceYearlyWeekday = ref<{
  week: number;
  day: number;
  month: number;
}>({ week: 1, day: 1, month: 0 });

const recurrenceState: RecurrenceState = {
  isRecurring,
  recurrenceType,
  recurrenceInterval,
  recurrenceEndType,
  recurrenceCount,
  recurrenceUntil: recurrenceUntil as Ref<DateValue>,
  recurrenceDays,
  recurrenceMonthlyType,
  recurrenceMonthlyWeekday,
  recurrenceYearlyType,
  recurrenceYearlyWeekday,
};

const prevTodoRecurrenceEndType = ref<"never" | "count" | "until">("never");
const prevTodoRecurrenceType = ref<"daily" | "weekly" | "monthly" | "yearly">("daily");

watch([recurrenceEndType, recurrenceType], () => {
  if (recurrenceEndType.value === "until") {
    const justSwitchedToUntil = prevTodoRecurrenceEndType.value !== "until";
    const typeChangedWhileUntil = prevTodoRecurrenceType.value !== recurrenceType.value;
    if (justSwitchedToUntil || typeChangedWhileUntil) {
      const refDate = todoDueDate.value ?? getDefaultDateToday();
      recurrenceUntil.value = getDefaultRecurrenceUntil(
        refDate as DateValue,
        recurrenceType.value,
      );
    }
    prevTodoRecurrenceEndType.value = recurrenceEndType.value;
    prevTodoRecurrenceType.value = recurrenceType.value;
  }
  else {
    prevTodoRecurrenceEndType.value = recurrenceEndType.value;
    prevTodoRecurrenceType.value = recurrenceType.value;
  }
});

let isUpdatingTodoUntil = false;
watch(todoDueDate, (newDue) => {
  if (
    !isUpdatingTodoUntil
    && isRecurring.value
    && recurrenceEndType.value === "until"
    && newDue
    && recurrenceUntil.value
  ) {
    const dueVal = newDue;
    const untilVal = recurrenceUntil.value;
    const dueAfterUntil
      = dueVal.year > untilVal.year
        || (dueVal.year === untilVal.year && dueVal.month > untilVal.month)
        || (dueVal.year === untilVal.year && dueVal.month === untilVal.month && dueVal.day > untilVal.day);
    if (dueAfterUntil) {
      recurrenceUntil.value = getDefaultRecurrenceUntil(
        newDue as DateValue,
        recurrenceType.value,
      );
    }
  }
});

watch(recurrenceUntil, () => {
  if (
    !isUpdatingTodoUntil
    && isRecurring.value
    && recurrenceEndType.value === "until"
    && recurrenceUntil.value
  ) {
    const dueVal = todoDueDate.value;
    if (!dueVal)
      return;
    const untilVal = recurrenceUntil.value;
    const untilBeforeDue
      = untilVal.year < dueVal.year
        || (untilVal.year === dueVal.year && untilVal.month < dueVal.month)
        || (untilVal.year === dueVal.year && untilVal.month === dueVal.month && untilVal.day < dueVal.day);
    if (untilBeforeDue) {
      isUpdatingTodoUntil = true;
      todoDueDate.value = new CalendarDate(
        untilVal.year,
        untilVal.month,
        untilVal.day,
      );
      isUpdatingTodoUntil = false;
    }
  }
});

const priorityOptions = [
  { label: "Low", value: "LOW" },
  { label: "Medium", value: "MEDIUM" },
  { label: "High", value: "HIGH" },
  { label: "Urgent", value: "URGENT" },
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
            const date
              = todo.dueDate instanceof Date
                ? todo.dueDate
                : parseStableDate(todo.dueDate);
            todoDueDate.value = parseDate(date.toISOString().split("T")[0]!);
          }
        }
        if ("todoColumnId" in todo) {
          todoColumnId.value = todo.todoColumnId || undefined;
        }
        if ("rrule" in todo && todo.rrule) {
          const rrule = todo.rrule as ICalEvent["rrule"];
          const icalEvent: ICalEvent = {
            type: "VEVENT",
            uid: todo.id || "",
            summary: todo.name || "",
            description: todo.description || undefined,
            dtstart: todo.dueDate
              ? new Date(todo.dueDate).toISOString().replace(/\.\d{3}Z$/, "Z")
              : new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
            dtend: todo.dueDate
              ? new Date(todo.dueDate).toISOString().replace(/\.\d{3}Z$/, "Z")
              : new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
            rrule,
          };
          parseRecurrenceFromICal(icalEvent, recurrenceState);
          prevTodoRecurrenceEndType.value = recurrenceEndType.value;
          prevTodoRecurrenceType.value = recurrenceType.value;
        }
      }
    }
  },
  { immediate: true },
);

const showDeleteConfirm = ref(false);

function resetForm() {
  todoTitle.value = "";
  todoDescription.value = "";
  todoPriority.value = "MEDIUM";
  todoDueDate.value = null;
  todoColumnId.value = undefined;
  todoError.value = null;
  resetRecurrenceFields(recurrenceState);
  prevTodoRecurrenceEndType.value = recurrenceEndType.value;
  prevTodoRecurrenceType.value = recurrenceType.value;
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

  if (isRecurring.value) {
    if (recurrenceInterval.value < 1) {
      todoError.value = "Interval must be at least 1";
      return;
    }
    if (
      recurrenceType.value === "weekly"
      && recurrenceDays.value.length === 0
    ) {
      todoError.value = "Please select at least one day of the week";
      return;
    }
    if (recurrenceEndType.value === "until") {
      if (!todoDueDate.value) {
        todoError.value = "Due date is required when using an end date for recurrence";
        return;
      }
      if (recurrenceUntil.value) {
        const dueVal = todoDueDate.value;
        const untilVal = recurrenceUntil.value;
        const untilOnOrBeforeDue
          = untilVal.year < dueVal.year
            || (untilVal.year === dueVal.year && untilVal.month < dueVal.month)
            || (untilVal.year === dueVal.year && untilVal.month === dueVal.month && untilVal.day <= dueVal.day);
        if (untilOnOrBeforeDue) {
          todoError.value = "Recurrence end date must be after due date";
          return;
        }
      }
    }
  }

  let rrule: ICalEvent["rrule"] | null = null;
  if (isRecurring.value) {
    const startDate = todoDueDate.value
      ? todoDueDate.value.toDate(getLocalTimeZone())
      : new Date();
    rrule = generateRecurrenceRule(recurrenceState, startDate);
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
      todoColumnId.value
      || (props.todoColumns.length > 0
        ? (props.todoColumns[0]?.id ?? undefined)
        : undefined),
    checked: props.todo?.checked || false,
    order: props.todo?.order || 0,
    rrule,
  };

  emit("save", todoData as TodoListItem);
  resetForm();
  emit("close");
}

function handleDelete() {
  if (props.todo?.id) {
    if (props.todo.recurringGroupId) {
      showDeleteConfirm.value = true;
    }
    else {
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

        <div class="flex gap-4">
          <div class="w-1/2 space-y-2">
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

          <div class="w-1/2 space-y-2">
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
                  <GlobalDatePicker
                    :model-value="todoDueDateForPicker"
                    @update:model-value="todoDueDate = $event"
                  />
                </div>
              </template>
            </UPopover>
          </div>
        </div>

        <GlobalRecurrenceForm
          :state="recurrenceState"
          @update:state="recurrenceState = $event"
        />
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
