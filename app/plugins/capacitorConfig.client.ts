import { consola } from "consola";

export default defineNuxtPlugin(async () => {
  if (typeof window !== "undefined" && "Capacitor" in window) {
    consola.info("[Capacitor Config] Detected Capacitor environment");
    try {
      // Dynamically import Capacitor plugins to avoid SSR issues
      const { Preferences } = await import("@capacitor/preferences");

      // Get server URL from preferences (no default - user must configure)
      const { value } = await Preferences.get({ key: "serverUrl" });
      const serverUrl = value || null;

      consola.info("[Capacitor Config] Server URL from preferences:", serverUrl || "NOT SET");

      // Store serverUrl in window for access by other components
      window.__CAPACITOR_SERVER_URL__ = serverUrl;

      // Override $fetch to use server URL for API calls
      const originalFetch = globalThis.$fetch;
      // @ts-expect-error - Override $fetch for Capacitor
      globalThis.$fetch = (url: string, options?: any): any => {
        // Get current server URL (may have been updated in mobile-settings)
        const currentServerUrl = window.__CAPACITOR_SERVER_URL__;

        consola.debug(`[Capacitor $fetch] >>> FETCH CALLED: ${url}`);

        // Sanitize options for logging (redact sensitive headers)
        const sanitizedOptions = options
          ? {
              ...options,
              headers: options.headers ? { ...options.headers, authorization: "[REDACTED]", cookie: "[REDACTED]" } : undefined,
              body: options.body ? "[REDACTED]" : undefined,
            }
          : undefined;

        consola.debug("[Capacitor $fetch] Server URL:", currentServerUrl || "NOT SET", "Method:", sanitizedOptions?.method || "GET");

        // If no server URL configured, reject API calls
        if (!currentServerUrl && typeof url === "string" && url.startsWith("/api/")) {
          consola.warn("[Capacitor] No server URL configured. Please set it in Mobile Settings.");
          return Promise.reject(new Error("Server URL not configured"));
        }

        // Prepend server URL if relative path (API calls start with /)
        if (currentServerUrl && typeof url === "string" && url.startsWith("/")) {
          const fullUrl = currentServerUrl + url;
          consola.info(`[Capacitor $fetch] >>> Rewriting to: ${fullUrl}`);
          url = fullUrl;
        }

        const promise = originalFetch(url, options);

        promise.then(
          () => consola.info(`[Capacitor $fetch] <<< SUCCESS: ${url}`),
          error => consola.error(`[Capacitor $fetch] <<< FAILED: ${url}`, error),
        );

        return promise;
      };

      consola.info("[Capacitor Config] Successfully initialized with server URL:", serverUrl || "NOT SET");
    }
    catch (error) {
      consola.error("[Capacitor] Failed to initialize:", error);
      // Continue anyway - let the app load
    }
  }
  else {
    consola.debug("[Capacitor Config] Not in Capacitor environment");
  }
});
