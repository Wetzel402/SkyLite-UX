import type { IntegrationService, IntegrationStatus } from "~/types/integrations";

export type ImmichSettings = {
  selectedAlbums?: string[];
};

export type ImmichAlbum = {
  id: string;
  title: string;
  description: string;
  assetCount: number;
  thumbnailAssetId: string | null;
  shared: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * Create an Immich photo service instance
 * This is the client-side service that interacts with the Immich API
 */
export function createImmichService(
  id: string,
  apiKey: string,
  baseUrl: string,
  _settings?: ImmichSettings,
): IntegrationService {
  const hasCredentials = Boolean(apiKey && baseUrl);

  return {
    async initialize() {
      // No initialization needed
    },

    async validate(): Promise<boolean> {
      return hasCredentials;
    },

    async getStatus(): Promise<IntegrationStatus> {
      if (!hasCredentials) {
        return {
          isConnected: false,
          lastChecked: new Date(),
          error: "Immich URL and API key are required",
        };
      }

      try {
        // Test connection by calling the server status endpoint
        const response = await fetch(`${baseUrl}/api/server/ping`, {
          headers: {
            "x-api-key": apiKey,
          },
        });

        if (response.ok) {
          return {
            isConnected: true,
            lastChecked: new Date(),
          };
        }
        else {
          // Provide user-friendly error messages for common HTTP status codes
          let errorMessage: string;
          switch (response.status) {
            case 401:
              errorMessage = "Authentication failed - check your API key";
              break;
            case 403:
              errorMessage = "Access denied - API key may lack required permissions";
              break;
            case 404:
              errorMessage = "Immich API endpoint not found - check your server URL";
              break;
            case 500:
            case 502:
            case 503:
              errorMessage = "Immich server error - try again later";
              break;
            default:
              errorMessage = `Server responded with status ${response.status}`;
          }
          return {
            isConnected: false,
            lastChecked: new Date(),
            error: errorMessage,
          };
        }
      }
      catch (error) {
        return {
          isConnected: false,
          lastChecked: new Date(),
          error: error instanceof Error ? error.message : "Failed to connect to Immich",
        };
      }
    },

    async testConnection(): Promise<boolean> {
      if (!hasCredentials) {
        return false;
      }

      try {
        const response = await fetch(`${baseUrl}/api/server/ping`, {
          headers: {
            "x-api-key": apiKey,
          },
        });
        return response.ok;
      }
      catch {
        return false;
      }
    },
  };
}
