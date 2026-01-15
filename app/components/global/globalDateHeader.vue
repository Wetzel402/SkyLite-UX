<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui";

import { addDays, endOfWeek, isSameMonth, startOfWeek } from "date-fns";

import type { CalendarView } from "~/types/calendar";

import { useStableDate } from "~/composables/useStableDate";
import { useUsers } from "~/composables/useUsers";

const props = defineProps<{
  showNavigation?: boolean;
  showViewSelector?: boolean;
  showExport?: boolean;
  showUserFilter?: boolean;
  currentDate?: Date;
  view?: CalendarView;
  className?: string;
  selectedUserIds?: string[];
}>();

const emit = defineEmits<{
  (e: "previous"): void;
  (e: "next"): void;
  (e: "today"): void;
  (e: "viewChange", view: CalendarView): void;
  (e: "dateChange", date: Date): void;
  (e: "export"): void;
  (e: "userFilterChange", userIds: string[]): void;
}>();

const isExporting = ref(false);

async function handleExport() {
  isExporting.value = true;
  try {
    // Trigger file download by navigating to the export endpoint
    const link = document.createElement("a");
    link.href = "/api/calendar-events/export";
    link.download = "skylite-calendar.ics";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    emit("export");
  }
  finally {
    isExporting.value = false;
  }
}

const { getStableDate } = useStableDate();
const { users, fetchUsers } = useUsers();

// Fetch users on mount
onMounted(() => {
  fetchUsers();
});

const selectedUsers = computed(() => props.selectedUserIds || []);

function isUserSelected(userId: string) {
  return selectedUsers.value.length === 0 || selectedUsers.value.includes(userId);
}

function toggleUserFilter(userId: string) {
  const currentSelection = [...selectedUsers.value];
  const index = currentSelection.indexOf(userId);

  if (index === -1) {
    // Add user to filter
    currentSelection.push(userId);
  }
  else {
    // Remove user from filter
    currentSelection.splice(index, 1);
  }

  emit("userFilterChange", currentSelection);
}

function clearUserFilter() {
  emit("userFilterChange", []);
}

const currentDate = computed(() => props.currentDate || getStableDate());
const view = computed(() => props.view || "week");

const now = ref(new Date());

onMounted(() => {
  const interval = setInterval(() => {
    now.value = new Date();
  }, 30000);

  onBeforeUnmount(() => {
    clearInterval(interval);
  });
});

const viewTitle = computed(() => {
  if (view.value === "month") {
    return "month";
  }
  else if (view.value === "week") {
    const start = startOfWeek(currentDate.value, { weekStartsOn: 0 });
    const end = endOfWeek(currentDate.value, { weekStartsOn: 0 });
    if (isSameMonth(start, end)) {
      return "week-same-month";
    }
    else {
      return "week-different-months";
    }
  }
  else if (view.value === "day") {
    return "day";
  }
  else if (view.value === "agenda") {
    const start = currentDate.value;
    const end = addDays(currentDate.value, 30 - 1);
    if (isSameMonth(start, end)) {
      return "agenda-same-month";
    }
    else {
      return "agenda-different-months";
    }
  }
  return "month";
});

const items: DropdownMenuItem[][] = [
  [
    {
      label: "Month",
      icon: "i-lucide-calendar-days",
      onSelect: () => emit("viewChange", "month"),
    },
    {
      label: "Week",
      icon: "i-lucide-calendar-range",
      onSelect: () => {
        emit("viewChange", "week");
        emit("dateChange", getStableDate());
      },
    },
    {
      label: "Day",
      icon: "i-lucide-calendar-1",
      onSelect: () => emit("viewChange", "day"),
    },
    {
      label: "Agenda",
      icon: "i-lucide-list",
      onSelect: () => emit("viewChange", "agenda"),
    },
  ],
];

function handlePrevious() {
  emit("previous");
}

function handleNext() {
  emit("next");
}

function handleToday() {
  emit("today");
}
</script>

