/* eslint-disable node/no-process-env */
/**
 * Get Google OAuth configuration from runtime config or environment variables.
 * Supports both NUXT_GOOGLE_CLIENT_ID/NUXT_GOOGLE_CLIENT_SECRET (via runtimeConfig)
 * and GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET (direct env vars) for flexibility.
 */
export function getGoogleOAuthConfig(): { clientId: string; clientSecret: string } | null {
  // Try Nuxt runtime config first
  const config = useRuntimeConfig();
  let clientId = (config.googleClientId as string) || "";
  let clientSecret = (config.googleClientSecret as string) || "";

  // Fallback to direct environment variables for backwards compatibility
  if (!clientId)
    clientId = process.env.GOOGLE_CLIENT_ID || "";

  if (!clientSecret)
    clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";

  if (!clientId || !clientSecret) {
    return null;
  }

  return { clientId, clientSecret };
}
