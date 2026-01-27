<script setup lang="ts">
const route = useRoute();

// @ts-ignore - Capacitor is added via script tag in Capacitor builds
const isCapacitor = typeof window !== "undefined" && "Capacitor" in window;

type NavItem = {
  to: string;
  icon: string;
  label: string;
};

const navigationItems = computed(() => {
  const allItems: NavItem[] = [
    { to: "/home", icon: "i-lucide-home", label: "Home" },
    { to: "/calendar", icon: "i-lucide-calendar-days", label: "Calendar" },
    { to: "/toDoLists", icon: "i-lucide-list-todo", label: "Todo Lists" },
    { to: "/shoppingLists", icon: "i-lucide-shopping-cart", label: "Shopping Lists" },
    { to: "/mealplanner", icon: "i-lucide-utensils", label: "Meal Planner" },
    { to: "/settings", icon: "i-lucide-settings", label: "Settings" },
    { to: "/mobile-settings", icon: "i-lucide-settings", label: "Settings" },
  ];

  // In Capacitor, only show meal planner and mobile settings
  if (isCapacitor) {
    return allItems.filter(item =>
      item.to === "/mealplanner" || item.to === "/mobile-settings",
    );
  }

  // On web, show all except mobile-settings
  return allItems.filter(item => item.to !== "/mobile-settings");
});

function isActivePath(path: string) {
  return route.path === path;
}
</script>

<template>
  <div class="sticky top-0 left-0 h-[calc(100vh-80px)] w-[50px] bg-default flex flex-col items-center justify-evenly py-4 z-100">
    <UButton
      v-for="item in navigationItems"
      :key="item.to"
      :class="isActivePath(item.to) ? 'text-primary' : 'text-default'"
      :to="item.to"
      variant="ghost"
      :icon="item.icon"
      size="xl"
      :aria-label="item.label"
    />
  </div>
</template>
