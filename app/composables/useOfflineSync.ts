import { consola } from "consola";
import { onMounted, onUnmounted, readonly, ref } from "vue";

import {
  getPendingMeals,
  removePendingMeal,
  updatePendingMealStatus,
} from "~/utils/offlineDb";

export function useOfflineSync() {
  const isOnline = ref(false);
  const isSyncing = ref(false);
  const pendingCount = ref(0);
  const lastSyncTime = ref<Date | null>(null);
  const syncError = ref<string | null>(null);

  let syncInterval: NodeJS.Timeout | null = null;
  let healthCheckInterval: NodeJS.Timeout | null = null;
  let networkListener: any = null; // Store Capacitor Network listener subscription
  // @ts-ignore - Capacitor is added via script tag in Capacitor builds
  const isCapacitor = typeof window !== "undefined" && "Capacitor" in window;

  // Check if we can actually reach the server
  async function checkServerReachability(): Promise<boolean> {
    try {
      // Get server URL from Capacitor preferences or use default
      let serverUrl = "";

      if (isCapacitor) {
        const { Preferences } = await import("@capacitor/preferences");
        const { value } = await Preferences.get({ key: "serverUrl" });
        serverUrl = value || "";
      }

      // If no server URL configured, assume browser (always reachable)
      if (!serverUrl) {
        return true;
      }

      consola.info("[Offline Sync] Checking server reachability:", serverUrl);

      // Lightweight health check - use HEAD request to avoid downloading data
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

      try {
        const response = await fetch(`${serverUrl}/api/app-settings`, {
          method: "HEAD",
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const reachable = response.ok;
        consola.info("[Offline Sync] Server reachable:", reachable);
        return reachable;
      }
      catch (fetchError: any) {
        clearTimeout(timeoutId);
        consola.warn("[Offline Sync] Server not reachable:", fetchError.message);
        return false;
      }
    }
    catch (error: any) {
      consola.error("[Offline Sync] Failed to check server reachability:", error);
      return false;
    }
  }

  // Update online status based on server reachability
  async function updateOnlineStatus() {
    const reachable = await checkServerReachability();
    const wasOnline = isOnline.value;
    isOnline.value = reachable;

    consola.info("[Offline Sync] Online status updated:", {
      wasOnline,
      isOnline: isOnline.value,
      changed: wasOnline !== isOnline.value,
    });

    // Trigger sync if we just came online
    if (!wasOnline && isOnline.value) {
      consola.info("[Offline Sync] Server became reachable, triggering sync");
      triggerSync();
    }
  }

  // Load pending count
  async function updatePendingCount() {
    const pending = await getPendingMeals();
    pendingCount.value = pending.length;
  }

  // Sync pending meals to server
  async function syncPendingMeals() {
    if (!isOnline.value || isSyncing.value)
      return;

    isSyncing.value = true;
    syncError.value = null;

    try {
      const pending = await getPendingMeals();

      for (const item of pending) {
        try {
          await updatePendingMealStatus(item.id, "syncing");

          await $fetch(`/api/meal-plans/${item.mealPlanId}/meals`, {
            method: "POST",
            body: item.mealData,
          });

          await removePendingMeal(item.id);
        }
        catch (error) {
          await updatePendingMealStatus(
            item.id,
            "error",
            error instanceof Error ? error.message : "Sync failed",
          );
        }
      }

      lastSyncTime.value = new Date();
      await updatePendingCount();
      await refreshNuxtData("meal-plans");
    }
    catch (error) {
      syncError.value = error instanceof Error ? error.message : "Sync failed";
    }
    finally {
      isSyncing.value = false;
    }
  }

  async function triggerSync() {
    if (isOnline.value) {
      await syncPendingMeals();
    }
  }

  // Event handlers for cleanup (web only)
  const onOnlineHandler = async () => {
    consola.info("[Offline Sync] Browser reported online event");
    await updateOnlineStatus();
  };

  const onOfflineHandler = () => {
    consola.info("[Offline Sync] Browser reported offline event");
    isOnline.value = false;
  };

  // Capacitor Network listener - check server reachability, not just device connectivity
  const onNetworkChange = async (status: any) => {
    consola.info("[Offline Sync] Network status changed:", {
      connected: status.connected,
      connectionType: status.connectionType,
    });

    if (status.connected) {
      // Device has network, but can we reach the server?
      await updateOnlineStatus();
    }
    else {
      // Device has no network at all
      isOnline.value = false;
    }
  };

  // Initialize on client
  onMounted(async () => {
    consola.info("[Offline Sync] Initializing offline sync...");

    if (isCapacitor) {
      // Dynamically import Capacitor Network API
      const { Network } = await import("@capacitor/network");

      const status = await Network.getStatus();
      consola.info("[Offline Sync] Initial network status:", {
        connected: status.connected,
        connectionType: status.connectionType,
      });

      // Check actual server reachability, not just device connectivity
      if (status.connected) {
        await updateOnlineStatus();
      }
      else {
        isOnline.value = false;
      }

      // Add event listener for network changes and store subscription
      networkListener = await Network.addListener("networkStatusChange", onNetworkChange);
    }
    else {
      // Use browser API (assume server is always reachable in browser)
      isOnline.value = navigator.onLine;

      // Add event listeners
      window.addEventListener("online", onOnlineHandler);
      window.addEventListener("offline", onOfflineHandler);
    }

    // Load pending count
    await updatePendingCount();

    // Auto-sync periodically when online
    syncInterval = setInterval(() => {
      if (isOnline.value && pendingCount.value > 0) {
        consola.info("[Offline Sync] Periodic sync check: triggering sync");
        triggerSync();
      }
    }, 30000);

    // Periodic health check - verify server reachability every 10 seconds
    // This catches cases where network type changes (wifi->5G) without triggering network event
    if (isCapacitor) {
      healthCheckInterval = setInterval(async () => {
        consola.info("[Offline Sync] Periodic health check");
        await updateOnlineStatus();
      }, 10000);
    }
  });

  // Cleanup on unmount
  onUnmounted(async () => {
    consola.info("[Offline Sync] Cleaning up offline sync...");

    if (isCapacitor && networkListener) {
      // Remove only this component's Network listener
      await networkListener.remove();
    }
    else if (!isCapacitor) {
      // Remove browser event listeners
      window.removeEventListener("online", onOnlineHandler);
      window.removeEventListener("offline", onOfflineHandler);
    }

    if (syncInterval) {
      clearInterval(syncInterval);
    }

    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
    }
  });

  return {
    isOnline: readonly(isOnline),
    isSyncing: readonly(isSyncing),
    pendingCount: readonly(pendingCount),
    lastSyncTime: readonly(lastSyncTime),
    syncError: readonly(syncError),
    triggerSync,
    updatePendingCount,
  };
}
