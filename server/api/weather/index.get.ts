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

  // Get temperature unit from query (default to celsius)
  const temperatureUnit = query.temperatureUnit as string || "celsius";

  try {
    // Call Open-Meteo API (free, no API key needed)
    const weather = await $fetch<any>("https://api.open-meteo.com/v1/forecast", {
      query: {
        latitude: lat,
        longitude: lng,
        current: "temperature_2m,apparent_temperature,weather_code,is_day",
        daily: "temperature_2m_max,temperature_2m_min,weather_code",
        temperature_unit: temperatureUnit === "fahrenheit" ? "fahrenheit" : "celsius",
        timezone: "auto",
        forecast_days: 7,
      },
    });

    // WMO Weather interpretation codes to descriptions
    const getWeatherDescription = (code: number): string => {
      if (code === 0) return "Clear sky";
      if (code === 1) return "Mainly clear";
      if (code === 2) return "Partly cloudy";
      if (code === 3) return "Overcast";
      if (code >= 45 && code <= 48) return "Foggy";
      if (code >= 51 && code <= 57) return "Drizzle";
      if (code >= 61 && code <= 67) return "Rain";
      if (code >= 71 && code <= 77) return "Snow";
      if (code >= 80 && code <= 82) return "Rain showers";
      if (code >= 85 && code <= 86) return "Snow showers";
      if (code >= 95 && code <= 99) return "Thunderstorm";
      return "Unknown";
    };

    // Transform daily forecast
    const dailyForecast = weather.daily.time.map((date: string, index: number) => ({
      date,
      tempMax: Math.round(weather.daily.temperature_2m_max[index]),
      tempMin: Math.round(weather.daily.temperature_2m_min[index]),
      weatherCode: weather.daily.weather_code[index],
      weatherDescription: getWeatherDescription(weather.daily.weather_code[index]),
    }));

    // Transform to expected format
    return {
      temperature: Math.round(weather.current.temperature_2m),
      weatherCode: weather.current.weather_code,
      weatherDescription: getWeatherDescription(weather.current.weather_code),
      daily: dailyForecast,
    };
  }
  catch (error) {
    consola.error("Weather API error:", error);
    throw createError({
      statusCode: 502,
      message: "Failed to fetch weather data from Open-Meteo",
    });
  }
});
