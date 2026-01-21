import prisma from "~/lib/prisma";

export default defineEventHandler(async (_event) => {
  try {
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
