<script setup lang="ts">
import { consola } from "consola";

import type { CalendarEvent } from "~/types/calendar";

const { photos, fetchPhotos, getPhotoUrl, refreshAlbums } = usePhotos();
const { homeSettings, fetchHomeSettings } = useHomeSettings();

const currentPhotoIndex = ref(0);
const currentTime = ref("");
const currentDate = ref("");
const weather = ref<{
  temperature: number;
  description: string;
  code: number;
  daily?: Array<{
    date: string;
    tempMax: number;
    tempMin: number;
    weatherCode: number;
    weatherDescription: string;
  }>;
} | null>(null);
const upcomingEvents = ref<CalendarEvent[]>([]);
const todaysTasks = ref<Array<{ id: string; title: string; dueDate?: string | Date }>>([]);
const todaysMenu = ref<Array<{ id: string; name: string; mealType: string; dayLabel?: string }>>([]);

// Store interval IDs for cleanup
const intervals = ref<NodeJS.Timeout[]>([]);

const currentPhoto = computed(() => photos.value[currentPhotoIndex.value]);
const imageLoadError = ref(false);
const imageErrorCount = ref(0);
const lastRefreshAttempt = ref<Date | null>(null);

const kenBurnsStyle = computed(() => {
  if (!homeSettings.value?.kenBurnsIntensity)
    return {};
  const intensity = homeSettings.value.kenBurnsIntensity;
  return {
    animationDuration: `${20 / intensity}s`,
  };
});

const weatherIcon = computed(() => {
  if (!weather.value)
    return "⛅";

  const code = weather.value.code;
  // WMO Weather interpretation codes
  if (code === 0)
    return "☀️";
  if (code <= 3)
    return "⛅";
  if (code <= 67)
    return "🌧️";
  if (code <= 77)
    return "🌨️";
  if (code <= 82)
    return "🌧️";
  if (code <= 86)
    return "🌨️";
  return "⛈️";
});

const temperature = computed(() => {
  if (!weather.value)
    return "";
  const temp = weather.value.temperature;
  const unit = homeSettings.value?.temperatureUnit === "fahrenheit" ? "°F" : "°C";
  return `${Math.round(temp)}${unit}`;
});

// Helper function to get weather icon for forecast
function getWeatherIconForCode(code: number): string {
  if (code === 0)
    return "☀️";
  if (code <= 3)
    return "⛅";
  if (code >= 45 && code <= 48)
    return "🌫️";
  if (code >= 51 && code <= 67)
    return "🌧️";
  if (code >= 71 && code <= 77)
    return "🌨️";
  if (code >= 80 && code <= 86)
    return "🌧️";
  if (code >= 95)
    return "⛈️";
  return "⛅";
}

// Helper function to get day name from date
function getDayName(dateStr: string, _daysFromNow: number): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const date = new Date(dateStr);
  return days[date.getDay()] || "Sun";
}

// Fetch photos and settings on mount
onMounted(async () => {
  await Promise.all([
    fetchPhotos(),
    fetchHomeSettings(),
  ]);

  // Refresh album URLs immediately to ensure fresh URLs
  if (homeSettings.value?.photosEnabled && photos.value.length > 0) {
    await refreshAlbums();
  }

  startSlideshow();
  updateClock();
  intervals.value.push(setInterval(updateClock, 1000));

  // Calculate refresh interval in milliseconds (convert hours to ms)
  const refreshIntervalMs = (homeSettings.value?.refreshInterval || 6.0) * 3600000;

  // Fetch weather if enabled
  if (homeSettings.value?.weatherEnabled && homeSettings.value.latitude && homeSettings.value.longitude) {
    await fetchWeather();
    intervals.value.push(setInterval(fetchWeather, refreshIntervalMs));
  }

  // Fetch upcoming events
  if (homeSettings.value?.eventsEnabled) {
    await fetchUpcomingEvents();
    intervals.value.push(setInterval(fetchUpcomingEvents, refreshIntervalMs));
  }

  // Fetch today's tasks
  if (homeSettings.value?.todosEnabled) {
    await fetchTodaysTasks();
    intervals.value.push(setInterval(fetchTodaysTasks, refreshIntervalMs));
  }

  // Fetch today's menu (replaces single meal)
  if (homeSettings.value?.mealsEnabled) {
    await fetchTodaysMenu();
    intervals.value.push(setInterval(fetchTodaysMenu, refreshIntervalMs));
  }

  // Refresh Google Photos album URLs every hour to prevent expiration
  // Google Photos URLs typically expire after ~60 minutes
  if (homeSettings.value?.photosEnabled && photos.value.length > 0) {
    intervals.value.push(setInterval(refreshAlbums, 3600000)); // Refresh every hour
  }
});

