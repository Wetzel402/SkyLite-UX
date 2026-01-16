<script setup lang="ts">
// Tab state
const activeTab = ref("shopping");

const tabs = [
  { key: "shopping", label: "Shopping", icon: "i-lucide-shopping-cart" },
  { key: "todo", label: "To-Do", icon: "i-lucide-list-todo" },
];
</script>

<template>
  <div class="flex h-[calc(100vh-2rem)] w-full flex-col rounded-lg">
    <div class="py-5 sm:px-4 sticky top-0 z-40 bg-default border-b border-default">
      <GlobalDateHeader />
    </div>

    <div class="flex-1 flex flex-col min-h-0">
      <!-- Tab Navigation -->
      <div class="flex items-center gap-2 px-4 py-3 border-b border-default">
        <h1 class="text-2xl font-semibold text-default mr-4">
          Lists
        </h1>
        <div class="flex gap-2">
          <UButton
            v-for="tab in tabs"
            :key="tab.key"
            :icon="tab.icon"
            :variant="activeTab === tab.key ? 'solid' : 'ghost'"
            :color="activeTab === tab.key ? 'primary' : 'neutral'"
            size="sm"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
          </UButton>
        </div>
      </div>

      <!-- Tab Content -->
      <div class="flex-1 overflow-hidden">
        <KeepAlive>
          <ShoppingListsContent v-if="activeTab === 'shopping'" />
          <TodoListsContent v-else-if="activeTab === 'todo'" />
        </KeepAlive>
      </div>
    </div>
  </div>
</template>
