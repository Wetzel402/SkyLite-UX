import { consola } from "consola";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const { latitude, longitude } = query;

  // Validate coordinates
  if (!latitude || !longitude) {
    throw createError({
      statusCode: 400,
      message: "Latitude and longitude are required",
    });
  }

  const lat = Number(latitude);
  const lng = Number(longitude);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    throw createError({
      statusCode: 400,
      message: "Invalid latitude or longitude values",
    });
  }

  if (lat < -90 || lat > 90) {
    throw createError({
      statusCode: 400,
      message: "Latitude must be between -90 and 90",
    });
  }

  if (lng < -180 || lng > 180) {
    throw createError({
      statusCode: 400,
      message: "Longitude must be between -180 and 180",
    });
  }

  try {
    // Call Open-Meteo API (free, no API key needed)
    const weather = await $fetch("https://api.open-meteo.com/v1/forecast", {
      query: {
        latitude: lat,
        longitude: lng,
        current: "temperature_2m,apparent_temperature,weather_code,is_day",
        daily: "temperature_2m_max,temperature_2m_min,weather_code",
        timezone: "auto",
        forecast_days: 1,
      },
    });

    return weather;
  }
  catch (error) {
    consola.error("Weather API error:", error);
    throw createError({
      statusCode: 502,
      message: "Failed to fetch weather data from Open-Meteo",
    });
  }
});
