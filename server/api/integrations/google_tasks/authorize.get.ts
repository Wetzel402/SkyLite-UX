import crypto from "node:crypto";
import { google } from "googleapis";
import { getGoogleOAuthConfig } from "../../../utils/googleOAuthConfig";

export default defineEventHandler(async (event) => {
  const oauthConfig = getGoogleOAuthConfig();
  if (!oauthConfig) {
    throw createError({
      statusCode: 500,
      message: "Google OAuth credentials not configured",
    });
  }

  const requestUrl = getRequestURL(event, {
    xForwardedHost: true,
    xForwardedProto: true,
  });
  const origin = requestUrl.origin;
  const redirectUri = `${origin}/api/integrations/google_tasks/callback`;

  const oauth2Client = new google.auth.OAuth2(
    oauthConfig.clientId,
    oauthConfig.clientSecret,
    redirectUri
  );

  // Generate CSRF state token
  const state = crypto.randomBytes(16).toString("hex");

  // Store state in HttpOnly, Secure cookie with 10-minute TTL
  setCookie(event, "google_tasks_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/tasks.readonly"],
    prompt: "consent",
    state,
  });

  return sendRedirect(event, authUrl, 302);
});
