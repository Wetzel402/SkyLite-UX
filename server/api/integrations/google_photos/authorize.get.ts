import { google } from "googleapis";
import { getGoogleOAuthConfig } from "../../../utils/googleOAuthConfig";
import { randomBytes } from "crypto";

export default defineEventHandler(async (event) => {
  const oauthConfig = getGoogleOAuthConfig();
  if (!oauthConfig) {
    throw createError({
      statusCode: 500,
      message: "Google OAuth credentials not configured",
    });
  }

  // Determine callback URL
  const headers = getHeaders(event);
  const host = headers.host || "localhost:3001";
  const protocol = host.includes("localhost") ? "http" : "https";
  const redirectUri = `${protocol}://${host}/api/integrations/google_photos/callback`;

  // Generate CSRF protection state token
  const state = randomBytes(32).toString("hex");

  // Store state in cookie for verification in callback
  setCookie(event, "google_photos_oauth_state", state, {
    httpOnly: true,
    secure: !host.includes("localhost"),
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

  // Generate authorization URL with Photos Library scope
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/photoslibrary.readonly",
    ],
    prompt: "consent",
    state, // Include state parameter for CSRF protection
  });

  return sendRedirect(event, authUrl, 302);
});
