import { getGoogleOAuthConfig } from "../../utils/googleOAuthConfig";

export default defineEventHandler(async (_event) => {
  const config = getGoogleOAuthConfig();

  if (!config) {
    return {
      configured: false,
    };
  }

  return {
    configured: true,
    clientId: config.clientId,
  };
});
