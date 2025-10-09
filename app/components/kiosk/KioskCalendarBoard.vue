<script setup lang="ts">
import type { CalendarEvent } from '~/types/calendar'

// Week view configuration
const weekDays = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
]

// Get current week dates
const getWeekDates = () => {
  const today = new Date()
  const currentDay = today.getDay()
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - currentDay)
  
  const weekDates = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek)
    date.setDate(startOfWeek.getDate() + i)
    weekDates.push(date)
  }
  return weekDates
}

const weekDates = ref(getWeekDates())

// Fetch calendar events for the week
const { data: events, pending, error, refresh } = await useFetch('/api/events/week', {
  default: () => [],
  server: false
})

// Auto-refresh events every 30 seconds
onMounted(() => {
  const interval = setInterval(() => {
    refresh()
  }, 30000)
  
  onUnmounted(() => clearInterval(interval))
})

// Group events by date
const eventsByDate = computed(() => {
  const grouped: Record<string, CalendarEvent[]> = {}
  
  events.value?.forEach(event => {
    const eventDate = new Date(event.start).toDateString()
    if (!grouped[eventDate]) {
      grouped[eventDate] = []
    }
    grouped[eventDate].push(event)
  })
  
  return grouped
})

// Get events for a specific date
const getEventsForDate = (date: Date) => {
  const dateString = date.toDateString()
  return eventsByDate.value[dateString] || []
}

// Format time for display
const formatTime = (dateTime: string) => {
  return new Date(dateTime).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

// Check if date is today
const isToday = (date: Date) => {
  const today = new Date()
  return date.toDateString() === today.toDateString()
}

// Get user color for event
const getUserColor = (event: CalendarEvent) => {
  // Use event color if available, otherwise default colors
  if (event.color) {
    return typeof event.color === 'string' ? event.color : event.color.primary || '#3B82F6'
  }
  return '#3B82F6' // Default blue
}

// Placeholder data for offline testing
const placeholderEvents = [
  {
    id: '1',
    title: 'Morning Meeting',
    start: new Date().toISOString(),
    end: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    allDay: false,
    color: '#EF4444'
  },
  {
    id: '2',
    title: 'Lunch with Family',
    start: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    end: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
    allDay: false,
    color: '#10B981'
  }
]
</script>

<template>
  <div class="kiosk-calendar-board">
    <!-- Loading state -->
    <div v-if="pending" class="flex justify-center items-center h-64">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="text-center py-8">
      <p class="text-red-600 mb-4">Unable to load calendar events</p>
      <button 
        @click="refresh" 
        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Retry
      </button>
    </div>

    <!-- Calendar grid -->
    <div v-else class="calendar-grid">
      <!-- Week header -->
      <div class="week-header grid grid-cols-7 gap-2 mb-4">
        <div 
          v-for="(date, index) in weekDates" 
          :key="index"
          class="day-header text-center p-4 bg-white rounded-lg shadow-sm"
        >
          <div class="text-sm font-medium text-gray-600 mb-1">
            {{ weekDays[index] }}
          </div>
          <div 
            class="text-2xl font-bold"
            :class="isToday(date) ? 'text-blue-600' : 'text-gray-900'"
          >
            {{ date.getDate() }}
          </div>
          <div class="text-xs text-gray-500">
            {{ date.toLocaleDateString('en-US', { month: 'short' }) }}
          </div>
        </div>
      </div>

      <!-- Events grid -->
      <div class="events-grid grid grid-cols-7 gap-2">
        <div 
          v-for="(date, index) in weekDates" 
          :key="index"
          class="day-column bg-white rounded-lg shadow-sm p-3 min-h-[400px]"
        >
          <!-- Day events -->
          <div class="space-y-2">
            <div 
              v-for="event in getEventsForDate(date)" 
              :key="event.id"
              class="event-block p-3 rounded-lg text-white text-sm font-medium shadow-sm"
              :style="{ backgroundColor: getUserColor(event) }"
            >
              <div class="font-semibold truncate">
                {{ event.title }}
              </div>
              <div v-if="!event.allDay" class="text-xs opacity-90 mt-1">
                {{ formatTime(event.start) }}
                <span v-if="event.end"> - {{ formatTime(event.end) }}</span>
              </div>
              <div v-if="event.location" class="text-xs opacity-75 mt-1 truncate">
                📍 {{ event.location }}
              </div>
            </div>

            <!-- No events placeholder -->
            <div 
              v-if="getEventsForDate(date).length === 0"
              class="text-center text-gray-400 py-8"
            >
              <div class="text-4xl mb-2">📅</div>
              <div class="text-sm">No events</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Offline mode indicator -->
    <div v-if="!events || events.length === 0" class="mt-4 text-center">
      <div class="inline-flex items-center px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg">
        <span class="text-sm">📡 Offline mode - Using placeholder data</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.kiosk-calendar-board {
  max-width: 100%;
  overflow-x: auto;
}

.calendar-grid {
  min-width: 100%;
}

.week-header {
  position: sticky;
  top: 0;
  z-index: 10;
}

.day-column {
  transition: all 0.2s ease;
}

.day-column:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.event-block {
  transition: all 0.2s ease;
  cursor: default;
}

.event-block:hover {
  transform: scale(1.02);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

/* Touch-friendly sizing */
@media (max-width: 768px) {
  .day-header {
    padding: 0.75rem;
  }
  
  .day-column {
    min-height: 300px;
  }
  
  .event-block {
    padding: 0.5rem;
    font-size: 0.875rem;
  }
}

/* Large display optimization */
@media (min-width: 1200px) {
  .calendar-grid {
    max-width: 1400px;
    margin: 0 auto;
  }
  
  .day-column {
    min-height: 500px;
  }
}
</style>
