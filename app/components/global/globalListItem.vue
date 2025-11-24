<script setup lang="ts">
import type { BaseListItem, Priority, ShoppingListItem, TodoListItem } from "~/types/database";
import type { ReorderDirectionEvent, ToggleEvent } from "~/types/ui";

defineProps<{
  item: BaseListItem;
  index: number;
  totalItems: number;
  showQuantity?: boolean;
  showNotes?: boolean;
  showReorder?: boolean;
  showEdit?: boolean | ((item: BaseListItem) => boolean);
}>();

const emit = defineEmits<{
  (e: "edit", item: BaseListItem): void;
  (e: "toggle", payload: ToggleEvent): void;
  (e: "reorder", payload: ReorderDirectionEvent): void;
}>();

function isShoppingItem(item: BaseListItem): item is ShoppingListItem {
  return "quantity" in item && "unit" in item;
}

function isTodoItem(item: BaseListItem): item is TodoListItem & { priority?: Priority; dueDate?: Date | null } {
  return "shoppingListId" in item;
}

function getPriorityColor(priority: Priority) {
  switch (priority) {
    case "LOW": return "text-green-600 bg-green-50 dark:bg-green-950";
    case "MEDIUM": return "text-yellow-600 bg-yellow-50 dark:bg-yellow-950";
    case "HIGH": return "text-orange-600 bg-orange-50 dark:bg-orange-950";
    case "URGENT": return "text-red-600 bg-red-50 dark:bg-red-950";
    default: return "text-muted bg-muted";
  }
}
</script>

<template>
  <div
    class="group flex items-start gap-3 p-3 rounded-lg transition-all bg-muted"
    :class="{ 'opacity-60 bg-default': item.checked }"
  >
    <UCheckbox
      v-if="item.checked !== undefined"
      :model-value="item.checked"
      color="primary"
      size="xl"
      aria-label="`Mark ${item.name} as ${item.checked ? 'incomplete' : 'complete'}`"
      @update:model-value="emit('toggle', { itemId: item.id, checked: Boolean($event) })"
      @click.stop
    />
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2">
        <span
          class="text-sm font-medium text-highlighted truncate"
          :class="{ 'line-through': item.checked }"
        >
          {{ item.name }}
        </span>
        <UIcon
          v-if="isTodoItem(item) && item.recurringGroupId"
          name="i-lucide-repeat"
          class="h-3.5 w-3.5 text-primary flex-shrink-0"
          aria-label="Recurring todo"
        />
      </div>
      <div class="flex items-center gap-2 mt-1">
        <span
          v-if="isTodoItem(item) && item.priority"
          class="text-xs px-2 py-0.5 rounded-full"
          :class="getPriorityColor(item.priority)"
        >
          {{ item.priority }}
        </span>
        <span
          v-if="isTodoItem(item) && item.dueDate"
          class="text-xs text-muted"
        >
          <NuxtTime
            :datetime="item.dueDate"
            year="numeric"
            month="short"
            day="numeric"
          />
        </span>
        <span
          v-if="isShoppingItem(item) && showQuantity && item.quantity"
          class="text-xs text-muted"
        >
          {{ item.quantity > 1 ? item.quantity : "" }} {{ item.unit === null || item.unit === "" ? "" : item.unit }}
        </span>
      </div>
      <p
        v-if="showNotes && item.notes && item.notes !== item.name"
        class="text-xs text-toned line-clamp-2 mt-1"
        :class="{ 'line-through': item.checked }"
      >
        {{ item.notes }}
      </p>
    </div>
    <div class="flex gap-1">
      <div v-if="showReorder" class="flex flex-col gap-1">
        <UButton
          v-if="index > 0"
          icon="i-lucide-chevron-up"
          size="xs"
          variant="ghost"
          color="neutral"
          aria-label="Move item up"
          @click="emit('reorder', { itemId: item.id, direction: 'up' })"
        />
        <UButton
          v-if="index < totalItems - 1"
          icon="i-lucide-chevron-down"
          size="xs"
          variant="ghost"
          color="neutral"
          aria-label="Move item down"
          @click="emit('reorder', { itemId: item.id, direction: 'down' })"
        />
      </div>
      <UButton
        v-if="typeof showEdit === 'function' ? showEdit(item) : showEdit"
        icon="i-lucide-pencil"
        size="xs"
        variant="ghost"
        color="neutral"
        :aria-label="`Edit ${item.name}`"
        @click="emit('edit', item)"
      />
    </div>
  </div>
</template>
