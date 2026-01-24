<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getPendingMeals, removePendingMeal, type PendingMeal } from '~/utils/offlineDb';
import { useOfflineSync } from '~/composables/useOfflineSync';

const pendingMeals = ref<PendingMeal[]>([]);
const { triggerSync } = useOfflineSync();

onMounted(async () => {
  await loadPendingMeals();
});

async function loadPendingMeals() {
  pendingMeals.value = await getPendingMeals();
}

async function retryAll() {
  await triggerSync();
  await loadPendingMeals();
}

async function deleteFromQueue(id: string) {
  await removePendingMeal(id);
  await loadPendingMeals();
}

async function syncAll() {
  await triggerSync();
  await loadPendingMeals();
}

async function clearAll() {
  await Promise.all(pendingMeals.value.map(item => removePendingMeal(item.id)));
  await loadPendingMeals();
}
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto">
    <h1 class="text-2xl font-bold mb-6">
      Offline Queue
    </h1>

    <div v-if="pendingMeals.length === 0" class="text-center py-8 text-muted">
      No pending changes
    </div>

    <div v-else class="space-y-4">
      <div
        v-for="item in pendingMeals"
        :key="item.id"
        class="p-4 border rounded-lg"
        :class="{
          'border-yellow-300 bg-yellow-50': item.status === 'pending',
          'border-blue-300 bg-blue-50': item.status === 'syncing',
          'border-red-300 bg-red-50': item.status === 'error'
        }"
      >
        <div class="flex items-start justify-between">
          <div>
            <h3 class="font-medium">
              {{ item.mealData.name }}
            </h3>
            <p class="text-sm text-muted">
              {{ item.mealData.mealType }} • Day {{ item.mealData.dayOfWeek }}
            </p>
            <p v-if="item.error" class="text-sm text-red-600 mt-1">
              Error: {{ item.error }}
            </p>
          </div>

          <div class="flex gap-2">
            <UButton
              size="xs"
              variant="ghost"
              icon="i-lucide-refresh-cw"
              @click="retryAll"
            >
              Retry All
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
      <UButton @click="syncAll">
        Sync All
      </UButton>
      <UButton variant="ghost" color="error" @click="clearAll">
        Clear All
      </UButton>
    </div>
  </div>
</template>
