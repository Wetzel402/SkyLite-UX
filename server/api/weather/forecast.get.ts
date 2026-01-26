// Weather Forecast API using Open-Meteo (free, no API key required)
// This provides hourly and daily forecast

type OpenMeteoForecastResponse = {
  hourly: {
    time: string[];
    temperature_2m: number[];
    weather_code: number[];
    precipitation_probability: number[];
  };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
    precipitation_sum: number[];
    precipitation_probability_max: number[];
    uv_index_max: number[];
    wind_speed_10m_max: number[];
  };
};

type WeatherCondition = {
  code: number;
  description: string;
  icon: string;
};

// WMO Weather interpretation codes
const weatherCodes: Record<number, WeatherCondition> = {
  0: { code: 0, description: "Clear", icon: "i-lucide-sun" },
  1: { code: 1, description: "Clear", icon: "i-lucide-sun" },
  2: { code: 2, description: "Partly cloudy", icon: "i-lucide-cloud-sun" },
  3: { code: 3, description: "Overcast", icon: "i-lucide-cloud" },
  45: { code: 45, description: "Foggy", icon: "i-lucide-cloud-fog" },
  48: { code: 48, description: "Rime fog", icon: "i-lucide-cloud-fog" },
  51: { code: 51, description: "Drizzle", icon: "i-lucide-cloud-drizzle" },
  53: { code: 53, description: "Drizzle", icon: "i-lucide-cloud-drizzle" },
  55: { code: 55, description: "Drizzle", icon: "i-lucide-cloud-drizzle" },
  61: { code: 61, description: "Rain", icon: "i-lucide-cloud-rain" },
  63: { code: 63, description: "Rain", icon: "i-lucide-cloud-rain" },
  65: { code: 65, description: "Heavy rain", icon: "i-lucide-cloud-rain" },
  66: { code: 66, description: "Freezing rain", icon: "i-lucide-cloud-rain" },
  67: { code: 67, description: "Freezing rain", icon: "i-lucide-cloud-rain" },
  71: { code: 71, description: "Snow", icon: "i-lucide-cloud-snow" },
  73: { code: 73, description: "Snow", icon: "i-lucide-cloud-snow" },
  75: { code: 75, description: "Heavy snow", icon: "i-lucide-cloud-snow" },
  77: { code: 77, description: "Snow", icon: "i-lucide-cloud-snow" },
  80: { code: 80, description: "Showers", icon: "i-lucide-cloud-rain" },
  81: { code: 81, description: "Showers", icon: "i-lucide-cloud-rain" },
  82: { code: 82, description: "Heavy showers", icon: "i-lucide-cloud-rain" },
  85: { code: 85, description: "Snow showers", icon: "i-lucide-cloud-snow" },
  86: { code: 86, description: "Snow showers", icon: "i-lucide-cloud-snow" },
  95: { code: 95, description: "Thunderstorm", icon: "i-lucide-cloud-lightning" },
  96: { code: 96, description: "Thunderstorm", icon: "i-lucide-cloud-lightning" },
  99: { code: 99, description: "Thunderstorm", icon: "i-lucide-cloud-lightning" },
};

function getWeatherCondition(code: number): WeatherCondition {
  return weatherCodes[code] || { code, description: "Unknown", icon: "i-lucide-cloud" };
}

export default defineCachedEventHandler(async (event) => {
  const query = getQuery(event);

  // Get location from query or use default (Chicago)
  let lat = Number.parseFloat(query.lat as string) || 41.8781;
  let lon = Number.parseFloat(query.lon as string) || -87.6298;
  const units = (query.units as string) || "fahrenheit";

  // If location is provided as city name, we'll use a simple geocoding
  if (query.location) {
    const locationStr = query.location as string;
    const coordMatch = locationStr.match(/^(-?\d+(?:\.\d*)?),\s*(-?\d+(?:\.\d*)?)$/);
    if (coordMatch && coordMatch[1] && coordMatch[2]) {
      lat = Number.parseFloat(coordMatch[1]);
      lon = Number.parseFloat(coordMatch[2]);
    }
  }

  const temperatureUnit = units === "celsius" ? "celsius" : "fahrenheit";

  try {
    const response = await $fetch<OpenMeteoForecastResponse>(
      `https://api.open-meteo.com/v1/forecast`,
      {
        query: {
          latitude: lat,
          longitude: lon,
          hourly: "temperature_2m,weather_code,precipitation_probability",
          daily: "temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum,precipitation_probability_max,uv_index_max,wind_speed_10m_max",
          temperature_unit: temperatureUnit,
          wind_speed_unit: "mph",
          timezone: "auto",
          forecast_days: 7,
        },
      },
    );

    // Process hourly data (next 24 hours)
    const hourly = response.hourly.time.slice(0, 24).map((time, i) => {
      const condition = getWeatherCondition(response.hourly.weather_code[i] ?? 0);
      return {
        time,
        hour: new Date(time).getHours(),
        temperature: Math.round(response.hourly.temperature_2m[i] ?? 0),
        condition: condition.description,
        icon: condition.icon,
        precipProbability: response.hourly.precipitation_probability[i] ?? 0,
      };
    });

    // Process daily data (7 days)
    const daily = response.daily.time.map((date, i) => {
      const condition = getWeatherCondition(response.daily.weather_code[i] ?? 0);
      return {
        date,
        dayName: new Date(date).toLocaleDateString("en-US", { weekday: "short" }),
        high: Math.round(response.daily.temperature_2m_max[i] ?? 0),
        low: Math.round(response.daily.temperature_2m_min[i] ?? 0),
        condition: condition.description,
        icon: condition.icon,
        precipProbability: response.daily.precipitation_probability_max[i] ?? 0,
        uvIndex: Math.round(response.daily.uv_index_max[i] ?? 0),
        windSpeed: Math.round(response.daily.wind_speed_10m_max[i] ?? 0),
      };
    });

    return {
      hourly,
      daily,
      units: temperatureUnit,
      location: { lat, lon },
      fetchedAt: new Date().toISOString(),
    };
  }
  catch (error) {
    console.error("Failed to fetch forecast:", error);
    throw createError({
      statusCode: 503,
      statusMessage: "Weather service unavailable",
    });
  }
}, {
  maxAge: 60 * 60, // 1 hour cache
});
