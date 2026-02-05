import { consola } from "consola";
import { onMounted, onUnmounted, readonly, ref } from "vue";

import {
  getPendingMeals,
  getPendingTodos,
  removePendingMeal,
  removePendingTodo,
  updatePendingMealStatus,
  updatePendingTodoStatus,
} from "~/utils/offlineDb";

// @ts-ignore - Capacitor is added via script tag in Capacitor builds
const isCapacitor = typeof window !== "undefined" && "Capacitor" in window;

// SINGLETON STATE - shared across all components
let _isOnline = ref(false);
let _isSyncing = ref(false);
let _pendingCount = ref(0);
let _lastSyncTime = ref<Date | null>(null);
let _syncError = ref<string | null>(null);
let _initialized = false;
let _refCount = 0; // Track number of active components
let _syncInterval: NodeJS.Timeout | null = null;
let _healthCheckInterval: NodeJS.Timeout | null = null;
let _networkListener: any = null;

export function useOfflineSync() {
  // Return existing singleton state
  const isOnline = _isOnline;
  const isSyncing = _isSyncing;
  const pendingCount = _pendingCount;
  const lastSyncTime = _lastSyncTime;
  const syncError = _syncError;

  // Check if we can actually reach the server (singleton function)
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

      // Use GET request (HEAD not supported by server)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

      try {
        const response = await fetch(`${serverUrl}/api/app-settings`, {
          method: "GET",
          headers: {
            "Accept": "application/json",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const reachable = response.ok;
        return reachable;
      }
      catch (fetchError: any) {
        clearTimeout(timeoutId);
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
    const wasOnline = _isOnline.value;
    _isOnline.value = reachable;

    // Trigger sync if we just came online
    if (!wasOnline && _isOnline.value) {
      triggerSync();
    }
  }

  // Load pending count
  async function updatePendingCount() {
    const pendingMeals = await getPendingMeals();
    const pendingTodos = await getPendingTodos();
    _pendingCount.value = pendingMeals.length + pendingTodos.length;
  }

  // Sync pending meals to server
  async function syncPendingMeals() {
    if (!_isOnline.value || _isSyncing.value)
      return;

    _isSyncing.value = true;
    _syncError.value = null;

    try {
      const pending = await getPendingMeals();

      for (const item of pending) {
        try {
          await updatePendingMealStatus(item.id, "syncing");

          await $fetch(`/api/meal-plans/${item.mealPlanId}/meals`, {
            method: "POST",
            body: item.mealData,
            timeout: 10000, // 10 second timeout
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

      _lastSyncTime.value = new Date();
      await updatePendingCount();
      await refreshNuxtData("meal-plans");
    }
    catch (error) {
      _syncError.value = error instanceof Error ? error.message : "Sync failed";
    }
    finally {
      _isSyncing.value = false;
    }
  }

  // Sync pending todos to server
  async function syncPendingTodos() {
    if (!_isOnline.value || _isSyncing.value)
      return;

    _isSyncing.value = true;
    _syncError.value = null;

    try {
      const pending = await getPendingTodos();

      for (const item of pending) {
        try {
          await updatePendingTodoStatus(item.id, "syncing");

          await $fetch("/api/todos", {
            method: "POST",
            body: item.todoData,
            timeout: 10000, // 10 second timeout
          });

          await removePendingTodo(item.id);
        }
        catch (error) {
          await updatePendingTodoStatus(
            item.id,
            "error",
            error instanceof Error ? error.message : "Sync failed",
          );
        }
      }

      _lastSyncTime.value = new Date();
      await updatePendingCount();
      await refreshNuxtData("todos");
    }
    catch (error) {
      _syncError.value = error instanceof Error ? error.message : "Sync failed";
    }
    finally {
      _isSyncing.value = false;
    }
  }

  async function triggerSync() {
    if (_isOnline.value) {
      await syncPendingMeals();
      await syncPendingTodos();
    }
  }

  // Event handlers for cleanup (web only)
  const onOnlineHandler = async () => {
    await updateOnlineStatus();
  };

  const onOfflineHandler = () => {
    _isOnline.value = false;
  };

  // Capacitor Network listener - check server reachability, not just device connectivity
  const onNetworkChange = async (status: any) => {
    if (status.connected) {
      // Device has network, but can we reach the server?
      await updateOnlineStatus();
    }
    else {
      // Device has no network at all
      _isOnline.value = false;
    }
  };

  // Initialize on client (only once for singleton)
  onMounted(async () => {
    _refCount++;

    if (_initialized) {
      return;
    }

    _initialized = true;

    if (isCapacitor) {
      // Dynamically import Capacitor Network API
      const { Network } = await import("@capacitor/network");

      const status = await Network.getStatus();

      // Check actual server reachability, not just device connectivity
      if (status.connected) {
        await updateOnlineStatus();
      }
      else {
        _isOnline.value = false;
      }

      // Add event listener for network changes and store subscription
      _networkListener = await Network.addListener("networkStatusChange", onNetworkChange);
    }
    else {
      // Use browser API (assume server is always reachable in browser)
      _isOnline.value = navigator.onLine;

      // Add event listeners
      window.addEventListener("online", onOnlineHandler);
      window.addEventListener("offline", onOfflineHandler);
    }

    // Load pending count
    await updatePendingCount();

    // Auto-sync periodically when online
    _syncInterval = setInterval(() => {
      if (_isOnline.value && _pendingCount.value > 0) {
        triggerSync();
      }
    }, 30000);

    // Periodic health check - verify server reachability every 10 seconds
    // This catches cases where network type changes (wifi->5G) without triggering network event
    if (isCapacitor) {
      _healthCheckInterval = setInterval(async () => {
        await updateOnlineStatus();
      }, 10000);
    }
  });

  // Cleanup on unmount - Note: Singleton state persists across all components
  // Only cleanup when last component unmounts
  onUnmounted(async () => {
    _refCount--;

    // Only cleanup when last component unmounts
    if (_refCount === 0) {
      // Clear intervals
      if (_syncInterval) {
        clearInterval(_syncInterval);
        _syncInterval = null;
      }

      if (_healthCheckInterval) {
        clearInterval(_healthCheckInterval);
        _healthCheckInterval = null;
      }

      // Remove network listener
      if (isCapacitor && _networkListener) {
        await _networkListener.remove();
        _networkListener = null;
      }
      else if (!isCapacitor) {
        // Remove browser event listeners
        window.removeEventListener("online", onOnlineHandler);
        window.removeEventListener("offline", onOfflineHandler);
      }

      // Reset initialized flag so future mounts reinitialize
      _initialized = false;
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
