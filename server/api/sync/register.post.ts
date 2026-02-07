import { consola } from "consola";
import { defineEventHandler, readBody } from "h3";

import type { Integration } from "~/types/database";

import { setupIntegrationSync } from "../../plugins/02.syncManager";

export default defineEventHandler(async (event) => {
  try {
    const integration = await readBody<Integration>(event);

    consola.debug(`Sync Register: Registering integration for sync: ${integration.name} (${integration.id})`);

    await setupIntegrationSync(integration);

    consola.debug(`Sync Register: Successfully registered integration for sync: ${integration.name}`);

    return { success: true, message: "Integration registered for sync" };
  }
  catch (error) {
    consola.error("Sync Register: Failed to register integration for sync:", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to register integration for sync",
    });
  }
});
