import { useStorage } from "@vueuse/core";

import type { ClientPreferences } from "~/types/ui";

import {

  defaultClientPreferences,
} from "~/types/ui";

const STORAGE_KEY = "skylite-client-preferences";

export function useClientPreferences() {
  const preferences = useStorage<ClientPreferences>(
    STORAGE_KEY,
    defaultClientPreferences,
    undefined,
    { mergeDefaults: true },
  );

  function updatePreferences(partial: Partial<ClientPreferences>) {
    preferences.value = { ...preferences.value, ...partial };
  }

  if (import.meta.client) {
    const colorMode = useColorMode();
    const resolved = computed(() => {
      const mode = preferences.value?.colorMode ?? "system";
      if (mode === "system") {
        return typeof window !== "undefined"
          && window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      }
      return mode;
    });
    watch(
      resolved,
      (value) => {
        colorMode.preference = value;
      },
      { immediate: true },
    );
  }

  return {
    preferences,
    updatePreferences,
  };
}
