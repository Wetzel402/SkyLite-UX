<script setup lang="ts">
const { currentWeather, forecast, isLoading, error, fetchCurrentWeather, fetchForecast, formatTemperature } = useWeather();

const showForecastPopup = ref(false);

// Fetch weather on mount
onMounted(async () => {
  await fetchCurrentWeather();
});

// Fetch full forecast when popup opens
async function openForecast() {
  showForecastPopup.value = true;
  if (!forecast.value) {
    await fetchForecast();
  }
}

function closeForecast() {
  showForecastPopup.value = false;
}

// Get UV index severity
function getUVSeverity(uv: number): { label: string; color: string } {
  if (uv <= 2)
    return { label: "Low", color: "text-success" };
  if (uv <= 5)
    return { label: "Moderate", color: "text-warning" };
  if (uv <= 7)
    return { label: "High", color: "text-orange-500" };
  if (uv <= 10)
    return { label: "Very High", color: "text-error" };
  return { label: "Extreme", color: "text-purple-500" };
}
</script>

<template>
  <div class="flex items-center">
    <!-- Weather Button -->
    <button
      type="button"
      class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
      :class="{ 'opacity-50': isLoading }"
      :disabled="isLoading"
      aria-label="Show weather forecast"
      @click="openForecast"
    >
      <template v-if="currentWeather">
        <UIcon
          :name="currentWeather.icon"
          class="w-7 h-7 text-primary"
        />
        <span class="text-xl font-semibold text-highlighted">
          {{ formatTemperature(currentWeather.temperature) }}
        </span>
      </template>
      <template v-else-if="isLoading">
        <UIcon name="i-lucide-loader-2" class="w-6 h-6 animate-spin text-muted" />
      </template>
      <template v-else-if="error">
        <UIcon name="i-lucide-cloud-off" class="w-6 h-6 text-muted" />
        <span class="text-sm text-muted">--°F</span>
      </template>
    </button>

    <!-- Forecast Popup -->
    <UModal v-model:open="showForecastPopup">
      <template #content>
        <UCard class="w-full max-w-[600px] mx-4 max-h-[80vh] overflow-hidden">
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <UIcon
                  v-if="currentWeather"
                  :name="currentWeather.icon"
                  class="w-8 h-8 text-primary"
                />
                <div>
                  <h3 class="text-xl font-semibold text-highlighted">
                    Weather Forecast
                  </h3>
                  <p v-if="currentWeather" class="text-sm text-muted">
                    {{ currentWeather.condition }}
                  </p>
                </div>
              </div>
              <UButton
                icon="i-lucide-x"
                variant="ghost"
                color="neutral"
                size="sm"
                aria-label="Close"
                @click="closeForecast"
              />
            </div>
          </template>

          <div class="overflow-y-auto max-h-[calc(80vh-120px)]">
            <!-- Loading state -->
            <div v-if="isLoading && !forecast" class="flex items-center justify-center py-8">
              <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-primary" />
              <span class="ml-2 text-muted">Loading forecast...</span>
            </div>

            <!-- Error state -->
            <div v-else-if="error" class="flex flex-col items-center justify-center py-8">
              <UIcon name="i-lucide-cloud-off" class="w-12 h-12 text-muted mb-2" />
              <p class="text-muted">
                {{ error }}
              </p>
            </div>

            <!-- Forecast content -->
            <template v-else-if="currentWeather || forecast">
              <!-- Current Conditions -->
              <div v-if="currentWeather" class="mb-6">
                <div class="flex items-center justify-between bg-primary/5 rounded-lg p-4">
                  <div class="flex items-center gap-4">
                    <div class="text-5xl font-bold text-highlighted">
                      {{ formatTemperature(currentWeather.temperature) }}
                    </div>
                    <div>
                      <div class="text-sm text-muted">
                        Feels like {{ formatTemperature(currentWeather.feelsLike) }}
                      </div>
                      <div class="text-sm text-muted">
                        {{ currentWeather.condition }}
                      </div>
                    </div>
                  </div>
                  <div class="flex flex-col gap-1 text-sm text-muted">
                    <div class="flex items-center gap-1">
                      <UIcon name="i-lucide-droplets" class="w-4 h-4" />
                      {{ currentWeather.humidity }}% humidity
                    </div>
                    <div class="flex items-center gap-1">
                      <UIcon name="i-lucide-wind" class="w-4 h-4" />
                      {{ currentWeather.windSpeed }} mph
                    </div>
                  </div>
                </div>
              </div>

              <!-- Hourly Forecast -->
              <div v-if="forecast?.hourly" class="mb-6">
                <h4 class="text-sm font-semibold text-highlighted mb-3">
                  Hourly Forecast
                </h4>
                <div class="flex overflow-x-auto gap-3 pb-2 scrollbar-thin">
                  <div
                    v-for="hour in forecast.hourly.slice(0, 12)"
                    :key="hour.time"
                    class="flex flex-col items-center min-w-[60px] p-2 rounded-lg bg-neutral-50 dark:bg-neutral-800"
                  >
                    <span class="text-xs text-muted">
                      {{ hour.hour === new Date().getHours() ? 'Now' : `${hour.hour % 12 || 12}${hour.hour >= 12 ? 'PM' : 'AM'}` }}
                    </span>
                    <UIcon :name="hour.icon" class="w-5 h-5 my-1 text-primary" />
                    <span class="text-sm font-medium text-highlighted">
                      {{ hour.temperature }}°
                    </span>
                    <span v-if="hour.precipProbability > 0" class="text-xs text-info">
                      {{ hour.precipProbability }}%
                    </span>
                  </div>
                </div>
              </div>

              <!-- 7-Day Forecast -->
              <div v-if="forecast?.daily">
                <h4 class="text-sm font-semibold text-highlighted mb-3">
                  7-Day Forecast
                </h4>
                <div class="space-y-2">
                  <div
                    v-for="(day, index) in forecast.daily"
                    :key="day.date"
                    class="flex items-center justify-between p-3 rounded-lg"
                    :class="index === 0 ? 'bg-primary/5' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800'"
                  >
                    <div class="flex items-center gap-3 min-w-[100px]">
                      <span class="text-sm font-medium text-highlighted w-10">
                        {{ index === 0 ? 'Today' : day.dayName }}
                      </span>
                      <UIcon :name="day.icon" class="w-5 h-5 text-primary" />
                      <span class="text-xs text-muted hidden sm:inline">
                        {{ day.condition }}
                      </span>
                    </div>
                    <div class="flex items-center gap-4">
                      <span v-if="day.precipProbability > 0" class="text-xs text-info flex items-center gap-1">
                        <UIcon name="i-lucide-droplets" class="w-3 h-3" />
                        {{ day.precipProbability }}%
                      </span>
                      <span :class="getUVSeverity(day.uvIndex).color" class="text-xs hidden sm:inline">
                        UV {{ day.uvIndex }}
                      </span>
                      <div class="flex items-center gap-2 min-w-[80px] justify-end">
                        <span class="font-medium text-highlighted">
                          {{ day.high }}°
                        </span>
                        <span class="text-muted">
                          {{ day.low }}°
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
