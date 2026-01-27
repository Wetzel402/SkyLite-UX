<script setup lang="ts">
import { useOfflineSync } from "~/composables/useOfflineSync";

const { isOnline, isSyncing, pendingCount, triggerSync } = useOfflineSync();
</script>

<template>
  <div
    v-if="!isOnline || pendingCount > 0 || isSyncing"
    class="sticky top-0 z-50 bg-yellow-50 border-b border-yellow-200 px-4 py-2"
  >
    <div class="flex items-center justify-between max-w-4xl mx-auto">
      <div v-if="!isOnline" class="flex items-center gap-2 text-yellow-700">
        <UIcon name="i-lucide-wifi-off" class="h-5 w-5" />
        <span class="text-sm font-medium">Offline - Changes will sync when connected</span>
      </div>

      <div v-else-if="isSyncing" class="flex items-center gap-2 text-blue-700">
        <UIcon name="i-lucide-loader-2" class="h-5 w-5 animate-spin" />
        <span class="text-sm font-medium">Syncing...</span>
      </div>

      <div v-else-if="pendingCount > 0" class="flex items-center gap-2 text-yellow-700">
        <UIcon name="i-lucide-cloud-upload" class="h-5 w-5" />
        <span class="text-sm font-medium">
          {{ pendingCount }} meal{{ pendingCount !== 1 ? 's' : '' }} pending sync
        </span>
      </div>

      <UButton
        v-if="isOnline && pendingCount > 0"
        size="xs"
        @click="triggerSync"
      >
        Sync Now
      </UButton>
    </div>
  </div>
</template>
