import consola from "consola";

import type { Integration } from "~/types/database";

import { GooglePhotosClientService } from "./client";

export function createGooglePhotosService(integrationId: string): GooglePhotosClientService {
  return new GooglePhotosClientService(integrationId);
}

export async function handleGooglePhotosSave(
  integrationData: Record<string, unknown>,
  _settingsData: Record<string, unknown>,
  isExisting: boolean,
  originalIntegration?: Integration | null,
): Promise<boolean> {
  const needsReauth = originalIntegration?.settings
    ? (originalIntegration.settings as Record<string, unknown>).needsReauth === true
    : false;

  // If this is an existing integration and doesn't need reauth, don't trigger OAuth
  if (isExisting && !needsReauth) {
    return false;
  }

  if (typeof window === "undefined") {
    throw new TypeError("Authentication requires browser environment");
  }

  // Fetch OAuth configuration from server
  const config = await $fetch<{ configured: boolean; clientId?: string }>("/api/config/googleCalendar");

  if (!config.configured || !config.clientId) {
    throw new Error("Google Photos integration is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.");
  }

  const clientId = config.clientId;

  // Load Google Identity Services
  await loadGoogleIdentityServices();

  const baseUrl = window.location.origin;
  const redirectUri = `${baseUrl}/api/integrations/google_photos/callback`;

  const stateData = {
    ...integrationData,
    redirectUri,
  };
  const state = encodeURIComponent(JSON.stringify(stateData));

  return new Promise((resolve) => {
    if (!window.google) {
      throw new Error("Google Identity Services not loaded");
    }

    const client = window.google.accounts.oauth2.initCodeClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/photoslibrary.readonly",
      ux_mode: "redirect",
      redirect_uri: redirectUri,
      state,
      access_type: "offline",
      prompt: "consent",
    });

    client.requestCode();

    resolve(true);
  });
}

async function loadGoogleIdentityServices(): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  const scriptSrc = "https://accounts.google.com/gsi/client";

  if (document.querySelector(`script[src="${scriptSrc}"]`)) {
    return;
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = scriptSrc;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      consola.error("Failed to load Google Identity Services");
      reject(new Error(`Failed to load script: ${scriptSrc}`));
    };
    document.head.appendChild(script);
  });
}
