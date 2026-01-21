import type { Integration } from "~/types/database";

export async function handleGooglePhotosSave(
  integrationData: Record<string, unknown>,
  _settingsData: Record<string, unknown>,
  isExisting: boolean,
  originalIntegration?: Integration | null,
): Promise<boolean> {
  const needsReauth = originalIntegration?.settings
    ? (originalIntegration.settings as { needsReauth?: boolean })?.needsReauth
    : false;

  const needsOAuth = !isExisting || needsReauth;

  if (!needsOAuth) {
    return false;
  }

  // Redirect to OAuth authorize endpoint
  if (typeof window !== "undefined") {
    window.location.href = "/api/integrations/google_photos/authorize";
  }

  return true;
}
