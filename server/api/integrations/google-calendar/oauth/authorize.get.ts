import { defineEventHandler, sendRedirect } from "h3";

import { createOAuth2Client, generateAuthUrl } from "../../../../integrations/google-calendar/oauth";

/**
 * Initiate Google OAuth2 authorization flow
 * Redirects user to Google consent screen
 */
export default defineEventHandler(async (event) => {
  const oauth2Client = createOAuth2Client();

  // Generate authorization URL
  const authUrl = generateAuthUrl(oauth2Client);

  // Redirect to Google consent screen
  return sendRedirect(event, authUrl);
});
