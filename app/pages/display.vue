<script setup lang="ts">
// Kiosk Mode - Family Calendar Display
// Clean, touch-friendly wall display view for families

const { $config } = useNuxtApp()
const route = useRoute()

// Check if kiosk mode is enabled
const isKioskModeEnabled = computed(() => {
  return process.env.ENABLE_KIOSK_MODE === 'true' || $config.public.enableKioskMode === true
})

// Redirect to dashboard if kiosk mode is disabled
if (!isKioskModeEnabled.value) {
  await navigateTo('/')
}

// Auto-refresh every 60 seconds
const refreshInterval = ref<NodeJS.Timeout | null>(null)

onMounted(() => {
  // Set up auto-refresh
  refreshInterval.value = setInterval(() => {
    // Trigger a soft refresh of the page
    window.location.reload()
  }, 60000) // 60 seconds
})

onUnmounted(() => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
  }
})

// Current date/time display
const currentDateTime = ref(new Date())
const updateDateTime = () => {
  currentDateTime.value = new Date()
}

// Update time every second
onMounted(() => {
  const timeInterval = setInterval(updateDateTime, 1000)
  onUnmounted(() => clearInterval(timeInterval))
})

// Format date/time for display
const formattedDate = computed(() => {
  return currentDateTime.value.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
})

const formattedTime = computed(() => {
  return currentDateTime.value.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
})
</script>

<template>
  <div class="kiosk-mode min-h-screen bg-gray-50">
    <!-- Header with date/time -->
    <div class="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
      <div class="flex justify-between items-center">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">{{ formattedDate }}</h1>
          <p class="text-lg text-gray-600">{{ formattedTime }}</p>
        </div>
        <div class="text-right">
          <p class="text-sm text-gray-500">Family Calendar</p>
          <p class="text-xs text-gray-400">Auto-refresh: 60s</p>
        </div>
      </div>
    </div>

    <!-- Main calendar display -->
    <div class="flex-1 p-6">
      <KioskCalendarBoard />
    </div>

    <!-- Footer with refresh indicator -->
    <div class="bg-gray-100 px-6 py-2 text-center">
      <p class="text-xs text-gray-500">
        Last updated: {{ currentDateTime.toLocaleTimeString() }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.kiosk-mode {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* Hide scrollbars for clean kiosk display */
.kiosk-mode * {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.kiosk-mode *::-webkit-scrollbar {
  display: none;
}

/* Touch-friendly sizing */
@media (max-width: 768px) {
  .kiosk-mode {
    font-size: 16px; /* Prevent zoom on iOS */
  }
}
</style>
