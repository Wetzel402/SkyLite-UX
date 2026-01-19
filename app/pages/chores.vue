<script setup lang="ts">
import ChoreDialog from "~/components/chores/choreDialog.vue";
import GlobalFloatingActionButton from "~/components/global/globalFloatingActionButton.vue";

const showCreateDialog = ref(false);

type ChoreUser = {
  id: string;
  name: string;
  avatar: string | null;
};

type Chore = {
  id: string;
  name: string;
  description: string | null;
  pointValue: number;
  recurrence: string;
  assignedUser: ChoreUser | null;
  assignedUserId: string | null;
  dueDate: string | null;
  icon: string | null;
  status: "available" | "in-progress" | "pending-approval" | "completed";
  claimedBy: ChoreUser | null;
};

const chores = ref<Chore[]>([]);
const loading = ref(true);
const claiming = ref<string | null>(null);
const completing = ref<string | null>(null);

const { showError, showSuccess } = useAlertToast();

// For now, we'll use a simple user selection (in a real app, this would come from auth)
const users = ref<Array<{ id: string; name: string; avatar: string | null }>>([]);
const selectedUserId = ref<string | null>(null);

// Filter state
const activeFilter = ref<"all" | "my-chores" | "available">("all");

// Fetch chores
async function fetchChores() {
  try {
    loading.value = true;
    const data = await $fetch<Chore[]>("/api/chores");
    chores.value = data;
  }
  catch (error) {
    console.error("Failed to fetch chores:", error);
  }
  finally {
    loading.value = false;
  }
}

// Fetch users for selection
async function fetchUsers() {
  try {
    const data = await $fetch<Array<{ id: string; name: string; avatar: string | null }>>("/api/users");
    users.value = data;
    if (data.length > 0 && !selectedUserId.value) {
      selectedUserId.value = data[0].id;
    }
  }
  catch (error) {
    console.error("Failed to fetch users:", error);
  }
}

// Claim a chore
async function claimChore(choreId: string) {
  if (!selectedUserId.value) {
    showError("Please select a user first");
    return;
  }

  try {
    claiming.value = choreId;
    const result = await $fetch<Chore>(`/api/chores/${choreId}/claim`, {
      method: "POST",
      body: { userId: selectedUserId.value },
    });

    // Update the chore in the list
    const index = chores.value.findIndex(c => c.id === choreId);
    if (index !== -1) {
      chores.value[index] = result;
    }
  }
  catch (error: unknown) {
    const fetchError = error as { data?: { message?: string } };
    const message = fetchError.data?.message || "Failed to claim chore";
    showError(message);
  }
  finally {
    claiming.value = null;
  }
}

// Complete a chore
async function completeChore(choreId: string) {
  if (!selectedUserId.value) {
    showError("Please select a user first");
    return;
  }

  try {
    completing.value = choreId;
    const result = await $fetch<{ chore: Chore; status: string; message: string; pointsAwarded?: number }>(`/api/chores/${choreId}/complete`, {
      method: "POST",
      body: { userId: selectedUserId.value },
    });

    // Update the chore in the list
    const index = chores.value.findIndex(c => c.id === choreId);
    if (index !== -1) {
      chores.value[index] = {
        ...chores.value[index],
        status: result.status as Chore["status"],
      };
    }

    if (result.pointsAwarded) {
      showSuccess(`${result.message}`);
    }
  }
  catch (error: unknown) {
    const fetchError = error as { data?: { message?: string } };
    const message = fetchError.data?.message || "Failed to complete chore";
    showError(message);
  }
  finally {
    completing.value = null;
  }
}

const filteredChores = computed(() => {
  if (activeFilter.value === "all") {
    return chores.value;
  }
  if (activeFilter.value === "available") {
    return chores.value.filter(c => c.status === "available");
  }
  if (activeFilter.value === "my-chores" && selectedUserId.value) {
    return chores.value.filter(c =>
      c.assignedUserId === selectedUserId.value
      || c.claimedBy?.id === selectedUserId.value,
    );
  }
  return chores.value;
});

function getRecurrenceLabel(recurrence: string): string {
  switch (recurrence) {
    case "DAILY": return "Daily";
    case "WEEKLY": return "Weekly";
    case "MONTHLY": return "Monthly";
    default: return "One-time";
  }
}

function getStatusBadgeColor(status: string): string {
  switch (status) {
    case "available": return "primary";
    case "in-progress": return "warning";
    case "pending-approval": return "info";
    case "completed": return "success";
    default: return "neutral";
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "available": return "Available";
    case "in-progress": return "In Progress";
    case "pending-approval": return "Pending Approval";
    case "completed": return "Completed";
    default: return status;
  }
}

// Can the current user claim this chore?
function canClaim(chore: Chore): boolean {
  return chore.status === "available" && !chore.assignedUserId;
}

// Can the current user complete this chore?
function canComplete(chore: Chore): boolean {
  if (!selectedUserId.value)
    return false;
  return (
    chore.status === "in-progress"
    && (chore.assignedUserId === selectedUserId.value || chore.claimedBy?.id === selectedUserId.value)
  );
}

