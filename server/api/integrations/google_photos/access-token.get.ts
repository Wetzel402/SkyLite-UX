import consola from "consola";

import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  const origin = getHeader(event, "origin");
  const referer = getHeader(event, "referer");
  const host = getHeader(event, "host");

  consola.info("Access token retrieval attempt", {
    origin: origin || "none",
    referer: referer || "none",
    host: host || "none",
  });

  try {
    // TODO: Add authentication gate when user authentication is implemented
    // Example: const user = await getCurrentUser(event);
    // if (!user) { throw createError({ statusCode: 401, message: "Unauthorized" }); }
    // For now, this is a single-user application without authentication

    // Security: Only allow server-side requests (not direct browser calls)
    // Block requests with external origins (CSRF protection)
    if (origin && origin !== `http://${host}` && origin !== `https://${host}`) {
      consola.warn("Access token request blocked - invalid origin", {
        origin,
        host,
      });
      throw createError({
        statusCode: 403,
        message: "Forbidden: Invalid origin",
      });
    }

    // Verify request is from same-site
    if (referer && !referer.startsWith(`http://${host}`) && !referer.startsWith(`https://${host}`)) {
      consola.warn("Access token request blocked - invalid referer", {
        referer,
        host,
      });
      throw createError({
        statusCode: 403,
        message: "Forbidden: Invalid referer",
      });
    }

    consola.info("Access token request passed CSRF checks");

    // Find the Google Photos integration
    const integration = await prisma.integration.findFirst({
      where: {
        type: "photos",
        service: "google",
        enabled: true,
      },
    });

    if (!integration) {
      throw createError({
        statusCode: 404,
        message: "Google Photos integration not found",
      });
    }

    const settings = integration.settings as { accessToken?: string };

    if (!settings.accessToken) {
      consola.error("Access token not found in integration settings");
      throw createError({
        statusCode: 404,
        message: "Access token not found",
      });
    }

    consola.success("Access token retrieved successfully", {
      integrationId: integration.id,
      hasToken: true,
    });

    return {
      accessToken: settings.accessToken,
    };
  }
  catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      consola.error("Access token request denied", {
        statusCode: error.statusCode,
        message: "message" in error ? error.message : "Unknown error",
      });
      throw error;
    }
    consola.error("Failed to get access token", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw createError({
      statusCode: 500,
      message: `Failed to get access token: ${error}`,
    });
  }
});
