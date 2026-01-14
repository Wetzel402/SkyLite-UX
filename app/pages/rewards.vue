<script setup lang="ts">
import GlobalFloatingActionButton from "~/components/global/globalFloatingActionButton.vue";

// Placeholder for rewards data - will be connected to API when database is available
const rewards = ref<Array<{
  id: string;
  name: string;
  description: string | null;
  pointCost: number;
  quantityAvailable: number | null;
  expiresAt: Date | null;
  icon: string | null;
}>>([]);

// User's current point balance (will come from API)
const currentPoints = ref(0);

const loading = ref(false);

function canRedeem(reward: { pointCost: number; quantityAvailable: number | null }): boolean {
  if (reward.pointCost > currentPoints.value) return false;
  if (reward.quantityAvailable !== null && reward.quantityAvailable <= 0) return false;
  return true;
}
</script>

<template>
  <div class="flex h-[calc(100vh-2rem)] w-full flex-col rounded-lg">
    <div class="py-5 sm:px-4 sticky top-0 z-40 bg-default border-b border-default">
      <GlobalDateHeader />
    </div>

    <div class="flex-1 bg-default p-6 overflow-auto">
      <div class="max-w-6xl mx-auto">
        <!-- Header with points balance -->
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-2xl font-bold text-highlighted">
            Rewards
          </h1>
          <div class="flex items-center gap-2 bg-warning/10 px-4 py-2 rounded-lg border border-warning/20">
            <UIcon name="i-lucide-star" class="w-5 h-5 text-warning" />
            <span class="font-semibold text-highlighted">{{ currentPoints }}</span>
            <span class="text-muted">points available</span>
          </div>
        </div>

        <!-- Loading state -->
        <div v-if="loading" class="flex items-center justify-center py-12">
          <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-primary" />
          <span class="ml-2 text-muted">Loading rewards...</span>
        </div>

        <!-- Empty state -->
        <div v-else-if="rewards.length === 0" class="flex flex-col items-center justify-center py-12">
          <UIcon name="i-lucide-gift" class="w-16 h-16 text-muted mb-4" />
          <h2 class="text-xl font-semibold text-highlighted mb-2">
            No rewards available
          </h2>
          <p class="text-muted text-center max-w-md">
            Rewards can be redeemed using points earned from completing chores. Check back soon for available rewards!
          </p>
        </div>

        <!-- Rewards grid -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="reward in rewards"
            :key="reward.id"
            class="bg-default rounded-lg border border-default p-4 hover:shadow-md transition-shadow"
            :class="{ 'opacity-50': !canRedeem(reward) }"
          >
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <UIcon
                    :name="reward.icon || 'i-lucide-gift'"
                    class="w-6 h-6 text-primary"
                  />
                </div>
                <div>
                  <h3 class="font-semibold text-highlighted">
                    {{ reward.name }}
                  </h3>
                  <div class="flex items-center gap-1 text-warning">
                    <UIcon name="i-lucide-star" class="w-4 h-4" />
                    <span class="font-medium">{{ reward.pointCost }} pts</span>
                  </div>
                </div>
              </div>
            </div>

            <p v-if="reward.description" class="text-sm text-muted mb-3">
              {{ reward.description }}
            </p>

            <div class="flex items-center justify-between mt-4">
              <div class="flex items-center gap-2">
                <span v-if="reward.quantityAvailable !== null" class="text-xs text-muted">
                  {{ reward.quantityAvailable }} left
                </span>
                <span v-if="reward.expiresAt" class="text-xs text-error">
                  Expires {{ new Date(reward.expiresAt).toLocaleDateString() }}
                </span>
              </div>
              <UButton
                size="sm"
                :color="canRedeem(reward) ? 'primary' : 'neutral'"
                :disabled="!canRedeem(reward)"
              >
                <UIcon name="i-lucide-gift" class="w-4 h-4 mr-1" />
                Redeem
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Floating action button for creating rewards (parent only) -->
    <GlobalFloatingActionButton
      icon="i-lucide-plus"
      label="Add new reward"
      color="primary"
      size="lg"
      position="bottom-right"
      @click="() => { /* TODO: Open create reward dialog */ }"
    />
  </div>
</template>
