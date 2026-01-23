import type { Integration } from "~/types/database";

/**
 * Google Tasks Client Service
 *
 * This is a minimal client-side service for Google Tasks integration.
 * Since Google Tasks is a read-only server-side integration, this service
 * doesn't need to do much - it just satisfies the integration service contract.
 */
export function createGoogleTasksService(_id: string) {
  return {
    async initialize() {
      // No initialization needed for read-only server-side integration
    },
    async validate() {
      // Validation is handled server-side during OAuth
      return true;
    },
    async testConnection() {
      // Connection test is handled server-side during OAuth
      return true;
    },
    async getStatus() {
      return {
        isConnected: true,
        lastChecked: new Date(),
      };
    },
  };
}

/**
 * Custom save handler for Google Tasks OAuth integration.
 * Redirects to Google OAuth flow for new integrations or re-authentication.
 */
export async function handleGoogleTasksSave(
  integrationData: Record<string, unknown>,
  _settingsData: Record<string, unknown>,
  isExisting: boolean,
  originalIntegration?: Integration | null,
): Promise<boolean> {
  // Check if this is a new integration or needs re-authentication
  const needsReauth = originalIntegration?.settings
    ? (originalIntegration.settings as { needsReauth?: boolean })?.needsReauth
    : false;

  const needsOAuth = !isExisting || needsReauth;

  if (!needsOAuth) {
    // Existing integration that doesn't need re-auth, let normal save handle it
    return false;
  }

  // Redirect to OAuth authorize endpoint
  if (typeof window !== "undefined") {
    window.location.href = "/api/integrations/google_tasks/authorize";
  }

  // Return true to indicate we handled the save
  return true;
}
