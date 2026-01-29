<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";

import { useOfflineSync } from "~/composables/useOfflineSync";

const serverUrl = ref("");
const networkType = ref<string | null>(null);
const saveSuccess = ref(false);
const saveError = ref<string | null>(null);
const isTesting = ref(false);

// @ts-ignore - Capacitor is added via script tag in Capacitor builds
const isCapacitor = typeof window !== "undefined" && "Capacitor" in window;

// Get sync status from composable
const { isOnline, isSyncing, pendingCount, lastSyncTime, syncError, triggerSync } = useOfflineSync();

// Store network listener for cleanup
let networkListener: any = null;

onMounted(async () => {
  if (isCapacitor) {
    const { Preferences } = await import("@capacitor/preferences");
    const { Network } = await import("@capacitor/network");

    // Load server URL
    const { value } = await Preferences.get({ key: "serverUrl" });
    serverUrl.value = value || "";

    // Get network type
    const status = await Network.getStatus();
    networkType.value = status.connectionType || null;

    // Listen for network changes and store handle
    networkListener = await Network.addListener("networkStatusChange", (status) => {
      networkType.value = status.connectionType || null;
    });
  }
});

// Cleanup network listener on unmount
onUnmounted(async () => {
  if (networkListener) {
    await networkListener.remove();
  }
});

async function saveSettings() {
  saveSuccess.value = false;
  saveError.value = null;
  isTesting.value = true;

  try {
    // Validate URL is not empty
    const trimmedUrl = serverUrl.value?.trim();

    if (!trimmedUrl) {
      throw new Error("Server URL cannot be empty");
    }

    // Validate URL format
    if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://")) {
      throw new Error("URL must start with http:// or https://");
    }

    // Validate URL is well-formed
    try {
      new URL(trimmedUrl);
    }
    catch {
      throw new Error("Invalid URL format. Example: http://192.168.1.100:3000");
    }

    // Test connection to the server
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const testResponse = await fetch(`${trimmedUrl}/api/app-settings`, {
        method: "GET",
        headers: {
          "Accept": "application/json",
        },
        signal: controller.signal,
      });

      if (!testResponse.ok) {
        throw new Error(`Server responded with status ${testResponse.status}`);
      }
    }
    catch (error: any) {
      if (error instanceof Error) {
        if (error.name === "AbortError" || error.name === "TimeoutError") {
          throw new Error("Connection timeout - cannot reach server. Check the IP address and ensure the server is running.");
        }
        else if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
          throw new Error("Cannot connect to server. Check the IP address and ensure you're on the same network.");
        }
        else if (error.message.includes("status")) {
          throw new Error(`Server error: ${error.message}`);
        }
        throw new Error(`Connection failed: ${error.name} - ${error.message}`);
      }
      throw new Error("Failed to connect to server. Please verify the URL and try again.");
    }
    finally {
      clearTimeout(timeoutId);
    }

    // Dynamically import Capacitor
    const { Preferences } = await import("@capacitor/preferences");

    // Save to preferences
    await Preferences.set({ key: "serverUrl", value: trimmedUrl });

    // Verify it was saved by reading it back
    const { value: savedValue } = await Preferences.get({ key: "serverUrl" });

    if (savedValue !== trimmedUrl) {
      throw new Error("Failed to verify saved URL - preferences may not be persisting");
    }

    // Update global server URL for immediate effect (no restart needed)
    // @ts-ignore
    if (typeof window !== "undefined") {
      window.__CAPACITOR_SERVER_URL__ = trimmedUrl;
    }

    // Update the local value to the trimmed version
    serverUrl.value = trimmedUrl;

    saveSuccess.value = true;
  }
  catch (error: any) {

    if (error instanceof Error) {
      saveError.value = error.message;
    }
    else if (typeof error === "string") {
      saveError.value = error;
    }
    else {
      saveError.value = "Failed to save settings - unknown error";
    }
  }
  finally {
    isTesting.value = false;
  }
}

function formatLastSync(date: Date) {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1)
    return "Just now";
  if (diffMins === 1)
    return "1 minute ago";
  if (diffMins < 60)
    return `${diffMins} minutes ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1)
    return "1 hour ago";
  if (diffHours < 24)
    return `${diffHours} hours ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1)
    return "Yesterday";
  return `${diffDays} days ago`;
}
</script>

