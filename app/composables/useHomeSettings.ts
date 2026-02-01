import type { HomeSettings } from "~/types/database";

export function useHomeSettings() {
  const homeSettings = useState<HomeSettings | null>("homeSettings", () => null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchHomeSettings = async () => {
    loading.value = true;
    error.value = null;

    try {
      const response = await $fetch<HomeSettings>("/api/home-settings");
      homeSettings.value = response;
    }
    catch (e: any) {
      error.value = e.message || "Failed to fetch home settings";
      // Error fetching home settings
    }
    finally {
      loading.value = false;
    }
  };

  const updateHomeSettings = async (updates: Partial<HomeSettings>) => {
    loading.value = true;
    error.value = null;

    // Optimistic update - update local state immediately
    if (homeSettings.value) {
      homeSettings.value = { ...homeSettings.value, ...updates };
    }

    try {
      const response = await $fetch<HomeSettings>("/api/home-settings", {
        method: "PUT",
        body: updates,
      });
      homeSettings.value = response;
    }
    catch (e: any) {
      error.value = e.message || "Failed to update home settings";
      // Error updating home settings
      // Revert optimistic update on error by refetching
      await fetchHomeSettings();
    }
    finally {
      loading.value = false;
    }
  };

  return {
    homeSettings,
    loading,
    error,
    fetchHomeSettings,
    updateHomeSettings,
  };
}
