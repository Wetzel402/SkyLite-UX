export function usePhotos() {
  const photos = ref<Array<{
    id: string;
    url: string;
    filename: string;
  }>>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Fetch photos from selected albums using Picker API
  const fetchPhotos = async () => {
    loading.value = true;
    error.value = null;

    try {
      // Get selected albums from database
      const response = await $fetch("/api/selected-albums");
      const albums = response.albums || [];

      if (albums.length === 0) {
        error.value = "No albums selected. Please select albums in settings.";
        photos.value = [];
        return;
      }

      // Use proxy URLs to fetch photos with authentication
      photos.value = albums
        .filter((a: any) => a.coverPhotoUrl)
        .map((a: any) => ({
          id: a.albumId,
          url: `/api/integrations/google_photos/proxy-image?photoId=${encodeURIComponent(a.albumId)}`,
          filename: a.title,
        }));
    }
    catch (e: any) {
      error.value = e.message || "Failed to fetch photos";
    }
    finally {
      loading.value = false;
    }
  };

  const getPhotoUrl = (url: string, width = 1920, height = 1080) => {
    // Add width and height parameters for high-resolution images
    if (url.includes("/api/integrations/google_photos/proxy-image")) {
      const urlObj = new URL(url, window.location.origin);
      urlObj.searchParams.set("width", width.toString());
      urlObj.searchParams.set("height", height.toString());
      return urlObj.toString();
    }
    return url;
  };

  return {
    photos,
    loading,
    error,
    fetchPhotos,
    getPhotoUrl,
  };
}