<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-6">
      Mobile Settings
    </h1>

    <div v-if="isCapacitor" class="space-y-4">
      <!-- Connection Status Card -->
      <div class="bg-default border border-default rounded-lg p-4">
        <h2 class="text-lg font-semibold mb-3 flex items-center gap-2">
          <UIcon name="i-lucide-wifi" class="h-5 w-5" />
          Connection Status
        </h2>

        <div class="space-y-3">
          <!-- Network: Online/Offline with pulsing dot -->
          <div class="flex items-center justify-between">
            <span class="text-sm text-muted">Network:</span>
            <div class="flex items-center gap-2">
              <div
                class="w-2 h-2 rounded-full"
                :class="[
                  isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500',
                ]"
              />
              <span
                class="font-medium text-sm"
                :class="[
                  isOnline ? 'text-green-600' : 'text-red-600',
                ]"
              >
                {{ isOnline ? 'Online' : 'Offline' }}
              </span>
            </div>
          </div>

          <!-- Server URL -->
          <div class="flex items-center justify-between">
            <span class="text-sm text-muted">Server:</span>
            <span class="font-mono text-xs text-highlighted truncate max-w-[200px]">
              {{ serverUrl || 'Not configured' }}
            </span>
          </div>

          <!-- Connection type -->
          <div v-if="networkType" class="flex items-center justify-between">
            <span class="text-sm text-muted">Connection:</span>
            <span class="text-sm font-medium">{{ networkType }}</span>
          </div>
        </div>
      </div>

      <!-- Sync Status Card -->
      <div class="bg-default border border-default rounded-lg p-4">
        <h2 class="text-lg font-semibold mb-3 flex items-center gap-2">
          <UIcon name="i-lucide-refresh-cw" class="h-5 w-5" />
          Sync Status
        </h2>

        <div class="space-y-3">
          <!-- Pending count (large, prominent) -->
          <div class="flex items-center justify-between">
            <span class="text-sm text-muted">Pending changes:</span>
            <div class="flex items-center gap-2">
              <span
                class="font-bold text-lg"
                :class="[
                  pendingCount > 0 ? 'text-yellow-600' : 'text-muted',
                ]"
              >
                {{ pendingCount }}
              </span>
              <span class="text-xs text-muted">{{ pendingCount === 1 ? 'meal' : 'meals' }}</span>
            </div>
          </div>

          <!-- Last sync time -->
          <div v-if="lastSyncTime" class="flex items-center justify-between">
            <span class="text-sm text-muted">Last synced:</span>
            <span class="text-sm font-medium">{{ formatLastSync(lastSyncTime) }}</span>
          </div>

          <!-- Sync status indicator -->
          <div v-if="isSyncing" class="flex items-center gap-2 text-blue-600">
            <UIcon name="i-lucide-loader" class="h-4 w-4 animate-spin" />
            <span class="text-sm font-medium">Syncing...</span>
          </div>

          <!-- Sync error -->
          <div v-else-if="syncError" class="flex items-start gap-2 text-red-600">
            <UIcon name="i-lucide-alert-circle" class="h-4 w-4 mt-0.5" />
            <div class="flex-1">
              <span class="text-sm font-medium block">Sync failed</span>
              <span class="text-xs">{{ syncError }}</span>
            </div>
          </div>

          <!-- Manual sync button -->
          <button
            v-if="isOnline && pendingCount > 0 && !isSyncing"
            class="w-full bg-green-500 text-white px-4 py-3 rounded-lg text-sm font-medium hover:bg-green-600 active:bg-green-700 flex items-center justify-center gap-2"
            @click="triggerSync"
          >
            <UIcon name="i-lucide-refresh-cw" class="h-4 w-4" />
            Sync Now ({{ pendingCount }} {{ pendingCount === 1 ? 'item' : 'items' }})
          </button>

          <!-- View queue details -->
          <button
            v-if="pendingCount > 0"
            class="w-full border border-default px-4 py-2 rounded-lg text-sm hover:bg-muted/5 active:bg-muted/10"
            @click="$router.push('/offline-queue')"
          >
            View Sync Queue Details
          </button>
        </div>
      </div>

      <!-- Server Configuration Card -->
      <div class="bg-default border border-default rounded-lg p-4">
        <h2 class="text-lg font-semibold mb-3 flex items-center gap-2">
          <UIcon name="i-lucide-server" class="h-5 w-5" />
          Server Configuration
        </h2>

        <!-- First-run alert -->
        <div v-if="!serverUrl" class="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 mb-4">
          <div class="flex items-start gap-3">
            <UIcon name="i-lucide-alert-circle" class="h-6 w-6 text-yellow-600 mt-0.5" />
            <div>
              <h3 class="font-semibold text-yellow-900 mb-1">
                Server Configuration Required
              </h3>
              <p class="text-sm text-yellow-800">
                Please enter your home server URL below to get started.
              </p>
            </div>
          </div>
        </div>

        <div class="space-y-3">
          <div>
            <label class="block mb-2 text-sm font-medium">Server URL</label>
            <input
              v-model="serverUrl"
              type="text"
              placeholder="http://192.168.1.100:3000"
              class="border border-default bg-default rounded-lg px-4 py-3 w-full font-mono text-sm"
              :class="!serverUrl ? 'border-yellow-400 border-2' : ''"
            >
            <p class="text-xs text-muted mt-1">
              Enter your SkyLite server's IP address and port.
            </p>
          </div>

          <button
            class="w-full bg-primary text-white px-4 py-3 rounded-lg hover:bg-primary/90 active:bg-primary/80 font-medium flex items-center justify-center gap-2"
            :class="{ 'opacity-50 cursor-not-allowed': isTesting }"
            :disabled="isTesting"
            @click="saveSettings"
          >
            <UIcon v-if="isTesting" name="i-lucide-loader" class="h-4 w-4 animate-spin" />
            {{ isTesting ? 'Testing Connection...' : 'Save Settings' }}
          </button>

          <!-- Success message -->
          <div v-if="saveSuccess" class="bg-green-100 text-green-800 p-4 rounded-lg">
            <p class="font-semibold mb-2">
              Settings saved successfully!
            </p>
            <button
              class="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 active:bg-green-800"
              @click="$router.push('/mealplanner')"
            >
              Continue to Meal Planner
            </button>
          </div>

          <!-- Error message -->
          <div v-if="saveError" class="bg-red-100 text-red-800 p-3 rounded-lg">
            {{ saveError }}
          </div>
        </div>
      </div>

      <!-- App Information Card -->
      <div class="bg-muted/10 border border-default rounded-lg p-4">
        <h2 class="text-lg font-semibold mb-3 flex items-center gap-2">
          <UIcon name="i-lucide-info" class="h-5 w-5" />
          App Information
        </h2>

        <div class="space-y-2 text-sm">
          <div class="flex items-center justify-between">
            <span class="text-muted">App Version:</span>
            <span class="font-medium">1.0.0</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-muted">Platform:</span>
            <span class="font-medium">Android (Capacitor)</span>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="text-muted">
      <p>This page is only available in the mobile app.</p>
      <p class="mt-2">
        Use the regular Settings page for web configuration.
      </p>
    </div>
  </div>
</template>
