import { consola } from "consola";

import type { AppSettings } from "~/types/database";

export function useAppSettings() {
  const { data: settings } = useNuxtData<AppSettings>("app-settings");

  const currentSettings = computed(() => settings.value || null);

  const getSettings = async () => {
    try {
      await refreshNuxtData("app-settings");
      consola.debug("Use App Settings: Settings refreshed successfully");
    }
    catch (err) {
      consola.error("Use App Settings: Error fetching settings:", err);
      throw err;
    }
  };

  const updateSettings = async (updates: Partial<AppSettings>) => {
    try {
      const updatedSettings = await $fetch<AppSettings>("/api/app-settings", {
        method: "PUT",
        body: updates,
      });

      await refreshNuxtData("app-settings");
      return updatedSettings;
    }
    catch (err) {
      consola.error("Use App Settings: Error updating settings:", err);
      throw err;
    }
  };

  return {
    settings: readonly(currentSettings),
    getSettings,
    updateSettings,
  };
}
