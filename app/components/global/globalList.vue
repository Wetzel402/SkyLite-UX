<script setup lang="ts">
import type { AnyListWithIntegration } from "~/types/ui";

import type { BaseListItem } from "../../types/database";

const props = defineProps<{
  lists: readonly AnyListWithIntegration[];
  loading?: boolean;
  emptyStateIcon?: string;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  showProgress?: boolean;
  showQuantity?: boolean;
  showNotes?: boolean;
  showReorder?: boolean;
  showEdit?: boolean | ((list: AnyListWithIntegration) => boolean);
  showAdd?: boolean | ((list: AnyListWithIntegration) => boolean);
  showEditItem?: boolean | ((list: AnyListWithIntegration) => boolean);
  showCompleted?: boolean | ((list: AnyListWithIntegration) => boolean);
  showIntegrationIcons?: boolean;
}>();

const _emit = defineEmits<{
  (e: "create"): void;
  (e: "edit", list: AnyListWithIntegration): void;
  (e: "addItem", listId: string): void;
  (e: "editItem", item: BaseListItem): void;
  (e: "toggleItem", itemId: string, checked: boolean): void;
  (e: "reorderItem", itemId: string, direction: "up" | "down"): void;
  (e: "reorderList", listId: string, direction: "up" | "down"): void;
  (e: "clearCompleted", listId: string): void;
}>();

const sortedLists = computed(() => {
  return [...props.lists]
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map(list => ({
      ...list,
      sortedItems: list.items ? [...list.items].sort((a, b) => (a.order || 0) - (b.order || 0)) : [],
      completedItems: list.items ? list.items.filter((item: BaseListItem) => item.checked) : [],
      activeItems: list.items ? list.items.filter((item: BaseListItem) => !item.checked) : [],
    }));
});

function getProgressPercentage(list: AnyListWithIntegration) {
  if (!list.items || list.items.length === 0)
    return 0;
  const checkedItems = list.items.filter((item: BaseListItem) => item.checked).length;
  return Math.round((checkedItems / list.items.length) * 100);
}

function getProgressColor(percentage: number) {
  if (percentage === 100)
    return "bg-green-500";
  if (percentage >= 75)
    return "bg-blue-500";
  if (percentage >= 50)
    return "bg-yellow-500";
  if (percentage >= 25)
    return "bg-orange-500";
  return "bg-red-500";
}

const showItemEdit = computed(() => {
  if (typeof props.showEditItem === "function") {
    return (item: BaseListItem) => {
      const list = props.lists.find(l => l.items?.some(i => i.id === item.id));
      return list ? (props.showEditItem as (list: AnyListWithIntegration) => boolean)(list) : false;
    };
  }
  return props.showEditItem;
});

function hasIntegrationProperties(list: AnyListWithIntegration): list is AnyListWithIntegration & { source: "integration" | "native" } {
  return "source" in list && (list.source === "integration" || list.source === "native");
}

// Track which lists are expanded on mobile (all collapsed by default)
const expandedLists = ref<Set<string>>(new Set());

function toggleListExpanded(listId: string) {
  const newSet = new Set(expandedLists.value);
  if (newSet.has(listId)) {
    newSet.delete(listId);
  }
  else {
    newSet.add(listId);
  }
  expandedLists.value = newSet;
}

function isListExpanded(listId: string) {
  return expandedLists.value.has(listId);
}
</script>