// Clear all intervals on unmount
onUnmounted(() => {
  intervals.value.forEach(interval => clearInterval(interval));
});

// Handle image load errors - attempt refresh if multiple images fail
async function handleImageError() {
  consola.error("[Home] Photo failed to load:", currentPhoto.value?.url);
  imageLoadError.value = true;
  imageErrorCount.value++;

  // If multiple consecutive errors and we haven't refreshed recently
  const timeSinceLastRefresh = lastRefreshAttempt.value
    ? Date.now() - lastRefreshAttempt.value.getTime()
    : Infinity;

  if (imageErrorCount.value >= 3 && timeSinceLastRefresh > 60000) {
    consola.warn("[Home] Multiple photo load failures, attempting to refresh album URLs...");
    lastRefreshAttempt.value = new Date();
    imageErrorCount.value = 0; // Reset counter

    try {
      await refreshAlbums();
      consola.success("[Home] Album URLs refreshed after image errors");
    }
    catch (e) {
      consola.error("[Home] Failed to refresh albums after image errors:", e);
    }
  }
}

// Reset error count on successful image load
function handleImageLoad() {
  if (imageLoadError.value) {
    consola.info("[Home] Photo loaded successfully after previous errors");
    imageLoadError.value = false;
  }
  imageErrorCount.value = 0; // Reset error counter on successful load
}

function startSlideshow() {
  if (!homeSettings.value?.photosEnabled || photos.value.length === 0) {
    return;
  }

  const transitionSpeed = (homeSettings.value?.photoTransitionSpeed || 10000);

  intervals.value.push(setInterval(() => {
    const playbackMode = homeSettings.value?.photoPlayback || "sequential";

    if (playbackMode === "random") {
      // Random: Pick a random photo (but not the current one)
      let nextIndex;
      do {
        nextIndex = Math.floor(Math.random() * photos.value.length);
      } while (nextIndex === currentPhotoIndex.value && photos.value.length > 1);
      currentPhotoIndex.value = nextIndex;
    }
    else {
      // Sequential: Increment to next photo
      currentPhotoIndex.value = (currentPhotoIndex.value + 1) % photos.value.length;
    }
  }, transitionSpeed));
}

