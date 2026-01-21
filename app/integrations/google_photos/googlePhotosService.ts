import type { IntegrationService, IntegrationStatus } from "~/types/integrations";

export class GooglePhotosService implements IntegrationService {
  private integrationId: string;

  private status: IntegrationStatus = {
    isConnected: true,
    lastChecked: new Date(),
  };

  constructor(integrationId: string) {
    this.integrationId = integrationId;
  }

  async initialize(): Promise<void> {
    // Google Photos uses client-side Picker API - no server-side initialization needed
    this.status = {
      isConnected: true,
      lastChecked: new Date(),
    };
  }

  async getStatus(): Promise<IntegrationStatus> {
    return this.status;
  }

  async testConnection(): Promise<boolean> {
    // Test if access token exists
    try {
      const integration = await $fetch<{ settings?: Record<string, unknown> }>(`/api/integrations/${this.integrationId}`);
      const hasToken = !!(integration.settings as { accessToken?: string })?.accessToken;

      this.status = {
        isConnected: hasToken,
        lastChecked: new Date(),
      };

      return hasToken;
    } catch (error) {
      this.status = {
        isConnected: false,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
      return false;
    }
  }

  async validate(): Promise<boolean> {
    return await this.testConnection();
  }

  async getCapabilities(): Promise<string[]> {
    return ["oauth"];
  }
}

export function createGooglePhotosService(integrationId: string): GooglePhotosService {
  return new GooglePhotosService(integrationId);
}
