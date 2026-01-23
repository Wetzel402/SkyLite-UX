import { consola } from "consola";

import prisma from "~/lib/prisma";

export default defineEventHandler(async (_event) => {
  try {
    consola.info("Creating Google Photos Picker session...");

    // Find the Google Photos integration
    const integration = await prisma.integration.findFirst({
      where: {
        type: "photos",
        service: "google",
        enabled: true,
      },
    });

    if (!integration) {
      consola.error("Google Photos integration not found");
      throw createError({
        statusCode: 404,
        message: "Google Photos integration not found",
      });
    }

    const settings = integration.settings as { accessToken?: string };

    if (!settings.accessToken) {
      consola.error("No access token in settings");
      throw createError({
        statusCode: 401,
        message: "No access token available",
      });
    }

    consola.info("Making request to Google Photos Picker API...");

    // Create a picker session using Google Photos Picker API
    const response = await fetch("https://photospicker.googleapis.com/v1/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${settings.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}), // Empty body - API creates session with defaults
    });

    if (!response.ok) {
      const errorText = await response.text();
      consola.error("Google Photos Picker API error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        hasAccessToken: !!settings.accessToken,
        tokenLength: settings.accessToken?.length,
      });
      throw createError({
        statusCode: response.status,
        message: `Failed to create picker session: ${response.status} ${response.statusText} - ${errorText}`,
      });
    }

    const sessionData = await response.json();

    return {
      sessionId: sessionData.id,
      pickerUri: sessionData.pickerUri,
    };
  }
  catch (error: any) {
    if (error.statusCode) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      message: `Failed to create picker session: ${error.message || error}`,
    });
  }
});
