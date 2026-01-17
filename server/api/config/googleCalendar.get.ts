import { defineEventHandler } from "h3";

import { getGoogleOAuthConfig } from "../../utils/googleOAuthConfig";

export default defineEventHandler(() => {
  const oauthConfig = getGoogleOAuthConfig();
  const configured = oauthConfig !== null;

  return {
    configured,
    // Only expose clientId (never the secret) - needed for OAuth flow
    clientId: configured ? oauthConfig.clientId : undefined,
  };
});
