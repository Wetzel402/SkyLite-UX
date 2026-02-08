import { consola } from "consola";
import { createError, defineEventHandler, getQuery, sendRedirect } from "h3";

import { createOAuth2Client, encryptToken, exchangeCodeForTokens } from "../../../../integrations/google-calendar/oauth";

/**
 * Handle OAuth2 callback from Google
 * Exchanges authorization code for access and refresh tokens
 * Redirects to settings page with encrypted tokens in URL params
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const code = query.code as string;
  const error = query.error as string;

  // Handle user denial or error from Google
  if (error) {
    consola.warn(`OAuth error: ${error}`);
    return sendRedirect(event, `/settings?oauth_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    throw createError({
      statusCode: 400,
      message: "Authorization code not provided",
    });
  }

  try {
    const oauth2Client = createOAuth2Client();

    // Exchange code for tokens
    const tokenInfo = await exchangeCodeForTokens(oauth2Client, code);

    // Encrypt tokens for secure transmission
    const encryptedAccessToken = encryptToken(tokenInfo.accessToken);
    const encryptedRefreshToken = encryptToken(tokenInfo.refreshToken);

    // Redirect to settings with encrypted tokens
    // The frontend will use these to complete integration setup
    const redirectUrl = `/settings?oauth_success=true`
      + `&service=google-calendar`
      + `&access_token=${encodeURIComponent(encryptedAccessToken)}`
      + `&refresh_token=${encodeURIComponent(encryptedRefreshToken)}`
      + `&token_expiry=${tokenInfo.expiryDate}`;

    return sendRedirect(event, redirectUrl);
  }
  catch (err) {
    consola.error("OAuth callback error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to exchange authorization code";
    return sendRedirect(event, `/settings?oauth_error=${encodeURIComponent(errorMessage)}`);
  }
});
