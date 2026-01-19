import type { IntegrationService, IntegrationStatus } from "~/types/integrations";

export type HomeAssistantWeatherSettings = {
  baseUrl?: string;
  apiKey?: string;
  entityId?: string;
};

export function createHomeAssistantWeatherService(
  id: string,
  apiKey: string,
  baseUrl: string,
  settings?: HomeAssistantWeatherSettings,
): IntegrationService {
  const entityId = settings?.entityId || "weather.home";
  let isConnected = false;
  let lastError: string | undefined;

  return {
    async initialize() {
      // Initialization logic - test connection on init
      try {
        const response = await $fetch(`/api/integrations/home-assistant/weather/current`, {
          query: {
            baseUrl,
            apiKey,
            entityId,
          },
        });
        isConnected = !!response;
        lastError = undefined;
      }
      catch (error) {
        isConnected = false;
        lastError = error instanceof Error ? error.message : "Failed to connect to Home Assistant";
      }
    },

    async validate() {
      // Validate the configuration
      if (!baseUrl) {
        lastError = "Home Assistant URL is required";
        return false;
      }
      if (!apiKey) {
        lastError = "Home Assistant API key is required";
        return false;
      }
      return true;
    },

    async getStatus(): Promise<IntegrationStatus> {
      return {
        isConnected,
        lastChecked: new Date(),
        error: lastError,
      };
    },

    async testConnection(): Promise<boolean> {
      try {
        const response = await $fetch(`/api/integrations/home-assistant/weather/current`, {
          query: {
            baseUrl,
            apiKey,
            entityId,
          },
        });
        isConnected = !!response;
        lastError = undefined;
        return true;
      }
      catch (error) {
        isConnected = false;
        lastError = error instanceof Error ? error.message : "Failed to connect to Home Assistant";
        return false;
      }
    },

    async getCapabilities(): Promise<string[]> {
      return ["get_current", "get_forecast"];
    },
  };
}