<template>
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2" :class="className">
    <div class="flex sm:flex-col max-sm:items-center justify-between gap-1.5">
      <div class="flex items-center gap-3">
        <h1 class="font-bold text-5xl text-highlighted">
          <NuxtTime
            :datetime="now"
            hour="numeric"
            minute="2-digit"
            :hour12="true"
          />
        </h1>
        <!-- Weather Display -->
        <WeatherDisplay />
      </div>
      <div class="text-base text-muted">
        <NuxtTime
          :datetime="now"
          weekday="long"
          month="long"
          day="numeric"
        />
      </div>
    </div>

    <div v-if="showNavigation" class="flex items-center justify-center flex-1">
      <h2 class="font-semibold text-2xl text-highlighted">
        <NuxtTime
          v-if="viewTitle === 'month'"
          :datetime="currentDate"
          month="long"
          year="numeric"
        />
        <NuxtTime
          v-else-if="viewTitle === 'week-same-month'"
          :datetime="startOfWeek(currentDate, { weekStartsOn: 0 })"
          month="long"
          year="numeric"
        />
        <span v-else-if="viewTitle === 'week-different-months'">
          <NuxtTime
            :datetime="startOfWeek(currentDate, { weekStartsOn: 0 })"
            month="short"
          /> -
          <NuxtTime
            :datetime="endOfWeek(currentDate, { weekStartsOn: 0 })"
            month="short"
            year="numeric"
          />
        </span>
        <NuxtTime
          v-else-if="viewTitle === 'day'"
          :datetime="currentDate"
          month="long"
          day="numeric"
          year="numeric"
        />
        <NuxtTime
          v-else-if="viewTitle === 'agenda-same-month'"
          :datetime="currentDate"
          month="long"
          year="numeric"
        />
        <span v-else-if="viewTitle === 'agenda-different-months'">
          <NuxtTime
            :datetime="currentDate"
            month="short"
          /> -
          <NuxtTime
            :datetime="addDays(currentDate, 30 - 1)"
            month="short"
            year="numeric"
          />
        </span>
        <NuxtTime
          v-else
          :datetime="currentDate"
          month="long"
          year="numeric"
        />
      </h2>
    </div>

    <div v-if="showNavigation" class="flex items-center justify-between gap-2">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center sm:gap-2 max-sm:order-1">
          <UButton
            icon="i-lucide-chevron-left"
            color="neutral"
            variant="ghost"
            size="xl"
            aria-label="Previous"
            @click="handlePrevious"
          />
          <UButton
            icon="i-lucide-chevron-right"
            color="neutral"
            variant="ghost"
            size="xl"
            aria-label="Next"
            @click="handleNext"
          />
        </div>
        <UButton
          color="primary"
          size="xl"
          @click="handleToday"
        >
          Today
        </UButton>
      </div>
      <div v-if="showViewSelector" class="flex items-center justify-between gap-2">
        <UDropdownMenu :items="items">
          <UButton
            color="neutral"
            variant="outline"
            size="xl"
            trailing-icon="i-lucide-chevron-down"
          >
            <span class="capitalize">{{ view }}</span>
          </UButton>
        </UDropdownMenu>
      </div>
      <div v-if="showExport" class="flex items-center">
        <UButton
          icon="i-lucide-download"
          color="neutral"
          variant="ghost"
          size="xl"
          aria-label="Export calendar to ICS"
          :loading="isExporting"
          @click="handleExport"
        />
      </div>
    </div>

    <!-- User Filter Badges -->
    <div v-if="showUserFilter && users && users.length > 0" class="flex items-center gap-2 mt-2 sm:mt-0">
      <div class="flex items-center gap-1 flex-wrap">
        <button
          v-for="user in users"
          :key="user.id"
          type="button"
          class="flex items-center gap-1.5 px-2 py-1 rounded-full text-sm font-medium transition-all border-2"
          :class="isUserSelected(user.id)
            ? 'opacity-100 shadow-sm'
            : 'opacity-40 hover:opacity-70'"
          :style="{
            backgroundColor: isUserSelected(user.id) ? `${user.color || '#22d3ee'}20` : 'transparent',
            borderColor: user.color || '#22d3ee',
            color: user.color || '#22d3ee',
          }"
          :aria-label="`Filter by ${user.name}`"
          :aria-pressed="isUserSelected(user.id)"
          @click="toggleUserFilter(user.id)"
        >
          <UAvatar
            :src="user.avatar || undefined"
            :alt="user.name"
            size="xs"
            :style="{ backgroundColor: user.color || '#22d3ee' }"
          />
          <span>{{ user.name }}</span>
        </button>
        <button
          v-if="selectedUsers.length > 0"
          type="button"
          class="text-xs text-muted hover:text-highlighted underline ml-1"
          aria-label="Clear user filter"
          @click="clearUserFilter"
        >
          Clear
        </button>
      </div>
    </div>
  </div>
</template>
