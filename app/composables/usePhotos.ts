export const usePhotos = () => {
  const photos = ref<Array<{ id: string; baseUrl: string; filename: string }>>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchPhotos = async () => {
    loading.value = true;
    error.value = null;

    try {
      const response = await $fetch<{ photos: Array<{ id: string; baseUrl: string; filename: string }> }>("/api/integrations/google_photos/photos");
      photos.value = response.photos || [];
    }
    catch (e: any) {
      error.value = e.message || "Failed to fetch photos";
      console.error("Error fetching photos:", e);
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