function updateClock() {
  const now = new Date();
  currentTime.value = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  currentDate.value = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

async function fetchWeather() {
  if (!homeSettings.value?.latitude || !homeSettings.value?.longitude)
    return;

  try {
    const response = await $fetch<{
      temperature: number;
      weatherCode: number;
      weatherDescription: string;
      daily?: Array<{
        date: string;
        tempMax: number;
        tempMin: number;
        weatherCode: number;
        weatherDescription: string;
      }>;
    }>("/api/weather", {
      params: {
        latitude: homeSettings.value.latitude,
        longitude: homeSettings.value.longitude,
        temperatureUnit: homeSettings.value.temperatureUnit || "celsius",
      },
    });

    weather.value = {
      temperature: response.temperature,
      description: response.weatherDescription,
      code: response.weatherCode,
      daily: response.daily,
    };
  }
  catch (error) {
    consola.error("Failed to fetch weather:", error);
  }
}

async function fetchUpcomingEvents() {
  try {
    // Get all enabled Google Calendar integrations (multiple accounts)
    const integrations = await $fetch<any[]>("/api/integrations");
    const googleCalendarIntegrations = integrations.filter(
      (i: any) => i.type === "calendar" && i.service === "google" && i.enabled,
    );

    if (googleCalendarIntegrations.length === 0) {
      upcomingEvents.value = [];
      return;
    }

    // Fetch events from all Google Calendar integrations in parallel
    const eventPromises = googleCalendarIntegrations.map(integration =>
      $fetch<{ events: CalendarEvent[] }>(
        `/api/integrations/google_calendar/events?integrationId=${integration.id}`,
      ).catch((error) => {
        consola.error(`Failed to fetch events from integration ${integration.id}:`, error);
        return { events: [] };
      }),
    );

    const responses = await Promise.all(eventPromises);

    // Merge all events from all integrations
    const allEvents = responses.flatMap(response => response.events);

    // Filter for upcoming events and sort by start time
    const now = new Date();
    const upcoming = allEvents
      .filter(event => new Date(event.start) > now)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    upcomingEvents.value = upcoming;
  }
  catch (error) {
    consola.error("Failed to fetch events:", error);
    upcomingEvents.value = [];
  }
}

async function fetchTodaysTasks() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Fetch local todos and Google Tasks in parallel
    const [todosResult, googleTasksResult] = await Promise.allSettled([
      $fetch<any[]>("/api/todos"),
      $fetch<{ tasks: any[]; error?: string }>("/api/integrations/google_tasks/all-tasks"),
    ]);

    const todos = todosResult.status === "fulfilled" ? todosResult.value : [];

    let googleTasks: any[] = [];
    if (googleTasksResult.status === "fulfilled") {
      googleTasks = googleTasksResult.value.tasks || [];
      if (googleTasksResult.value.error) {
        consola.warn("[Home] Google Tasks returned with error:", googleTasksResult.value.error);
      }
      consola.info(`[Home] Fetched ${googleTasks.length} Google Tasks`);
    }
    else {
      consola.error("[Home] Failed to fetch Google Tasks:", googleTasksResult.reason);
      // Check if it's an auth error
      if (googleTasksResult.reason?.statusCode === 401 || googleTasksResult.reason?.statusCode === 403) {
        consola.error("[Home] Google Tasks authorization expired. User needs to re-authorize.");
      }
    }

    // Merge local todos and Google Tasks
    const allTodos = [
      ...todos.map(todo => ({ ...todo, source: "local" })),
      ...googleTasks
        .filter(task => task.title && task.title.trim())
        .map(task => ({
          id: `google-${task.id}`,
          title: task.title,
          description: task.notes,
          completed: task.status === "completed",
          dueDate: task.due,
          source: "google_tasks",
        })),
    ];

    // Filter for today or no due date
    const filtered = allTodos
      .filter((todo: any) => {
        if (!todo.completed) {
          if (!todo.dueDate)
            return true;

          // Parse the date string and extract UTC date components to avoid timezone issues
          const dueDateObj = new Date(todo.dueDate);
          // Use UTC date components to create a local date for comparison
          const dueDate = new Date(dueDateObj.getUTCFullYear(), dueDateObj.getUTCMonth(), dueDateObj.getUTCDate());

          return dueDate >= today && dueDate < tomorrow;
        }
        return false;
      })
      .slice(0, 5); // Limit to 5 tasks

    todaysTasks.value = filtered;
  }
  catch (error) {
    consola.error("Failed to fetch tasks:", error);
  }
}

async function fetchTodaysMenu() {
  try {
    // Use local date instead of UTC to avoid timezone issues
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const today = `${year}-${month}-${day}`; // YYYY-MM-DD in local timezone

    // Calculate tomorrow's date
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowYear = tomorrow.getFullYear();
    const tomorrowMonth = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const tomorrowDay = String(tomorrow.getDate()).padStart(2, "0");
    const tomorrowStr = `${tomorrowYear}-${tomorrowMonth}-${tomorrowDay}`;

    // Fetch meals for today and tomorrow in one API call
    const response = await $fetch<any[]>(`/api/meals/byDateRange`, {
      query: {
        startDate: today,
        endDate: tomorrowStr,
      },
    });

    // Sort by meal type order: BREAKFAST, LUNCH, DINNER
    const mealTypeOrder: Record<string, number> = { BREAKFAST: 0, LUNCH: 1, DINNER: 2 };

    // Separate today's and tomorrow's meals
    const todayMeals = response.filter((meal: any) => {
      const mealDate = new Date(meal.calculatedDate);
      const mealDateStr = `${mealDate.getFullYear()}-${String(mealDate.getMonth() + 1).padStart(2, "0")}-${String(mealDate.getDate()).padStart(2, "0")}`;
      return mealDateStr === today;
    }).sort((a: any, b: any) =>
      (mealTypeOrder[a.mealType] ?? 999) - (mealTypeOrder[b.mealType] ?? 999),
    );

    const tomorrowMeals = response.filter((meal: any) => {
      const mealDate = new Date(meal.calculatedDate);
      const mealDateStr = `${mealDate.getFullYear()}-${String(mealDate.getMonth() + 1).padStart(2, "0")}-${String(mealDate.getDate()).padStart(2, "0")}`;
      return mealDateStr === tomorrowStr;
    }).sort((a: any, b: any) =>
      (mealTypeOrder[a.mealType] ?? 999) - (mealTypeOrder[b.mealType] ?? 999),
    );

    // Combine with day labels
    todaysMenu.value = [
      ...todayMeals.map((meal: any) => ({ ...meal, dayLabel: "Today" })),
      ...tomorrowMeals.map((meal: any) => ({ ...meal, dayLabel: "Tomorrow" })),
    ];
  }
  catch (error) {
    consola.error("Failed to fetch today's menu:", error);
  }
}

