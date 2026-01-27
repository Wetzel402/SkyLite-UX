<script setup lang="ts">
import { onMounted } from "vue";

const router = useRouter();

// @ts-ignore - Capacitor is added via script tag in Capacitor builds
const isCapacitor = typeof window !== "undefined" && "Capacitor" in window;

let hasNavigated = false;

// Defensive navigation function - guarantees navigation happens
async function performNavigation() {
  if (hasNavigated) {
    console.log("[Index] Already navigated, skipping");
    return;
  }

  console.log("[Index] performNavigation called, isCapacitor:", isCapacitor);

  try {
    let targetRoute = "/home";

    if (isCapacitor) {
      console.log("[Index] Capacitor detected, checking server URL");

      const { Preferences } = await import("@capacitor/preferences");
      const { value: serverUrl } = await Preferences.get({ key: "serverUrl" });

      console.log("[Index] Server URL:", serverUrl ? "configured" : "not configured");

      if (!serverUrl || serverUrl.trim() === "") {
        targetRoute = "/mobile-settings";
      }
      else {
        targetRoute = "/mealplanner";
      }
    }

    console.log("[Index] Navigating to:", targetRoute);
    hasNavigated = true;

    // Use push instead of replace and ignore preload errors
    await router.push(targetRoute).catch((error) => {
      // Ignore navigation errors related to preloading
      if (error.name === "FetchError" || error.message?.includes("preload")) {
        console.warn("[Index] Ignoring preload error, navigation should still work:", error.name);
      }
      else {
        throw error; // Re-throw other errors
      }
    });

    console.log("[Index] Navigation completed");
  }
  catch (error) {
    console.error("[Index] Navigation error:", error);

    // Fallback: direct navigation
    if (!hasNavigated) {
      console.log("[Index] Using fallback navigation");
      hasNavigated = true;
      const fallbackRoute = isCapacitor ? "/mealplanner" : "/home";
      window.location.href = fallbackRoute;
    }
  }
}

// Store timeout for cleanup
let navigationTimeout: NodeJS.Timeout | null = null;

// Perform navigation on mount
onMounted(async () => {
  console.log("[Index] Component mounted");

  // Set a timeout fallback - if navigation hasn't happened after 2 seconds, force it
  navigationTimeout = setTimeout(() => {
    if (!hasNavigated) {
      console.warn("[Index] Navigation timeout - forcing navigation to mealplanner");
      hasNavigated = true;
      window.location.href = isCapacitor ? "/mealplanner" : "/home";
    }
  }, 2000);

  await performNavigation();

  if (navigationTimeout) {
    clearTimeout(navigationTimeout);
    navigationTimeout = null;
  }
});

// Cleanup on unmount
onUnmounted(() => {
  if (navigationTimeout) {
    clearTimeout(navigationTimeout);
    navigationTimeout = null;
  }
});
</script>

<template>
  <div class="flex items-center justify-center min-h-screen">
    <div class="text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
      <p class="text-muted">
        Loading...
      </p>
      <p class="text-xs text-muted mt-2">
        Connecting to meal planner...
      </p>
    </div>
  </div>
</template>
