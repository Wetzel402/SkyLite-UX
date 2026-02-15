import { consola } from "consola";

import type { ClientPreferences } from "~/types/ui";

const STORAGE_KEY = "skylite-client-preferences";

export default defineNuxtPlugin(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const prefs = JSON.parse(raw) as ClientPreferences;
      const mode = prefs?.colorMode ?? "system";
      if (mode === "light" || mode === "dark") {
        const colorMode = useColorMode();
        colorMode.preference = mode;
      }
    }
  }
  catch (err) {
    consola.warn("Client preferences: could not restore from storage", err);
  }
});
