import { consola } from "consola";
import { GoogleTasksServerService } from "../../../integrations/google_tasks";
import prisma from "~/lib/prisma";
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
  const settings = (integration.settings ?? {}) as { accessToken?: string; expiryDate?: number };

  const service = new GoogleTasksServerService(
    oauthConfig.clientId,
    oauthConfig.clientSecret,
    integration.apiKey,
    settings.accessToken,
    settings.expiryDate,
    integration.id,
    async (integrationId, accessToken, expiry) => {
      await prisma.integration.update({
        where: { id: integrationId },
        data: {
          settings: {
            ...settings,
            accessToken,
            expiryDate: expiry,
          },
        },
      });
    }
  );

  try {
    const tasks = await service.getAllTasks();
    return { tasks };
  } catch (error: any) {
    consola.error("Failed to fetch Google Tasks:", error);
    return { tasks: [] };
  }
});
