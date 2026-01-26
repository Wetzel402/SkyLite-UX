<script setup lang="ts">
type GoogleCalendarInfo = {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  accessRole: string;
  backgroundColor?: string;
  foregroundColor?: string;
};

const props = defineProps<{
  accessToken: string;
  refreshToken: string;
  tokenExpiry: string;
}>();

const emit = defineEmits<{
  (e: "calendarsSelected", calendars: { id: string; summary: string; color?: string }[]): void;
}>();

const calendars = ref<GoogleCalendarInfo[]>([]);
const selectedCalendarIds = ref<string[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

onMounted(async () => {
  await fetchCalendars();
});

async function fetchCalendars() {
  loading.value = true;
  error.value = null;

  try {
    const result = await $fetch<{ calendars: GoogleCalendarInfo[] }>(
      "/api/integrations/google-calendar/calendars",
      {
        query: {
          accessToken: props.accessToken,
          refreshToken: props.refreshToken,
          tokenExpiry: props.tokenExpiry,
        },
      },
    );

    calendars.value = result.calendars;

    // Auto-select primary calendar if exists
    const primaryCalendar = calendars.value.find(cal => cal.primary);
    if (primaryCalendar) {
      selectedCalendarIds.value = [primaryCalendar.id];
    }
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : "Failed to fetch calendars";
  }
  finally {
    loading.value = false;
  }
}

function handleContinue() {
  if (selectedCalendarIds.value.length === 0) {
    error.value = "Please select at least one calendar";
    return;
  }

  const selectedCalendars = calendars.value
    .filter(cal => selectedCalendarIds.value.includes(cal.id))
    .map(cal => ({
      id: cal.id,
      summary: cal.summary,
      color: cal.backgroundColor,
    }));

  emit("calendarsSelected", selectedCalendars);
}

function toggleCalendar(calendarId: string) {
  const index = selectedCalendarIds.value.indexOf(calendarId);
  if (index === -1) {
    selectedCalendarIds.value.push(calendarId);
  }
  else {
    selectedCalendarIds.value.splice(index, 1);
  }
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="block text-sm font-medium text-highlighted mb-2">
        Select Calendars
      </label>
      <p class="text-sm text-muted mb-3">
        Choose which Google Calendars to sync with SkyLite
      </p>
    </div>

    <div
      v-if="error"
      role="alert"
      class="bg-error/10 text-error rounded-md px-3 py-2 text-sm"
    >
      {{ error }}
    </div>

    <div v-if="loading" class="flex items-center justify-center py-8">
      <UIcon name="i-lucide-loader-2" class="animate-spin h-6 w-6 text-muted" />
    </div>

    <div v-else-if="calendars.length > 0" class="space-y-2 max-h-[300px] overflow-y-auto">
      <div
        v-for="calendar in calendars"
        :key="calendar.id"
        class="flex items-start gap-3 p-3 rounded-md hover:bg-muted/5 cursor-pointer"
        @click="toggleCalendar(calendar.id)"
      >
        <UCheckbox
          :model-value="selectedCalendarIds.includes(calendar.id)"
          class="mt-0.5"
        />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-medium">{{ calendar.summary }}</span>
            <UBadge
              v-if="calendar.primary"
              color="primary"
              variant="subtle"
              size="xs"
            >
              Primary
            </UBadge>
          </div>
          <p v-if="calendar.description" class="text-sm text-muted truncate">
            {{ calendar.description }}
          </p>
          <p class="text-xs text-muted mt-1">
            Access: {{ calendar.accessRole }}
          </p>
        </div>
      </div>
    </div>

    <div v-else class="text-center py-8 text-muted">
      No calendars found
    </div>

    <UButton
      color="primary"
      block
      :disabled="loading || selectedCalendarIds.length === 0"
      @click="handleContinue"
    >
      Continue with {{ selectedCalendarIds.length }} calendar{{ selectedCalendarIds.length !== 1 ? 's' : '' }}
    </UButton>
  </div>
</template>
