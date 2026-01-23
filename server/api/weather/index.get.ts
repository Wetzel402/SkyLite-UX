import { consola } from "consola";
import https from "node:https";

type WeatherResponse = {
  temperature: number;
  weatherCode: number;
  weatherDescription: string;
  daily: Array<{
    date: string;
    tempMax: number;
    tempMin: number;
    weatherCode: number;
    weatherDescription: string;
  }>;
};

// Helper function to make HTTPS requests with native Node.js module
function httpsGet(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    let req: ReturnType<typeof https.get>;

    const timeout = setTimeout(() => {
      req.destroy();
      reject(new Error("Request timeout"));
    }, 30000);

    req = https.get(url, (res) => {
      // Check for non-2xx status codes
      if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
        // Drain the response to free up resources
        res.resume();
        clearTimeout(timeout);
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }

      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        clearTimeout(timeout);
        try {
          resolve(JSON.parse(data));
        }
        catch (err) {
          const parseError = err instanceof Error ? err.message : String(err);
          reject(new Error(`Failed to parse response: ${parseError}`));
        }
      });
    }).on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

export default defineEventHandler(async (event): Promise<WeatherResponse> => {
  const query = getQuery(event);
  const { latitude, longitude } = query;

  // Validate coordinates (accept 0 as valid value)
  if (latitude === undefined || latitude === null || latitude === ""
    || longitude === undefined || longitude === null || longitude === "") {
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
    // Build query string manually
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lng.toString(),
      current: "temperature_2m,apparent_temperature,weather_code,is_day",
      daily: "temperature_2m_max,temperature_2m_min,weather_code",
      temperature_unit: temperatureUnit === "fahrenheit" ? "fahrenheit" : "celsius",
      timezone: "auto",
      forecast_days: "7",
    });

    const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
    consola.debug("Fetching weather from:", url);

    // Call Open-Meteo API using native Node.js https module
    // (works around potential ofetch/undici timeout issues)
    const weather: any = await httpsGet(url);

    // WMO Weather interpretation codes to descriptions
    const getWeatherDescription = (code: number): string => {
      if (code === 0)
        return "Clear sky";
      if (code === 1)
        return "Mainly clear";
      if (code === 2)
        return "Partly cloudy";
      if (code === 3)
        return "Overcast";
      if (code >= 45 && code <= 48)
        return "Foggy";
      if (code >= 51 && code <= 57)
        return "Drizzle";
      if (code >= 61 && code <= 67)
        return "Rain";
      if (code >= 71 && code <= 77)
        return "Snow";
      if (code >= 80 && code <= 82)
        return "Rain showers";
      if (code >= 85 && code <= 86)
        return "Snow showers";
      if (code >= 95 && code <= 99)
        return "Thunderstorm";
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
