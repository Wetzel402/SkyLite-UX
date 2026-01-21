<template>
  <div class="relative w-full h-screen overflow-hidden bg-black">
    <!-- Photo Background with Ken Burns Effect -->
    <div v-if="currentPhoto" class="absolute inset-0">
      <img
        :src="getPhotoUrl(currentPhoto.url)"
        :alt="currentPhoto.filename"
        class="w-full h-full object-cover transition-all duration-1000"
        :class="{ 'ken-burns': homeSettings?.kenBurnsIntensity && homeSettings.kenBurnsIntensity > 0 }"
        :style="kenBurnsStyle"
      />
    </div>

    <!-- Fallback background if no photos -->
    <div v-else class="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-black" />

    <!-- No Albums Selected Message -->
    <div
      v-if="!currentPhoto && homeSettings?.photosEnabled"
      class="absolute inset-0 flex items-center justify-center"
    >
      <div class="text-white text-center">
        <h2 class="text-3xl mb-4">No Photos Selected</h2>
        <p class="text-lg mb-6">Select photos in Settings to display in your slideshow</p>
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
        <div v-if="homeSettings?.clockEnabled" class="text-white bg-black/30 backdrop-blur-sm rounded-lg p-4">
          <div class="text-6xl font-light">{{ currentTime }}</div>
          <div class="text-2xl mt-2">{{ currentDate }}</div>
        </div>

        <!-- Weather Widget -->
        <NuxtLink
          v-if="homeSettings?.weatherEnabled && weather"
          to="/settings"
          class="text-white text-right bg-black/30 backdrop-blur-sm hover:bg-black/40 rounded-lg p-4 transition-colors cursor-pointer block"
        >
          <div class="text-4xl">{{ weatherIcon }}</div>
          <div class="text-xl mt-2">{{ temperature }}</div>
          <div class="text-sm opacity-80">{{ weather.description }}</div>

          <!-- Weekly Forecast -->
          <div v-if="weather.daily" class="mt-6 flex gap-4 justify-end">
            <div
              v-for="(day, index) in weather.daily.slice(1, 6)"
              :key="day.date"
              class="flex flex-col items-center"
            >
              <div class="text-sm opacity-70 mb-1">{{ getDayName(day.date, index + 1) }}</div>
              <div class="text-3xl my-2">{{ getWeatherIconForCode(day.weatherCode) }}</div>
              <div class="text-base opacity-90 font-medium">{{ day.tempMax }}°</div>
            </div>
          </div>
        </NuxtLink>
      </div>

      <!-- Middle: Today's Menu Widget (left side) -->
      <div class="flex-1 flex items-center">
        <!-- Today's Menu Widget (shows all meals with icons) -->
        <NuxtLink
          v-if="homeSettings?.mealsEnabled && todaysMenu.length > 0"
          to="/mealPlanner"
          class="text-white bg-black/30 backdrop-blur-sm hover:bg-black/40 rounded-lg p-4 transition-colors cursor-pointer block"
        >
          <h3 class="text-lg font-semibold mb-3">Today's Menu</h3>
          <div class="flex gap-6 justify-start">
            <div
              v-for="meal in todaysMenu"
              :key="meal.id"
              class="flex flex-col items-center"
            >
              <div class="text-3xl mb-1">{{ getMealIcon(meal.mealType) }}</div>
              <div class="text-xs opacity-60 mb-1">{{ meal.mealType }}</div>
              <div class="text-sm opacity-80">{{ meal.name }}</div>
            </div>
          </div>
        </NuxtLink>

        <!-- Fallback: Show "No meals planned" if meals enabled but empty -->
        <div
          v-else-if="homeSettings?.mealsEnabled && todaysMenu.length === 0"
          class="text-white bg-black/30 backdrop-blur-sm rounded-lg p-4"
        >
          <h3 class="text-lg font-semibold mb-2">Today's Menu</h3>
          <p class="text-sm opacity-60">No meals planned for today</p>
        </div>
      </div>

      <!-- Bottom Row: Upcoming Events & Todos -->
      <div class="grid grid-cols-2 gap-8">
        <!-- Events Widget -->
        <NuxtLink
          v-if="homeSettings?.eventsEnabled"
          to="/calendar"
          class="text-white bg-black/30 backdrop-blur-sm hover:bg-black/40 rounded-lg p-4 transition-colors cursor-pointer block"
        >
          <h2 class="text-2xl font-semibold mb-4">Upcoming Events</h2>
          <div v-if="upcomingEvents.length > 0" class="space-y-2">
            <div v-for="event in upcomingEvents.slice(0, 5)" :key="event.id" class="flex items-start space-x-2">
              <div class="text-sm opacity-80">{{ formatEventTime(event.start) }}</div>
              <div class="text-sm">{{ event.title }}</div>
            </div>
          </div>
          <div v-else class="text-sm opacity-60">No upcoming events</div>
        </NuxtLink>

        <!-- Todos Widget -->
        <NuxtLink
          v-if="homeSettings?.todosEnabled"
          to="/toDoLists"
          class="text-white text-right bg-black/30 backdrop-blur-sm hover:bg-black/40 rounded-lg p-4 transition-colors cursor-pointer block"
        >
          <h2 class="text-2xl font-semibold mb-4">Today's Tasks</h2>
          <div v-if="todaysTasks.length > 0" class="space-y-2">
            <div v-for="task in todaysTasks.slice(0, 5)" :key="task.id" class="flex items-start justify-end space-x-2">
              <div class="text-sm">{{ task.title }}</div>
            </div>
          </div>
          <div v-else class="text-sm opacity-60">No tasks for today</div>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CalendarEvent } from "~/types/calendar";

