<script setup lang="ts">
import { onMounted, ref } from "vue";

import type { PendingMeal } from "~/utils/offlineDb";

import { useAlertToast } from "~/composables/useAlertToast";
import { useOfflineSync } from "~/composables/useOfflineSync";
import { getPendingMeals, removePendingMeal } from "~/utils/offlineDb";

const pendingMeals = ref<PendingMeal[]>([]);
const { triggerSync, updatePendingCount } = useOfflineSync();
const { showSuccess, showError } = useAlertToast();
const isSyncing = ref(false);
const isClearing = ref(false);

onMounted(async () => {
  await loadPendingMeals();
});

async function loadPendingMeals() {
  pendingMeals.value = await getPendingMeals();
}

// Shared helper for sync operations
async function performSync(successTitle: string, successMessage: string) {
  try {
    await triggerSync();
    await loadPendingMeals();
    showSuccess(successTitle, successMessage);
  }
  catch {
    showError("Sync Failed", "Failed to sync meals");
  }
}

async function retrySync() {
  if (isSyncing.value)
    return;
  isSyncing.value = true;
  try {
    await performSync("Sync Triggered", "Attempting to sync pending meals");
  }
  finally {
    isSyncing.value = false;
  }
}

async function deleteFromQueue(id: string) {
  try {
    await removePendingMeal(id);
    await updatePendingCount();
    await loadPendingMeals();
    showSuccess("Deleted", "Meal removed from queue");
  }
  catch {
    showError("Delete Failed", "Failed to remove meal from queue");
  }
}

async function syncAll() {
  if (isSyncing.value)
    return;
  isSyncing.value = true;
  try {
    await performSync("Sync Started", "Syncing all pending meals");
  }
  finally {
    isSyncing.value = false;
  }
}

async function clearAll() {
  // Confirmation for destructive action
  // eslint-disable-next-line no-alert
  const confirmed = confirm("Are you sure you want to clear all pending meals? This cannot be undone.");
  if (!confirmed)
    return;

  if (isClearing.value)
    return;
  isClearing.value = true;
  try {
    for (const item of pendingMeals.value) {
      await removePendingMeal(item.id);
    }
    await updatePendingCount();
    await loadPendingMeals();
    showSuccess("Cleared", "All pending meals removed");
  }
  catch {
    showError("Clear Failed", "Failed to clear queue");
  }
  finally {
    isClearing.value = false;
  }
}

const mealTypeLabels: Record<string, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
};

const dayLabels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto">
    <div class="mb-6">
      <h1 class="text-2xl font-bold">
        Offline Queue
      </h1>
      <p class="text-sm text-muted mt-1">
        Manage meals waiting to sync to the server
      </p>
    </div>

    <div v-if="pendingMeals.length === 0" class="text-center py-12 border border-default rounded-lg bg-muted/5">
      <UIcon name="i-lucide-check-circle" class="h-12 w-12 mx-auto text-green-500 mb-2" />
      <p class="text-muted font-medium">
        No pending changes
      </p>
      <p class="text-sm text-muted mt-1">
        All meals are synced with the server
      </p>
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="item in pendingMeals"
        :key="item.id"
        class="p-4 border rounded-lg"
        :class="{
          'border-yellow-300 bg-yellow-50': item.status === 'pending',
          'border-blue-300 bg-blue-50': item.status === 'syncing',
          'border-red-300 bg-red-50': item.status === 'error',
        }"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <h3 class="font-medium">
                {{ item.mealData.name }}
              </h3>
              <UBadge
                :color="item.status === 'error' ? 'error' : item.status === 'syncing' ? 'primary' : 'warning'"
                size="xs"
              >
                {{ item.status }}
              </UBadge>
            </div>
            <p class="text-sm text-muted">
              {{ mealTypeLabels[item.mealData.mealType] }} • {{ dayLabels[item.mealData.dayOfWeek] }}
            </p>
            <p v-if="item.mealData.description" class="text-sm text-muted mt-1">
              {{ item.mealData.description }}
            </p>
            <p v-if="item.mealData.daysInAdvance && item.mealData.daysInAdvance > 0" class="text-sm text-muted mt-1">
              Prep: {{ item.mealData.daysInAdvance }} day{{ item.mealData.daysInAdvance !== 1 ? 's' : '' }} before
            </p>
            <p v-if="item.error" class="text-sm text-red-600 mt-2">
              <UIcon name="i-lucide-alert-circle" class="inline h-4 w-4" />
              Error: {{ item.error }}
            </p>
            <p class="text-xs text-muted mt-2">
              Created: {{ new Date(item.timestamp).toLocaleString() }}
            </p>
          </div>

          <div class="flex gap-2">
            <UButton
              size="xs"
              variant="ghost"
              icon="i-lucide-refresh-cw"
              @click="retrySync()"
            >
              Retry
            </UButton>
            <UButton
              size="xs"
              variant="ghost"
              color="error"
              icon="i-lucide-trash-2"
              @click="deleteFromQueue(item.id)"
            >
              Delete
            </UButton>
          </div>
        </div>
      </div>
    </div>

    <div v-if="pendingMeals.length > 0" class="mt-6 flex gap-3">
      <UButton :loading="isSyncing" :disabled="isSyncing" @click="syncAll">
        <UIcon name="i-lucide-cloud-upload" class="h-4 w-4" />
        Sync All
      </UButton>
      <UButton
        variant="ghost"
        color="error"
        :loading="isClearing"
        :disabled="isClearing"
        @click="clearAll"
      >
        <UIcon name="i-lucide-trash-2" class="h-4 w-4" />
        Clear All
      </UButton>
    </div>

    <div class="mt-6">
      <UButton
        variant="ghost"
        @click="$router.push('/mealPlanner')"
      >
        <UIcon name="i-lucide-arrow-left" class="h-4 w-4" />
        Back to Meal Planner
      </UButton>
    </div>
  </div>
</template>
