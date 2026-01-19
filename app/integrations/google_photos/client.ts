import type { IntegrationStatus } from "~/types/integrations";

export class GooglePhotosClientService {
  private integrationId: string;
  private status: IntegrationStatus = {
    isConnected: false,
    lastChecked: new Date(),
  };

  constructor(integrationId: string) {
    this.integrationId = integrationId;
    this.status.lastChecked = new Date();
  }

  async initialize(): Promise<void> {
    await this.validate();
  }

  async validate(): Promise<boolean> {
    try {
      // Try to fetch albums to validate the connection
      await $fetch("/api/integrations/google_photos/albums", {
        headers: {
          "X-Integration-Id": this.integrationId,
        },
      });

      this.status = {
        isConnected: true,
        lastChecked: new Date(),
      };

      return true;
    }
    catch (error) {
      this.status = {
        isConnected: false,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
      return false;
    }
  }

  async getStatus(): Promise<IntegrationStatus> {
    return this.status;
  }

  async getAlbums() {
    const response = await $fetch("/api/integrations/google_photos/albums", {
      headers: {
        "X-Integration-Id": this.integrationId,
      },
    });
    return response.albums || [];
  }

  async getPhotos(albumIds?: string[]) {
    const params = albumIds ? { albumIds: albumIds.join(",") } : {};
    const response = await $fetch("/api/integrations/google_photos/photos", {
      params,
      headers: {
        "X-Integration-Id": this.integrationId,
      },
    });
    return response.photos || [];
  }
}