// Check if chore is overdue
function isOverdue(chore: Chore): boolean {
  if (!chore.dueDate)
    return false;
  if (chore.status === "completed")
    return false;
  const dueDate = new Date(chore.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dueDate < today;
}

// Format due date for display
function formatDueDate(dateString: string | null): string {
  if (!dateString)
    return "";
  const date = new Date(dateString);
  return date.toLocaleDateString();
}

onMounted(() => {
  fetchChores();
  fetchUsers();
});
</script>

<template>
  <div class="flex h-[calc(100vh-2rem)] w-full flex-col rounded-lg">
    <div class="py-5 sm:px-4 sticky top-0 z-40 bg-default border-b border-default">
      <GlobalDateHeader />
    </div>

    <div class="flex-1 bg-default p-6 overflow-auto">
      <div class="max-w-6xl mx-auto">
        <!-- Header with filters -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <h1 class="text-2xl font-bold text-highlighted">
            Chores
          </h1>
          <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <!-- User selector -->
            <div v-if="users.length > 0" class="flex items-center gap-2">
              <span class="text-sm text-muted">Acting as:</span>
              <select
                v-model="selectedUserId"
                class="border border-default rounded px-2 py-1 text-sm bg-default"
              >
                <option
                  v-for="user in users"
                  :key="user.id"
                  :value="user.id"
                >
                  {{ user.name }}
                </option>
              </select>
            </div>
            <UButtonGroup>
              <UButton
                :variant="activeFilter === 'all' ? 'solid' : 'ghost'"
                @click="activeFilter = 'all'"
              >
                All
              </UButton>
              <UButton
                :variant="activeFilter === 'my-chores' ? 'solid' : 'ghost'"
                @click="activeFilter = 'my-chores'"
              >
                My Chores
              </UButton>
              <UButton
                :variant="activeFilter === 'available' ? 'solid' : 'ghost'"
                @click="activeFilter = 'available'"
              >
                Available
              </UButton>
            </UButtonGroup>
          </div>
        </div>

        <!-- Loading state -->
        <div v-if="loading" class="flex items-center justify-center py-12">
          <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-primary" />
          <span class="ml-2 text-muted">Loading chores...</span>
        </div>

        <!-- Empty state -->
        <div v-else-if="filteredChores.length === 0" class="flex flex-col items-center justify-center py-12">
          <UIcon name="i-lucide-clipboard-list" class="w-16 h-16 text-muted mb-4" />
          <h2 class="text-xl font-semibold text-highlighted mb-2">
            No chores found
          </h2>
          <p class="text-muted text-center max-w-md">
            Chores help teach responsibility and reward good behavior. Create your first chore to get started!
          </p>
        </div>

        <!-- Chores grid -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="chore in filteredChores"
            :key="chore.id"
            class="bg-default rounded-lg border p-4 hover:shadow-md transition-shadow"
            :class="isOverdue(chore) ? 'border-error/50 bg-error/5' : 'border-default'"
          >
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <UIcon
                    :name="chore.icon || 'i-lucide-sparkles'"
                    class="w-5 h-5 text-primary"
                  />
                </div>
                <div>
                  <h3 class="font-semibold text-highlighted">
                    {{ chore.name }}
                  </h3>
                  <p class="text-sm text-muted">
                    {{ getRecurrenceLabel(chore.recurrence) }}
                  </p>
                </div>
              </div>
              <UBadge :color="getStatusBadgeColor(chore.status)" size="sm">
                {{ getStatusLabel(chore.status) }}
              </UBadge>
            </div>

            <p v-if="chore.description" class="text-sm text-muted mb-3">
              {{ chore.description }}
            </p>

            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 flex-wrap">
                <UBadge
                  color="warning"
                  variant="soft"
                  size="sm"
                >
                  <UIcon name="i-lucide-star" class="w-3 h-3 mr-1" />
                  {{ chore.pointValue }} pts
                </UBadge>
                <UBadge
                  v-if="isOverdue(chore)"
                  color="error"
                  variant="soft"
                  size="sm"
                >
                  <UIcon name="i-lucide-alert-circle" class="w-3 h-3 mr-1" />
                  Overdue
                </UBadge>
                <UBadge
                  v-else-if="chore.dueDate"
                  color="neutral"
                  variant="soft"
                  size="sm"
                >
                  <UIcon name="i-lucide-calendar" class="w-3 h-3 mr-1" />
                  Due {{ formatDueDate(chore.dueDate) }}
                </UBadge>
                <div v-if="chore.claimedBy || chore.assignedUser" class="flex items-center gap-1">
                  <img
                    :src="(chore.claimedBy || chore.assignedUser)?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent((chore.claimedBy || chore.assignedUser)?.name || '')}&size=24`"
                    class="w-5 h-5 rounded-full"
                    :alt="(chore.claimedBy || chore.assignedUser)?.name"
                  >
                  <span class="text-xs text-muted">{{ (chore.claimedBy || chore.assignedUser)?.name }}</span>
                </div>
              </div>
              <UButton
                v-if="canClaim(chore)"
                size="sm"
                color="primary"
                :loading="claiming === chore.id"
                :disabled="!!claiming"
                @click="claimChore(chore.id)"
              >
                Claim
              </UButton>
              <UButton
                v-else-if="canComplete(chore)"
                size="sm"
                color="success"
                :loading="completing === chore.id"
                :disabled="!!completing"
                @click="completeChore(chore.id)"
              >
                Complete
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Floating action button for creating chores (parent only) -->
    <GlobalFloatingActionButton
      icon="i-lucide-plus"
      label="Add new chore"
      color="primary"
      size="lg"
      position="bottom-right"
      @click="showCreateDialog = true"
    />

    <!-- Create Chore Dialog -->
    <ChoreDialog
      :is-open="showCreateDialog"
      @close="showCreateDialog = false"
      @created="fetchChores"
    />
  </div>
</template>
