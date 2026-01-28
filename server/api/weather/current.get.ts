// Weather API using Open-Meteo (free, no API key required)
// This provides current weather conditions

type OpenMeteoCurrentResponse = {
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    weather_code: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    is_day: number;
  };
};

type WeatherCondition = {
  code: number;
  description: string;
  icon: string;
};

// WMO Weather interpretation codes
const weatherCodes: Record<number, WeatherCondition> = {
  0: { code: 0, description: "Clear sky", icon: "i-lucide-sun" },
  1: { code: 1, description: "Mainly clear", icon: "i-lucide-sun" },
  2: { code: 2, description: "Partly cloudy", icon: "i-lucide-cloud-sun" },
  3: { code: 3, description: "Overcast", icon: "i-lucide-cloud" },
  45: { code: 45, description: "Foggy", icon: "i-lucide-cloud-fog" },
  48: { code: 48, description: "Rime fog", icon: "i-lucide-cloud-fog" },
  51: { code: 51, description: "Light drizzle", icon: "i-lucide-cloud-drizzle" },
  53: { code: 53, description: "Moderate drizzle", icon: "i-lucide-cloud-drizzle" },
  55: { code: 55, description: "Dense drizzle", icon: "i-lucide-cloud-drizzle" },
  61: { code: 61, description: "Light rain", icon: "i-lucide-cloud-rain" },
  63: { code: 63, description: "Moderate rain", icon: "i-lucide-cloud-rain" },
  65: { code: 65, description: "Heavy rain", icon: "i-lucide-cloud-rain" },
  66: { code: 66, description: "Light freezing rain", icon: "i-lucide-cloud-rain" },
  67: { code: 67, description: "Heavy freezing rain", icon: "i-lucide-cloud-rain" },
  71: { code: 71, description: "Light snow", icon: "i-lucide-cloud-snow" },
  73: { code: 73, description: "Moderate snow", icon: "i-lucide-cloud-snow" },
  75: { code: 75, description: "Heavy snow", icon: "i-lucide-cloud-snow" },
  77: { code: 77, description: "Snow grains", icon: "i-lucide-cloud-snow" },
  80: { code: 80, description: "Light showers", icon: "i-lucide-cloud-rain" },
  81: { code: 81, description: "Moderate showers", icon: "i-lucide-cloud-rain" },
  82: { code: 82, description: "Violent showers", icon: "i-lucide-cloud-rain" },
  85: { code: 85, description: "Light snow showers", icon: "i-lucide-cloud-snow" },
  86: { code: 86, description: "Heavy snow showers", icon: "i-lucide-cloud-snow" },
  95: { code: 95, description: "Thunderstorm", icon: "i-lucide-cloud-lightning" },
  96: { code: 96, description: "Thunderstorm with hail", icon: "i-lucide-cloud-lightning" },
  99: { code: 99, description: "Thunderstorm with heavy hail", icon: "i-lucide-cloud-lightning" },
};

function getWeatherCondition(code: number, isDay: boolean): WeatherCondition {
  const condition = weatherCodes[code] || { code, description: "Unknown", icon: "i-lucide-cloud" };

  // Use moon icon for clear night
  if ((code === 0 || code === 1) && !isDay) {
    return { ...condition, icon: "i-lucide-moon" };
  }

  return condition;
}

export default defineCachedEventHandler(async (event) => {
  const query = getQuery(event);

  // Get location from query or use default (Chicago)
  let lat = Number.parseFloat(query.lat as string) || 41.8781;
  let lon = Number.parseFloat(query.lon as string) || -87.6298;
  const units = (query.units as string) || "fahrenheit";

  // If location is provided as city name, we'll use a simple geocoding
  // For now, use coordinates directly
  if (query.location) {
    // Try to parse as coordinates first (lat,lon)
    const locationStr = query.location as string;
    const coordMatch = locationStr.match(/^(-?\d+(?:\.\d*)?),\s*(-?\d+(?:\.\d*)?)$/);
    if (coordMatch && coordMatch[1] && coordMatch[2]) {
      lat = Number.parseFloat(coordMatch[1]);
      lon = Number.parseFloat(coordMatch[2]);
    }
    // Otherwise keep defaults (in production, would use geocoding API)
  }

  const temperatureUnit = units === "celsius" ? "celsius" : "fahrenheit";

  try {
    const response = await $fetch<OpenMeteoCurrentResponse>(
      `https://api.open-meteo.com/v1/forecast`,
      {
        query: {
          latitude: lat,
          longitude: lon,
          current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,is_day",
          temperature_unit: temperatureUnit,
          wind_speed_unit: "mph",
          timezone: "auto",
        },
      },
    );

    const current = response.current;
    const isDay = current.is_day === 1;
    const condition = getWeatherCondition(current.weather_code, isDay);

    return {
      temperature: Math.round(current.temperature_2m),
      feelsLike: Math.round(current.apparent_temperature),
      humidity: current.relative_humidity_2m,
      windSpeed: Math.round(current.wind_speed_10m),
      windDirection: current.wind_direction_10m,
      condition: condition.description,
      icon: condition.icon,
      isDay,
      units: temperatureUnit,
      location: { lat, lon },
      fetchedAt: new Date().toISOString(),
    };
  }
  catch (error) {
    console.error("Failed to fetch weather:", error);
    throw createError({
      statusCode: 503,
      statusMessage: "Weather service unavailable",
    });
  }
}, {
  maxAge: 60 * 15, // 15 minutes
  swr: true,
});