function getMealIcon(mealType: string) {
  const icons: Record<string, string> = {
    BREAKFAST: "🍳",
    LUNCH: "🥗",
    DINNER: "🍽️",
  };
  return icons[mealType] || "🍴";
}

function formatTaskDate(dateString: string | Date) {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Use UTC components to avoid timezone issues with Google Tasks dates
  const taskDate = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

  // Check if task is today
  if (taskDate.getTime() === today.getTime()) {
    return "Today";
  }

  // Check if task is tomorrow
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (taskDate.getTime() === tomorrow.getTime()) {
    return "Tomorrow";
  }

  // Otherwise show the date
  return taskDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatEventTime(dateString: string | Date) {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  // Check if event is today
  if (eventDate.getTime() === today.getTime()) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  // For future events, show date and time
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
</script>

<template>
  <div class="relative w-full h-screen overflow-hidden bg-black">
    <!-- Photo Background with Ken Burns Effect -->
    <div v-if="currentPhoto" class="absolute inset-0">
      <img
        :src="getPhotoUrl(currentPhoto.url, 1920, 1080)"
        :alt="currentPhoto.filename"
        class="w-full h-full object-cover transition-all duration-1000"
        :class="{ 'ken-burns': homeSettings?.kenBurnsIntensity && homeSettings.kenBurnsIntensity > 0 }"
        :style="kenBurnsStyle"
        @load="handleImageLoad"
        @error="handleImageError"
      >
    </div>

    <!-- Fallback background if no photos -->
    <div v-else class="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-black" />

    <!-- No Albums Selected Message -->
    <div
      v-if="!currentPhoto && homeSettings?.photosEnabled"
      class="absolute inset-0 flex items-center justify-center"
    >
      <div class="text-white text-center">
        <h2 class="text-3xl mb-4">
          No Photos Selected
        </h2>
        <p class="text-lg mb-6">
          Select photos in Settings to display in your slideshow
        </p>
        <NuxtLink to="/settings" class="inline-block px-6 py-3 bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
          Go to Settings
        </NuxtLink>
      </div>
    </div>

    <!-- Overlay Gradient for Text Readability -->
    <div class="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/40" />

    <!-- Widget Overlay Layer -->
    <div class="relative z-10 h-full flex flex-col p-8">
      <!-- Top Row: Clock & Weather -->
      <div class="flex justify-between items-start">
        <!-- Clock Widget -->
        <NuxtLink
          v-if="homeSettings?.clockEnabled"
          to="/settings"
          class="text-white bg-black/30 backdrop-blur-sm hover:bg-black/40 rounded-lg p-4 transition-colors cursor-pointer block"
        >
          <div class="text-6xl font-light">
            {{ currentTime }}
          </div>
          <div class="text-2xl mt-2">
            {{ currentDate }}
          </div>
        </NuxtLink>

        <!-- Weather Widget -->
        <NuxtLink
          v-if="homeSettings?.weatherEnabled && weather"
          to="/settings"
          class="text-white text-right bg-black/30 backdrop-blur-sm hover:bg-black/40 rounded-lg p-4 transition-colors cursor-pointer block"
        >
          <div class="text-4xl">
            {{ weatherIcon }}
          </div>
          <div class="text-xl mt-2">
            {{ temperature }}
          </div>
          <div class="text-sm opacity-80">
            {{ weather.description }}
          </div>

          <!-- Weekly Forecast -->
          <div v-if="weather.daily" class="mt-6 flex gap-4 justify-end">
            <div
              v-for="(day, index) in weather.daily.slice(1, 8)"
              :key="day.date"
              class="flex flex-col items-center"
            >
              <div class="text-sm opacity-70 mb-1">
                {{ getDayName(day.date, index + 1) }}
              </div>
              <div class="text-3xl my-2">
                {{ getWeatherIconForCode(day.weatherCode) }}
              </div>
              <div class="text-base opacity-90 font-medium">
                {{ day.tempMax }}°
              </div>
            </div>
          </div>
        </NuxtLink>
      </div>

      <!-- Middle: Menu Widget (left side) -->
      <div class="flex-1 flex items-center">
        <!-- Menu Widget (shows today's and tomorrow's meals) -->
        <NuxtLink
          v-if="homeSettings?.mealsEnabled && todaysMenu.length > 0"
          to="/mealPlanner"
          class="text-white bg-black/30 backdrop-blur-sm hover:bg-black/40 rounded-lg p-4 transition-colors cursor-pointer block"
        >
          <h3 class="text-lg font-semibold mb-3">
            Meal Plan
          </h3>
          <div class="flex flex-col gap-4">
            <!-- Today's Meals -->
            <div v-if="todaysMenu.filter(m => m.dayLabel === 'Today').length > 0">
              <div class="text-xs font-semibold opacity-70 mb-2">
                TODAY
              </div>
              <div class="flex gap-4 justify-start flex-wrap">
                <div
                  v-for="meal in todaysMenu.filter(m => m.dayLabel === 'Today')"
                  :key="meal.id"
                  class="flex flex-col items-center"
                >
                  <div class="text-3xl mb-1">
                    {{ getMealIcon(meal.mealType) }}
                  </div>
                  <div class="text-xs opacity-60 mb-1">
                    {{ meal.mealType }}
                  </div>
                  <div class="text-sm opacity-80">
                    {{ meal.name }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Tomorrow's Meals -->
            <div v-if="todaysMenu.filter(m => m.dayLabel === 'Tomorrow').length > 0">
              <div class="text-xs font-semibold opacity-70 mb-2">
                TOMORROW
              </div>
              <div class="flex gap-4 justify-start flex-wrap">
                <div
                  v-for="meal in todaysMenu.filter(m => m.dayLabel === 'Tomorrow')"
                  :key="meal.id"
                  class="flex flex-col items-center"
                >
                  <div class="text-3xl mb-1">
                    {{ getMealIcon(meal.mealType) }}
                  </div>
                  <div class="text-xs opacity-60 mb-1">
                    {{ meal.mealType }}
                  </div>
                  <div class="text-sm opacity-80">
                    {{ meal.name }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </NuxtLink>

        <!-- Fallback: Show "No meals planned" if meals enabled but empty -->
        <NuxtLink
          v-else-if="homeSettings?.mealsEnabled && todaysMenu.length === 0"
          to="/mealPlanner"
          class="text-white bg-black/30 backdrop-blur-sm hover:bg-black/40 rounded-lg p-4 transition-colors cursor-pointer block"
        >
          <h3 class="text-lg font-semibold mb-2">
            Meal Plan
          </h3>
          <p class="text-sm opacity-60">
            No meals planned for today
          </p>
        </NuxtLink>
      </div>

      <!-- Bottom Row: Upcoming Events & Todos -->
      <div class="grid grid-cols-2 gap-8">
        <!-- Events Widget -->
        <NuxtLink
          v-if="homeSettings?.eventsEnabled"
          to="/calendar"
          class="text-white bg-black/30 backdrop-blur-sm hover:bg-black/40 rounded-lg p-4 transition-colors cursor-pointer block"
        >
          <h2 class="text-2xl font-semibold mb-4">
            Upcoming Events
          </h2>
          <div v-if="upcomingEvents.length > 0" class="space-y-2">
            <div
              v-for="event in upcomingEvents.slice(0, 5)"
              :key="event.id"
              class="flex items-start space-x-2"
            >
              <div class="text-sm opacity-80">
                {{ formatEventTime(event.start) }}
              </div>
              <div class="text-sm">
                {{ event.title }}
              </div>
            </div>
          </div>
          <div v-else class="text-sm opacity-60">
            No upcoming events
          </div>
        </NuxtLink>

        <!-- Todos Widget -->
        <NuxtLink
          v-if="homeSettings?.todosEnabled"
          to="/toDoLists"
          class="text-white text-right bg-black/30 backdrop-blur-sm hover:bg-black/40 rounded-lg p-4 transition-colors cursor-pointer block"
        >
          <h2 class="text-2xl font-semibold mb-4">
            Today's Tasks
          </h2>
          <div v-if="todaysTasks.length > 0" class="space-y-2">
            <div
              v-for="task in todaysTasks.slice(0, 5)"
              :key="task.id"
              class="flex items-start justify-between space-x-3"
            >
              <div class="text-sm flex-1">
                {{ task.title }}
              </div>
              <div v-if="task.dueDate" class="text-xs opacity-70 whitespace-nowrap">
                {{ formatTaskDate(task.dueDate) }}
              </div>
            </div>
          </div>
          <div v-else class="text-sm opacity-60">
            No tasks for today
          </div>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes kenBurns {
  0% {
    transform: scale(1) translate(0, 0);
  }
  100% {
    transform: scale(1.1) translate(-2%, -2%);
  }
}

.ken-burns {
  animation: kenBurns 20s ease-in-out infinite alternate;
}
</style>
