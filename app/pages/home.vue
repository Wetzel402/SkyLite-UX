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
        <div v-if="homeSettings?.clockEnabled" class="text-white">
          <div class="text-6xl font-light">{{ currentTime }}</div>
          <div class="text-2xl mt-2">{{ currentDate }}</div>
        </div>

        <!-- Weather Widget -->
        <div v-if="homeSettings?.weatherEnabled && weather" class="text-white text-right">
          <div class="text-4xl">{{ weatherIcon }}</div>
          <div class="text-xl mt-2">{{ temperature }}</div>
          <div class="text-sm opacity-80">{{ weather.description }}</div>
        </div>
      </div>

      <!-- Bottom Row: Upcoming Events & Todos -->
      <div class="flex-1" />
      <div class="grid grid-cols-2 gap-8">
        <!-- Events Widget -->
        <div v-if="homeSettings?.eventsEnabled" class="text-white">
          <h2 class="text-2xl font-semibold mb-4">Upcoming Events</h2>
          <div v-if="upcomingEvents.length > 0" class="space-y-2">
            <div v-for="event in upcomingEvents.slice(0, 5)" :key="event.id" class="flex items-start space-x-2">
              <div class="text-sm opacity-80">{{ formatEventTime(event.start) }}</div>
              <div class="text-sm">{{ event.title }}</div>
            </div>
          </div>
          <div v-else class="text-sm opacity-60">No upcoming events</div>
        </div>

        <!-- Todos Widget -->
        <div v-if="homeSettings?.todosEnabled" class="text-white">
          <h2 class="text-2xl font-semibold mb-4">Today's Tasks</h2>
          <div v-if="todaysTasks.length > 0" class="space-y-2">
            <div v-for="task in todaysTasks.slice(0, 5)" :key="task.id" class="flex items-start space-x-2">
              <div class="text-sm">{{ task.title }}</div>
            </div>
          </div>
          <div v-else class="text-sm opacity-60">No tasks for today</div>
        </div>
      </div>

      <!-- Meals Widget (bottom center) -->
      <div v-if="homeSettings?.mealsEnabled && todaysMeal" class="mt-4 text-white text-center">
        <div class="text-lg opacity-80">Today's Dinner</div>
        <div class="text-2xl font-semibold">{{ todaysMeal }}</div>
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
const weather = ref<{ temperature: number; description: string; code: number } | null>(null);
const upcomingEvents = ref<CalendarEvent[]>([]);
const todaysTasks = ref<Array<{ id: string; title: string }>>([]);
const todaysMeal = ref<string | null>(null);

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

  // Fetch today's meal
  if (homeSettings.value?.mealsEnabled) {
    await fetchTodaysMeal();
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
    };
  }
  catch (error) {
    console.error("Failed to fetch weather:", error);
  }
};

const fetchUpcomingEvents = async () => {
  try {
    const response = await $fetch<CalendarEvent[]>("/api/calendar-events");
    const now = new Date();
    const upcoming = response
      .filter(event => new Date(event.start) > now)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    upcomingEvents.value = upcoming;
  }
  catch (error) {
    console.error("Failed to fetch events:", error);
  }
};

const fetchTodaysTasks = async () => {
  try {
    // This would need to be implemented based on your todos API
    // For now, we'll leave it empty
    todaysTasks.value = [];
  }
  catch (error) {
    console.error("Failed to fetch tasks:", error);
  }
};

const fetchTodaysMeal = async () => {
  try {
    // This would need to be implemented based on your meal plans API
    // For now, we'll leave it null
    todaysMeal.value = null;
  }
  catch (error) {
    console.error("Failed to fetch meal:", error);
  }
};

const formatEventTime = (dateString: string | Date) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
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
