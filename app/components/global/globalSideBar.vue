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
  <div class="sticky top-0 left-0 h-[calc(100vh-80px)] w-[50px] bg-default flex flex-col items-center justify-evenly py-4 z-100">
    <UButton
      :class="isActivePath('/calendar') ? 'text-primary' : 'text-default'"
      to="/calendar"
      variant="ghost"
      icon="i-lucide-calendar-days"
      size="xl"
      aria-label="Calendar"
    />
    <UButton
      :class="isActivePath('/chores') ? 'text-primary' : 'text-default'"
      to="/chores"
      variant="ghost"
      icon="i-lucide-clipboard-list"
      size="xl"
      aria-label="Chores"
    />
    <UButton
      :class="isActivePath('/rewards') ? 'text-primary' : 'text-default'"
      to="/rewards"
      variant="ghost"
      icon="i-lucide-gift"
      size="xl"
      aria-label="Rewards"
    />
    <UButton
      :class="isListsActive() ? 'text-primary' : 'text-default'"
      to="/lists"
      variant="ghost"
      icon="i-lucide-list"
      size="xl"
      aria-label="Lists"
    />
    <UButton
      :class="isActivePath('/mealplanner') ? 'text-primary' : 'text-default'"
      to="/mealplanner"
      variant="ghost"
      icon="i-lucide-utensils"
      size="xl"
      aria-label="Meal Planner"
    />
    <UButton
      :class="isActivePath('/settings') ? 'text-primary' : 'text-default'"
      to="/settings"
      variant="ghost"
      icon="i-lucide-settings"
      size="xl"
      aria-label="Settings"
    />
  </div>
</template>
