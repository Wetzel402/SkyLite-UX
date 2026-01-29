import { google } from "googleapis";
import { randomBytes } from "node:crypto";

import { getGoogleOAuthConfig } from "../../../utils/googleOAuthConfig";

export default defineEventHandler(async (event) => {
  const oauthConfig = getGoogleOAuthConfig();
  if (!oauthConfig) {
    throw createError({
      statusCode: 500,
      message: "Google OAuth credentials not configured",
    });
  }

  // Determine callback URL using getRequestURL for proxy-safe origin
  const requestUrl = getRequestURL(event, {
    xForwardedHost: true,
    xForwardedProto: true,
  });
  const origin = requestUrl.origin;
  const redirectUri = `${origin}/api/integrations/google_photos/callback`;

  // Generate CSRF protection state token
  const state = randomBytes(32).toString("hex");

  // Store state in cookie for verification in callback
  setCookie(event, "google_photos_oauth_state", state, {
    httpOnly: true,
    secure: requestUrl.protocol === "https:",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  // Initialize OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    oauthConfig.clientId,
    oauthConfig.clientSecret,
    redirectUri,
  );

  // Generate authorization URL with Photo Picker API scope
  // Note: As of March 31, 2025, Library API is restricted to app-created content only.
  // Picker API is the approved way to access user's photos.
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/photospicker.mediaitems.readonly",
    ],
    prompt: "consent",
    state, // Include state parameter for CSRF protection
  });

  return sendRedirect(event, authUrl, 302);
});
