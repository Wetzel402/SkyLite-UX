<script setup lang="ts">
const route = useRoute();
function isActivePath(path: string) {
  return route.path === path;
};
</script>

<template>
  <div class="sticky top-0 left-0 h-[calc(100vh-80px)] w-[50px] bg-default flex flex-col items-center justify-evenly py-4 z-100">
    <UButton
      :class="isActivePath('/home') ? 'text-primary' : 'text-default'"
      to="/home"
      variant="ghost"
      icon="i-lucide-home"
      size="xl"
      aria-label="Home"
    />
    <UButton
      :class="isActivePath('/calendar') ? 'text-primary' : 'text-default'"
      to="/calendar"
      variant="ghost"
      icon="i-lucide-calendar-days"
      size="xl"
      aria-label="Calendar"
    />
    <UButton
      :class="isActivePath('/toDoLists') ? 'text-primary' : 'text-default'"
      to="/toDoLists"
      variant="ghost"
      icon="i-lucide-list-todo"
      size="xl"
      aria-label="Todo Lists"
    />
    <UButton
      :class="isActivePath('/shoppingLists') ? 'text-primary' : 'text-default'"
      to="/shoppingLists"
      variant="ghost"
      icon="i-lucide-shopping-cart"
      size="xl"
      aria-label="Shopping Lists"
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