const { photos, fetchPhotos, getPhotoUrl } = usePhotos();
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
const todaysTasks = ref<Array<{ id: string; title: string }>>([]);
const todaysMeal = ref<string | null>(null);
const todaysMenu = ref<Array<{ id: string; name: string; mealType: string }>>([]);

const currentPhoto = computed(() => photos.value[currentPhotoIndex.value]);

const kenBurnsStyle = computed(() => {
  if (!homeSettings.value?.kenBurnsIntensity) return {};
  const intensity = homeSettings.value.kenBurnsIntensity;
  return {
    animationDuration: `${20 / intensity}s`,
  };
});

const weatherIcon = computed(() => {
  if (!weather.value) return "⛅";

  const code = weather.value.code;
  // WMO Weather interpretation codes
  if (code === 0) return "☀️";
  if (code <= 3) return "⛅";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "🌨️";
  if (code <= 82) return "🌧️";
  if (code <= 86) return "🌨️";
  return "⛈️";
});

const temperature = computed(() => {
  if (!weather.value) return "";
  const temp = weather.value.temperature;
  const unit = homeSettings.value?.temperatureUnit === "fahrenheit" ? "°F" : "°C";
  return `${Math.round(temp)}${unit}`;
});

// Helper function to get weather icon for forecast
const getWeatherIconForCode = (code: number): string => {
  if (code === 0) return "☀️";
  if (code <= 3) return "⛅";
  if (code >= 45 && code <= 48) return "🌫️";
  if (code >= 51 && code <= 67) return "🌧️";
  if (code >= 71 && code <= 77) return "🌨️";
  if (code >= 80 && code <= 86) return "🌧️";
  if (code >= 95) return "⛈️";
  return "⛅";
};

// Helper function to get day name from date
const getDayName = (dateStr: string, daysFromNow: number): string => {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const date = new Date(dateStr);
  return days[date.getDay()];
};

// Fetch photos and settings on mount
onMounted(async () => {
  await Promise.all([
    fetchPhotos(),
    fetchHomeSettings(),
  ]);

  startSlideshow();
  updateClock();
  setInterval(updateClock, 1000);

  // Fetch weather if enabled
  if (homeSettings.value?.weatherEnabled && homeSettings.value.latitude && homeSettings.value.longitude) {
    await fetchWeather();
    setInterval(fetchWeather, 600000); // Update every 10 minutes
  }

  // Fetch upcoming events
  if (homeSettings.value?.eventsEnabled) {
    await fetchUpcomingEvents();
    setInterval(fetchUpcomingEvents, 300000); // Update every 5 minutes
  }

  // Fetch today's tasks
  if (homeSettings.value?.todosEnabled) {
    await fetchTodaysTasks();
    setInterval(fetchTodaysTasks, 300000); // Update every 5 minutes
  }

  // Fetch today's menu (replaces single meal)
  if (homeSettings.value?.mealsEnabled) {
    await fetchTodaysMenu();
    setInterval(fetchTodaysMenu, 300000); // Update every 5 minutes
  }
});

