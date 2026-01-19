import type { Integration } from "~/types/database";

export const usePhotos = () => {
  const photos = ref<Array<{ id: string; baseUrl: string; filename: string }>>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchPhotos = async () => {
    loading.value = true;
    error.value = null;

    try {
      // First, fetch the Google Photos integration
      const integrations = await $fetch<Integration[]>("/api/integrations");
      const photosIntegration = integrations.find(
        (i: Integration) => i.type === "photos" && i.service === "google" && i.enabled,
      );

      if (!photosIntegration) {
        error.value = "No Google Photos integration found. Please add one in Settings.";
        photos.value = [];
        return;
      }

      // Fetch photos using the integration ID
      const response = await $fetch<{
        photos: Array<{ id: string; baseUrl: string; filename: string }>;
      }>("/api/integrations/google_photos/photos", {
        query: {
          integrationId: photosIntegration.id,
          pageSize: 50,
        },
      });

      photos.value = response.photos || [];
    }
    catch (e: any) {
      error.value = e.message || "Failed to fetch photos";
      console.error("Error fetching photos:", e);
      photos.value = [];
    }
    finally {
      loading.value = false;
    }
  };

  const getPhotoUrl = (baseUrl: string, width = 1920, height = 1080) => {
    return `${baseUrl}=w${width}-h${height}`;
  };

  return {
    photos,
    loading,
    error,
    fetchPhotos,
    getPhotoUrl,
  };
};
