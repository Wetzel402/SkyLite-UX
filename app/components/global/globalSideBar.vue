<script setup lang="ts">
const route = useRoute();
function isActivePath(path: string) {
  return route.path === path;
};
function isListsActive() {
  return route.path === "/lists" || route.path === "/toDoLists" || route.path === "/shoppingLists";
}
</script>

<template>
  <nav class="sticky top-0 left-0 h-[calc(100vh-80px)] w-[70px] bg-default flex flex-col items-center justify-evenly py-4 z-100">
    <NuxtLink
      to="/calendar"
      class="flex flex-col items-center gap-0.5 p-1 rounded-lg transition-colors"
      :class="isActivePath('/calendar') ? 'text-primary' : 'text-muted hover:text-highlighted'"
      aria-label="Calendar"
    >
      <UIcon name="i-lucide-calendar-days" class="w-6 h-6" />
      <span class="text-[10px] font-medium">Calendar</span>
    </NuxtLink>
    <NuxtLink
      to="/chores"
      class="flex flex-col items-center gap-0.5 p-1 rounded-lg transition-colors"
      :class="isActivePath('/chores') ? 'text-primary' : 'text-muted hover:text-highlighted'"
      aria-label="Chores"
    >
      <UIcon name="i-lucide-clipboard-list" class="w-6 h-6" />
      <span class="text-[10px] font-medium">Chores</span>
    </NuxtLink>
    <NuxtLink
      to="/rewards"
      class="flex flex-col items-center gap-0.5 p-1 rounded-lg transition-colors"
      :class="isActivePath('/rewards') ? 'text-primary' : 'text-muted hover:text-highlighted'"
      aria-label="Rewards"
    >
      <UIcon name="i-lucide-gift" class="w-6 h-6" />
      <span class="text-[10px] font-medium">Rewards</span>
    </NuxtLink>
    <NuxtLink
      to="/lists"
      class="flex flex-col items-center gap-0.5 p-1 rounded-lg transition-colors"
      :class="isListsActive() ? 'text-primary' : 'text-muted hover:text-highlighted'"
      aria-label="Lists"
    >
      <UIcon name="i-lucide-list" class="w-6 h-6" />
      <span class="text-[10px] font-medium">Lists</span>
    </NuxtLink>
    <NuxtLink
      to="/mealplanner"
      class="flex flex-col items-center gap-0.5 p-1 rounded-lg transition-colors"
      :class="isActivePath('/mealplanner') ? 'text-primary' : 'text-muted hover:text-highlighted'"
      aria-label="Meals"
    >
      <UIcon name="i-lucide-utensils" class="w-6 h-6" />
      <span class="text-[10px] font-medium">Meals</span>
    </NuxtLink>
    <NuxtLink
      to="/settings"
      class="flex flex-col items-center gap-0.5 p-1 rounded-lg transition-colors"
      :class="isActivePath('/settings') ? 'text-primary' : 'text-muted hover:text-highlighted'"
      aria-label="Settings"
    >
      <UIcon name="i-lucide-settings" class="w-6 h-6" />
      <span class="text-[10px] font-medium">Settings</span>
    </NuxtLink>
  </nav>
</template>