const startSlideshow = () => {
  if (!homeSettings.value?.photosEnabled || photos.value.length === 0) {
    return;
  }

  const transitionSpeed = (homeSettings.value?.photoTransitionSpeed || 10000);

  setInterval(() => {
    currentPhotoIndex.value = (currentPhotoIndex.value + 1) % photos.value.length;
  }, transitionSpeed);
};

const updateClock = () => {
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
};

const fetchWeather = async () => {
  if (!homeSettings.value?.latitude || !homeSettings.value?.longitude) return;

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
    console.error("Failed to fetch weather:", error);
  }
};

const fetchUpcomingEvents = async () => {
  try {
    // First, get the Google Calendar integration ID
    const integrations = await $fetch<any[]>("/api/integrations");
    const googleCalendarIntegration = integrations.find(
      (i: any) => i.type === "calendar" && i.service === "google" && i.enabled
    );

    if (!googleCalendarIntegration) {
      upcomingEvents.value = [];
      return;
    }

    // Fetch events from Google Calendar
    const response = await $fetch<{ events: CalendarEvent[] }>(
      `/api/integrations/google_calendar/events?integrationId=${googleCalendarIntegration.id}`
    );

    const now = new Date();
    const upcoming = response.events
      .filter(event => new Date(event.start) > now)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    upcomingEvents.value = upcoming;
  }
  catch (error) {
    console.error("Failed to fetch events:", error);
    upcomingEvents.value = [];
  }
};

const fetchTodaysTasks = async () => {
  try {
    // Fetch all incomplete todos
    const response = await $fetch<any[]>("/api/todos");

    // Filter for today's tasks or tasks without due dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const filtered = response
      .filter((todo: any) => {
        if (!todo.completed) {
          // Include tasks with no due date or tasks due today
          if (!todo.dueDate) return true;
          const dueDate = new Date(todo.dueDate);
          return dueDate >= today && dueDate < tomorrow;
        }
        return false;
      })
      .slice(0, 5); // Limit to 5 tasks

    todaysTasks.value = filtered;
  }
  catch (error) {
    console.error("Failed to fetch tasks:", error);
  }
};

const fetchTodaysMeal = async () => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Fetch meals for today
    const response = await $fetch<any[]>(`/api/meals/byDateRange`, {
      query: {
        startDate: today,
        endDate: today,
      },
    });

    // Get dinner meal if exists
    const dinner = response.find((meal: any) => meal.mealType === 'DINNER');
    todaysMeal.value = dinner?.name || null;
  }
  catch (error) {
    console.error("Failed to fetch meal:", error);
  }
};

const fetchTodaysMenu = async () => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Fetch all meals for today
    const response = await $fetch<any[]>(`/api/meals/byDateRange`, {
      query: {
        startDate: today,
        endDate: today,
      },
    });

    // Sort by meal type order: BREAKFAST, LUNCH, DINNER
    const mealTypeOrder: Record<string, number> = { BREAKFAST: 0, LUNCH: 1, DINNER: 2 };
    todaysMenu.value = response.sort((a: any, b: any) =>
      (mealTypeOrder[a.mealType] ?? 999) - (mealTypeOrder[b.mealType] ?? 999)
    );
  }
  catch (error) {
    console.error("Failed to fetch today's menu:", error);
  }
};

const getMealIcon = (mealType: string) => {
  const icons: Record<string, string> = {
    BREAKFAST: '🍳',
    LUNCH: '🥗',
    DINNER: '🍽️',
  };
  return icons[mealType] || '🍴';
};

const formatEventTime = (dateString: string | Date) => {
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
};
</script>

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
