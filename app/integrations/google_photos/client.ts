import type { Integration } from "~/types/database";

export class GooglePhotosClientService {
  private integrationId: string;

  constructor(integrationId: string) {
    this.integrationId = integrationId;
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
