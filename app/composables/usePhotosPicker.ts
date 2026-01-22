export const usePhotosPicker = () => {
  const selectedAlbums = ref<Array<{
    id: string;
    albumId: string;
    title: string;
    coverPhotoUrl?: string | null;
    mediaItemsCount?: number | null;
  }>>([]);

  const loading = ref(false);
  const error = ref<string | null>(null);

  // Fetch user's selected albums from database
  const fetchSelectedAlbums = async () => {
    loading.value = true;
    error.value = null;
    try {
      const response = await $fetch('/api/selected-albums');
      selectedAlbums.value = response.albums || [];
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch selected albums';
    } finally {
      loading.value = false;
    }
  };

  // Open Google Photos Picker
  const openPicker = async () => {
    if (typeof window === 'undefined') {
      throw new Error('Picker can only be opened in browser');
    }

    try {
      // Step 1: Create a picker session via server
      const { sessionId, pickerUri } = await $fetch<{ sessionId: string; pickerUri: string }>(
        '/api/integrations/google_photos/create-picker-session',
        { method: 'POST' },
      );

      // Step 2: Open the picker in a popup window
      const pickerWindow = window.open(
        pickerUri,
        'GooglePhotosPicker',
        'width=800,height=600,resizable=yes,scrollbars=yes',
      );

      if (!pickerWindow) {
        throw new Error('Failed to open picker window. Please allow popups for this site.');
      }

      // Step 3: Listen for postMessage from picker
      return new Promise((resolve, reject) => {
        let hasProcessed = false;
        let messageListener: ((event: MessageEvent) => void) | null = null;
        let focusHandler: (() => void) | null = null;
        let timeout: NodeJS.Timeout | null = null;

        const cleanup = () => {
          if (messageListener) {
            window.removeEventListener('message', messageListener);
          }
          if (focusHandler) {
            window.removeEventListener('focus', focusHandler);
          }
          if (timeout) {
            clearTimeout(timeout);
          }
        };

        const processPicker = async () => {
          if (hasProcessed) return;
          hasProcessed = true;
          cleanup();

          try {
            // Wait a bit for Google to process the selection
            await new Promise(r => setTimeout(r, 2000));

            // Step 4: Retrieve selected media items
            const { mediaItems } = await $fetch<{ mediaItems: any[] }>(
              '/api/integrations/google_photos/get-picker-media',
              {
                query: { sessionId },
              },
            ).catch((err) => {
              // If no items were selected, that's okay
              if (err.statusCode === 400 && err.message?.includes('PENDING_USER_ACTION')) {
                return { mediaItems: [] };
              }
              throw err;
            });

            if (mediaItems && mediaItems.length > 0) {
              // Store individual photos (not albums)
              // Photos Picker API returns the URL inside mediaFile object
              // Store the baseUrl - we'll proxy it through our server
              const photos = mediaItems.map((item, index) => {
                const baseUrl = item.mediaFile?.baseUrl;

                return {
                  albumId: item.id, // Photo ID
                  title: item.mediaFile?.filename || item.filename || `Photo ${index + 1}`,
                  coverPhotoUrl: baseUrl, // Store original baseUrl
                  mediaItemsCount: 1, // Always 1 for individual photos
                };
              });

              // Save to database
              await $fetch('/api/selected-albums', {
                method: 'POST',
                body: { albums: photos }, // API expects 'albums' but we're storing photos
              });

              await fetchSelectedAlbums();
              resolve(photos);
            } else {
              // No items selected
              resolve(null);
            }
          } catch (e) {
            reject(e);
          }
        };

        // Listen for postMessage from picker
        messageListener = (event: MessageEvent) => {
          // Check if message is from Google Photos
          if (event.origin !== 'https://photos.google.com') {
            return;
          }

          // Process picker completion
          // Google might send different message formats, so we'll try to detect completion
          if (event.data) {
            processPicker();
          }
        };

        window.addEventListener('message', messageListener);

        // Wait for user to manually close the picker window
        // Check only when they might close it (on window focus)
        focusHandler = () => {
          setTimeout(() => {
            if (pickerWindow.closed) {
              processPicker();
            }
          }, 500);
        };

        window.addEventListener('focus', focusHandler);

        // Timeout after 10 minutes
        timeout = setTimeout(() => {
          cleanup();
          window.removeEventListener('focus', focusHandler);
          if (!pickerWindow.closed) {
            pickerWindow.close();
          }
          if (!hasProcessed) {
            reject(new Error('Picker timeout - session expired'));
          }
        }, 10 * 60 * 1000);
      });
    } catch (e: any) {
      throw new Error(`Failed to open picker: ${e.message || e}`);
    }
  };

  return {
    selectedAlbums,
    loading,
    error,
    fetchSelectedAlbums,
    openPicker,
  };
};
