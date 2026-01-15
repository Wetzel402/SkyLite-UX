// Weather composable for fetching and caching weather data

export type CurrentWeather = {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  condition: string;
  icon: string;
  isDay: boolean;
  units: "fahrenheit" | "celsius";
  location: { lat: number; lon: number };
  fetchedAt: string;
};

export type HourlyForecast = {
  time: string;
  hour: number;
  temperature: number;
  condition: string;
  icon: string;
  precipProbability: number;
};

export type DailyForecast = {
  date: string;
  dayName: string;
  high: number;
  low: number;
  condition: string;
  icon: string;
  precipProbability: number;
  uvIndex: number;
  windSpeed: number;
};

export type WeatherForecast = {
  hourly: HourlyForecast[];
  daily: DailyForecast[];
  units: "fahrenheit" | "celsius";
  location: { lat: number; lon: number };
  fetchedAt: string;
};

// Shared state
const currentWeather = ref<CurrentWeather | null>(null);
const forecast = ref<WeatherForecast | null>(null);
const isLoading = ref(false);
const error = ref<string | null>(null);
const lastFetch = ref<Date | null>(null);

// Cache duration in milliseconds (30 minutes)
const CACHE_DURATION = 30 * 60 * 1000;

export function useWeather() {
  const fetchCurrentWeather = async (options?: { lat?: number; lon?: number; units?: string }) => {
    // Check if we have cached data that's still valid
    if (currentWeather.value && lastFetch.value) {
      const elapsed = Date.now() - lastFetch.value.getTime();
      if (elapsed < CACHE_DURATION) {
        return currentWeather.value;
      }
    }

    isLoading.value = true;
    error.value = null;

    try {
      const data = await $fetch<CurrentWeather>("/api/weather/current", {
        query: {
          lat: options?.lat,
          lon: options?.lon,
          units: options?.units,
        },
      });
      currentWeather.value = data;
      lastFetch.value = new Date();
      return data;
    }
    catch (err: unknown) {
      const fetchError = err as { data?: { message?: string } };
      error.value = fetchError.data?.message || "Failed to fetch weather";
      return null;
    }
    finally {
      isLoading.value = false;
    }
  };

  const fetchForecast = async (options?: { lat?: number; lon?: number; units?: string }) => {
    isLoading.value = true;
    error.value = null;

    try {
      const data = await $fetch<WeatherForecast>("/api/weather/forecast", {
        query: {
          lat: options?.lat,
          lon: options?.lon,
          units: options?.units,
        },
      });
      forecast.value = data;
      return data;
    }
    catch (err: unknown) {
      const fetchError = err as { data?: { message?: string } };
      error.value = fetchError.data?.message || "Failed to fetch forecast";
      return null;
    }
    finally {
      isLoading.value = false;
    }
  };

  const refresh = async () => {
    lastFetch.value = null;
    await fetchCurrentWeather();
    await fetchForecast();
  };

  // Format temperature display
  const formatTemperature = (temp: number, units?: "fahrenheit" | "celsius") => {
    const unit = units || currentWeather.value?.units || "fahrenheit";
    return `${temp}°${unit === "fahrenheit" ? "F" : "C"}`;
  };

  return {
    currentWeather: readonly(currentWeather),
    forecast: readonly(forecast),
    isLoading: readonly(isLoading),
    error: readonly(error),
    fetchCurrentWeather,
    fetchForecast,
    refresh,
    formatTemperature,
  };
}
