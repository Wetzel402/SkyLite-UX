import { consola } from "consola";

import prisma from "~/lib/prisma";

import { GoogleTasksServerService } from "../../../integrations/google_tasks";
import { getGoogleOAuthConfig } from "../../../utils/googleOAuthConfig";

export default defineEventHandler(async () => {
  const integration = await prisma.integration.findFirst({
    where: {
      type: "tasks",
      service: "google",
      enabled: true,
    },
  });

  if (!integration || !integration.apiKey) {
    return { tasks: [] };
  }

  const oauthConfig = getGoogleOAuthConfig();
  if (!oauthConfig) {
    return { tasks: [] };
  }

  // Normalize settings to handle null/undefined
  const settings = (integration.settings ?? {}) as { accessToken?: string; tokenExpiry?: number };

  const service = new GoogleTasksServerService(
    oauthConfig.clientId,
    oauthConfig.clientSecret,
    integration.apiKey,
    settings.accessToken,
    settings.tokenExpiry,
    integration.id,
    async (integrationId, accessToken, expiry) => {
      await prisma.integration.update({
        where: { id: integrationId },
        data: {
          settings: {
            ...settings,
            accessToken,
            tokenExpiry: expiry,
          },
        },
      });
    },
  );

  try {
    const tasks = await service.getAllTasks();
    consola.info(`Google Tasks: Successfully fetched ${tasks.length} tasks`);
    return { tasks };
  }
  catch (error: any) {
    consola.error("Failed to fetch Google Tasks:", error);

    // Check if it's an authorization/token error
    const errorMessage = error.message || String(error);
    const isAuthError = errorMessage.includes("invalid_grant")
      || errorMessage.includes("unauthorized")
      || errorMessage.includes("401")
      || errorMessage.includes("403")
      || error.code === 401
      || error.code === 403;

    if (isAuthError) {
      consola.error("Google Tasks auth error - refresh token may be invalid");
      throw createError({
        statusCode: 401,
        message: "Google Tasks authorization expired. Please re-authorize the integration in settings.",
      });
    }

    // For other errors, log but return empty array to not break the UI
    consola.warn("Returning empty tasks array due to error");
    return { tasks: [], error: errorMessage };
  }
});