<template>
  <div class="flex w-full flex-col rounded-lg">
    <div class="flex-1">
      <div class="p-4">
        <div v-if="loading" class="flex items-center justify-center h-full">
          <div class="text-center">
            <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-primary-500" />
            <p class="mt-2 text-sm text-muted">
              Loading lists...
            </p>
          </div>
        </div>
        <div v-else-if="lists.length === 0" class="flex items-center justify-center h-full">
          <div class="text-center">
            <UIcon :name="emptyStateIcon || 'i-lucide-list'" class="h-8 w-8 text-muted" />
            <p class="mt-2 text-sm text-muted">
              {{ emptyStateTitle || 'No lists found' }}
            </p>
            <p v-if="emptyStateDescription" class="mt-1 text-sm text-muted">
              {{ emptyStateDescription }}
            </p>
            <UButton
              class="mt-4"
              color="primary"
              @click="_emit('create')"
            >
              Create List
            </UButton>
          </div>
        </div>
        <div v-else class="h-full overflow-x-hidden">
          <!-- Mobile: vertical stack, Desktop: horizontal scroll -->
          <div class="h-full overflow-y-auto overflow-x-hidden md:overflow-y-hidden md:overflow-x-auto md:pb-4">
            <div class="flex flex-col md:flex-row md:gap-6 md:min-w-max md:h-full overflow-x-hidden md:overflow-x-visible">
              <div
                v-for="(list, listIndex) in sortedLists"
                :key="list.id"
                class="flex-shrink-0 w-full md:w-80 flex flex-col bg-default md:rounded-lg border-b md:border border-default md:shadow-sm md:h-full"
              >
                <div
                  class="p-4 md:border-b border-default bg-default md:rounded-t-lg cursor-pointer md:cursor-default"
                  @click.stop="toggleListExpanded(list.id)"
                >
                  <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center gap-2 flex-1 min-w-0">
                      <div
                        v-if="showIntegrationIcons && hasIntegrationProperties(list) && list.source === 'integration' && list.integrationIcon"
                        class="w-5 h-5 rounded-sm flex items-center justify-center flex-shrink-0"
                      >
                        <img
                          :src="list.integrationIcon"
                          :alt="list.integrationName || 'Integration'"
                          class="h-4 w-4"
                          style="object-fit: contain"
                          @error="(event) => { const target = event.target as HTMLImageElement; if (target) target.style.display = 'none'; }"
                        >
                      </div>
                      <div
                        v-else-if="showIntegrationIcons && hasIntegrationProperties(list) && list.source === 'native'"
                        class="w-5 h-5 rounded-sm flex items-center justify-center flex-shrink-0"
                      >
                        <img
                          src="/favicon.ico"
                          alt="SkyLite"
                          class="h-5 w-5"
                          style="object-fit: contain"
                          @error="(event) => { const target = event.target as HTMLImageElement; if (target) target.style.display = 'none'; }"
                        >
                      </div>
                      <h2 class="text-lg font-semibold text-highlighted truncate">
                        {{ list.name }}
                      </h2>
                      <!-- Mobile expand/collapse indicator -->
                      <UIcon
                        :name="isListExpanded(list.id) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                        class="md:hidden h-5 w-5 text-muted flex-shrink-0 ml-2"
                      />
                    </div>
                    <div class="hidden md:flex gap-1">
                      <div
                        v-if="showReorder"
                        class="flex flex-col gap-1 items-center justify-center"
                        style="height: 64px;"
                      >
                        <template v-if="listIndex > 0 && listIndex < sortedLists.length - 1">
                          <UButton
                            class="hidden md:inline-flex"
                            icon="i-lucide-chevron-left"
                            size="xs"
                            variant="ghost"
                            color="neutral"
                            aria-label="Move list left"
                            @click="_emit('reorderList', list.id, 'up')"
                          />
                          <UButton
                            class="md:hidden"
                            icon="i-lucide-chevron-up"
                            size="xs"
                            variant="ghost"
                            color="neutral"
                            aria-label="Move list up"
                            @click="_emit('reorderList', list.id, 'up')"
                          />
                          <UButton
                            class="hidden md:inline-flex"
                            icon="i-lucide-chevron-right"
                            size="xs"
                            variant="ghost"
                            color="neutral"
                            aria-label="Move list right"
                            @click="_emit('reorderList', list.id, 'down')"
                          />
                          <UButton
                            class="md:hidden"
                            icon="i-lucide-chevron-down"
                            size="xs"
                            variant="ghost"
                            color="neutral"
                            aria-label="Move list down"
                            @click="_emit('reorderList', list.id, 'down')"
                          />
                        </template>
                        <template v-else-if="listIndex > 0">
                          <div style="height: 16px;" />
                          <UButton
                            class="hidden md:inline-flex"
                            icon="i-lucide-chevron-left"
                            size="xs"
                            variant="ghost"
                            color="neutral"
                            aria-label="Move list left"
                            @click="_emit('reorderList', list.id, 'up')"
                          />
                          <UButton
                            class="md:hidden"
                            icon="i-lucide-chevron-up"
                            size="xs"
                            variant="ghost"
                            color="neutral"
                            aria-label="Move list up"
                            @click="_emit('reorderList', list.id, 'up')"
                          />
                          <div style="height: 16px;" />
                        </template>
                        <template v-else-if="listIndex < sortedLists.length - 1">
                          <div style="height: 16px;" />
                          <UButton
                            class="hidden md:inline-flex"
                            icon="i-lucide-chevron-right"
                            size="xs"
                            variant="ghost"
                            color="neutral"
                            aria-label="Move list right"
                            @click="_emit('reorderList', list.id, 'down')"
                          />
                          <UButton
                            class="md:hidden"
                            icon="i-lucide-chevron-down"
                            size="xs"
                            variant="ghost"
                            color="neutral"
                            aria-label="Move list down"
                            @click="_emit('reorderList', list.id, 'down')"
                          />
                          <div style="height: 16px;" />
                        </template>
                      </div>
                      <UButton
                        v-if="typeof showEdit === 'function' ? showEdit(list) : showEdit"
                        icon="i-lucide-pencil"
                        size="xs"
                        variant="ghost"
                        color="neutral"
                        :aria-label="`Edit ${list.name}`"
                        @click="_emit('edit', list)"
                      />
                    </div>
                  </div>

                  <div v-if="showProgress && list.items && list.items.length > 0" class="space-y-2">
                    <div class="flex justify-between text-sm">
                      <span class="text-muted">
                        {{ list.items.filter((item: BaseListItem) => item.checked).length }} of {{ list.items.length }} items
                      </span>
                      <span class="text-muted font-medium">
                        {{ getProgressPercentage(list) }}%
                      </span>
                    </div>
                    <div class="w-full bg-muted rounded-full h-2">
                      <div
                        class="h-2 rounded-full transition-all duration-300"
                        :class="getProgressColor(getProgressPercentage(list))"
                        :style="{ width: `${getProgressPercentage(list)}%` }"
                      />
                    </div>
                  </div>
                  <div v-else-if="!list.items || list.items.length === 0 && showProgress" class="text-sm text-muted py-4.5" />
                </div>

                <!-- Content - always visible on desktop, collapsible on mobile -->
                <div
                  class="flex-1 p-4 overflow-y-auto"
                  :class="{ 'hidden md:block': !isListExpanded(list.id) }"
                >
                  <div v-if="typeof showAdd === 'function' ? showAdd(list) : showAdd" class="flex justify-center mb-4">
                    <UButton
                      size="xl"
                      color="primary"
                      class="w-full"
                      @click="_emit('addItem', list.id)"
                    >
                      <UIcon name="i-lucide-plus" class="h-4 w-4 mr-1" />
                      Add Item
                    </UButton>
                  </div>

                  <div v-if="!list.items || list.items.length === 0" class="flex flex-col items-center justify-center py-12 text-muted">
                    <UIcon name="i-lucide-list" class="h-12 w-12 mb-3 opacity-30" />
                    <p class="text-sm font-medium mb-1">
                      No items yet
                    </p>
                    <p class="text-xs mb-4">
                      Add your first item to get started
                    </p>
                  </div>
                  <div v-else class="space-y-4">
                    <div v-if="list.activeItems.length > 0" class="space-y-2">
                      <GlobalListItem
                        v-for="(item, index) in list.activeItems"
                        :key="item.id"
                        :item="item"
                        :index="index"
                        :total-items="list.activeItems.length"
                        :show-quantity="showQuantity"
                        :show-notes="showNotes"
                        :show-reorder="(list as AnyListWithIntegration).source === 'integration' ? false : showReorder"
                        :show-edit="showItemEdit"
                        @edit="_emit('editItem', $event)"
                        @toggle="(payload) => _emit('toggleItem', payload.itemId, payload.checked)"
                        @reorder="(payload) => _emit('reorderItem', payload.itemId, payload.direction)"
                      />
                    </div>

                    <div v-if="(typeof showCompleted === 'function' ? showCompleted(list) : showCompleted) && list.completedItems.length > 0" class="space-y-2">
                      <div class="flex items-center justify-between px-1">
                        <h3 class="text-sm font-medium text-muted">
                          Completed ({{ list.completedItems.length }})
                        </h3>
                        <UButton
                          v-if="list.completedItems.length > 0"
                          size="xs"
                          variant="ghost"
                          color="neutral"
                          @click="_emit('clearCompleted', list.id)"
                        >
                          Clear
                        </UButton>
                      </div>
                      <GlobalListItem
                        v-for="(item, index) in list.completedItems"
                        :key="item.id"
                        :item="item"
                        :index="index"
                        :total-items="list.completedItems.length"
                        :show-quantity="showQuantity"
                        :show-notes="showNotes"
                        :show-reorder="(list as AnyListWithIntegration).source === 'integration' ? false : showReorder"
                        :show-edit="showItemEdit"
                        @edit="_emit('editItem', $event)"
                        @toggle="(payload) => _emit('toggleItem', payload.itemId, payload.checked)"
                        @reorder="(payload) => _emit('reorderItem', payload.itemId, payload.direction)"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
