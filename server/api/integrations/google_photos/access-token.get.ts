import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  try {
    // Security: Only allow server-side requests (not direct browser calls)
    const origin = getHeader(event, "origin");
    const referer = getHeader(event, "referer");
    const host = getHeader(event, "host");

    // Block requests with external origins (CSRF protection)
    if (origin && origin !== `http://${host}` && origin !== `https://${host}`) {
      throw createError({
        statusCode: 403,
        message: "Forbidden: Invalid origin",
      });
    }

    // Verify request is from same-site
    if (referer && !referer.startsWith(`http://${host}`) && !referer.startsWith(`https://${host}`)) {
      throw createError({
        statusCode: 403,
        message: "Forbidden: Invalid referer",
      });
    }

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
      throw createError({
        statusCode: 404,
        message: "Access token not found",
      });
    }

    return {
      accessToken: settings.accessToken,
    };
  }
  catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      message: `Failed to get access token: ${error}`,
    });
  }
});
