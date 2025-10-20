import { consola } from "consola";
import { google } from "googleapis";
import { createError, defineEventHandler, readBody } from "h3";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { clientId, clientSecret, authCode } = body;

  if (!authCode || typeof authCode !== "string") {
    throw createError({
      statusCode: 400,
      message: "authCode is required",
    });
  }

  if (!clientId || typeof clientId !== "string") {
    throw createError({
      statusCode: 400,
      message: "clientId is required",
    });
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret || "",
    "postmessage",
  );

  try {
    const { tokens } = await oauth2Client.getToken(authCode);

    if (!tokens.refresh_token) {
      throw createError({
        statusCode: 400,
        message: "No refresh token received from Google. Please ensure you're requesting offline access.",
      });
    }

    consola.success("Google Calendar: Successfully exchanged auth code for refresh token");

    return { refreshToken: tokens.refresh_token };
  }
  catch (error) {
    consola.error("Integrations Google Calendar Exchange Token: Failed to exchange auth code:", error);
    throw createError({
      statusCode: 400,
      message: error instanceof Error ? error.message : "Failed to exchange auth code for refresh token",
    });
  }
});
