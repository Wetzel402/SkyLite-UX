<script setup lang="ts">
// Screensaver page - displays photos full-screen and dismisses on touch

const { deactivateScreensaver } = useScreensaver();

// Placeholder photos for demo - in production these would come from Google Photos API
const photos = ref<string[]>([
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1920&q=80",
  "https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=1920&q=80",
  "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1920&q=80",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=80",
]);

const currentPhotoIndex = ref(0);
const isTransitioning = ref(false);
const displayDuration = 8000; // 8 seconds per photo
let slideInterval: ReturnType<typeof setInterval> | null = null;

// Current time for clock display
const currentTime = ref(new Date());
let timeInterval: ReturnType<typeof setInterval> | null = null;

const currentPhoto = computed(() => photos.value[currentPhotoIndex.value]);

const formattedTime = computed(() => {
  return currentTime.value.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
});

const formattedDate = computed(() => {
  return currentTime.value.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
});

function nextPhoto() {
  if (photos.value.length <= 1)
    return;

  isTransitioning.value = true;
  setTimeout(() => {
    currentPhotoIndex.value = (currentPhotoIndex.value + 1) % photos.value.length;
    isTransitioning.value = false;
  }, 500); // Match CSS transition duration
}

function handleDismiss() {
  // Clean up intervals
  if (slideInterval) {
    clearInterval(slideInterval);
    slideInterval = null;
  }
  if (timeInterval) {
    clearInterval(timeInterval);
    timeInterval = null;
  }
  // Deactivate screensaver and navigate to calendar
  deactivateScreensaver();
}

onMounted(() => {
  // Start photo slideshow
  slideInterval = setInterval(nextPhoto, displayDuration);

  // Start clock updates
  timeInterval = setInterval(() => {
    currentTime.value = new Date();
  }, 1000);
});

onUnmounted(() => {
  if (slideInterval) {
    clearInterval(slideInterval);
  }
  if (timeInterval) {
    clearInterval(timeInterval);
  }
});

// Define page meta to use screensaver layout (no sidebar)
definePageMeta({
  layout: "screensaver",
});
</script>

<template>
  <div
    class="fixed inset-0 z-50 bg-black cursor-pointer"
    role="button"
    tabindex="0"
    aria-label="Touch anywhere to exit screensaver"
    @click="handleDismiss"
    @touchstart.prevent="handleDismiss"
    @keydown.escape="handleDismiss"
    @keydown.space="handleDismiss"
    @keydown.enter="handleDismiss"
  >
    <!-- Photo background -->
    <div
      class="absolute inset-0 bg-cover bg-center transition-opacity duration-500"
      :class="{ 'opacity-0': isTransitioning, 'opacity-100': !isTransitioning }"
      :style="{ backgroundImage: `url(${currentPhoto})` }"
    />

    <!-- Dark overlay for better text readability -->
    <div class="absolute inset-0 bg-black/20" />

    <!-- Clock overlay - positioned bottom-right by default -->
    <div class="absolute bottom-8 right-8 text-white text-right drop-shadow-lg">
      <div class="text-6xl font-light tracking-wide">
        {{ formattedTime }}
      </div>
      <div class="text-xl font-light opacity-90 mt-1">
        {{ formattedDate }}
      </div>
    </div>

    <!-- Hint text -->
    <div class="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white/50 text-sm">
      Touch anywhere to return to calendar
    </div>
  </div>
</template>
