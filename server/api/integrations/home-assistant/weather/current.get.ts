// Home Assistant Weather Integration - Current Weather
// Fetches current weather data from a Home Assistant weather entity

import { consola } from "consola";

type HomeAssistantWeatherState = {
  entity_id: string;
  state: string;
  attributes: {
    temperature: number;
    temperature_unit: string;
    humidity: number;
    wind_speed: number;
    wind_speed_unit: string;
    wind_bearing?: number;
    pressure?: number;
    visibility?: number;
    friendly_name?: string;
  };
  last_changed: string;
  last_updated: string;
};

// Map Home Assistant weather states to icons
const weatherStateToIcon: Record<string, string> = {
  "clear-night": "i-lucide-moon",
  "cloudy": "i-lucide-cloud",
  "exceptional": "i-lucide-alert-triangle",
  "fog": "i-lucide-cloud-fog",
  "hail": "i-lucide-cloud-hail",
  "lightning": "i-lucide-cloud-lightning",
  "lightning-rainy": "i-lucide-cloud-lightning",
  "partlycloudy": "i-lucide-cloud-sun",
  "pouring": "i-lucide-cloud-rain",
  "rainy": "i-lucide-cloud-rain",
  "snowy": "i-lucide-cloud-snow",
  "snowy-rainy": "i-lucide-cloud-snow",
  "sunny": "i-lucide-sun",
  "windy": "i-lucide-wind",
  "windy-variant": "i-lucide-wind",
};

// Map Home Assistant weather states to descriptions
const weatherStateToDescription: Record<string, string> = {
  "clear-night": "Clear night",
  "cloudy": "Cloudy",
  "exceptional": "Exceptional",
  "fog": "Foggy",
  "hail": "Hail",
  "lightning": "Lightning",
  "lightning-rainy": "Thunderstorm",
  "partlycloudy": "Partly cloudy",
  "pouring": "Heavy rain",
  "rainy": "Rainy",
  "snowy": "Snowy",
  "snowy-rainy": "Snow and rain",
  "sunny": "Sunny",
  "windy": "Windy",
  "windy-variant": "Windy",
};

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const baseUrl = query.baseUrl as string;
  const apiKey = query.apiKey as string;
  const entityId = query.entityId as string || "weather.home";

  if (!baseUrl || !apiKey) {
    throw createError({
      statusCode: 400,
      statusMessage: "Home Assistant URL and API key are required",
    });
  }

  try {
    // Fetch the weather entity state from Home Assistant
    const response = await $fetch<HomeAssistantWeatherState>(
      `${baseUrl}/api/states/${entityId}`,
      {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      },
    );

    const state = response.state;
    const attrs = response.attributes;

    // Determine if it's day or night based on state
    const isDay = state !== "clear-night";

    // Get icon and description
    const icon = weatherStateToIcon[state] || "i-lucide-cloud";
    const description = weatherStateToDescription[state] || state;

    // Convert temperature if needed (Home Assistant reports in configured unit)
    const temperature = Math.round(attrs.temperature);
    const units = attrs.temperature_unit?.toLowerCase() === "°c" ? "celsius" : "fahrenheit";

    return {
      temperature,
      feelsLike: temperature, // Home Assistant doesn't always provide feels-like
      humidity: attrs.humidity,
      windSpeed: Math.round(attrs.wind_speed || 0),
      windDirection: attrs.wind_bearing || 0,
      condition: description,
      icon,
      isDay,
      units,
      source: "home-assistant",
      entityId,
      fetchedAt: new Date().toISOString(),
    };
  }
  catch (error) {
    consola.error("Failed to fetch Home Assistant weather:", error);
    throw createError({
      statusCode: 503,
      statusMessage: "Failed to fetch weather from Home Assistant",
    });
  }
});
