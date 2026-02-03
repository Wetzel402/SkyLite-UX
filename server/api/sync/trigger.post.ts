import { consola } from "consola";
import { defineEventHandler, readBody } from "h3";

import type { Integration } from "~/types/database";

import prisma from "~/lib/prisma";

import { setupIntegrationSync } from "../../plugins/02.syncManager";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { integrationId, integrationType, force = false } = body;

    if (!integrationId || !integrationType) {
      throw createError({
        statusCode: 400,
        message: "integrationId and integrationType are required",
      });
    }

    consola.debug(`Sync Trigger: Triggering manual sync for ${integrationType} integration ${integrationId} (force: ${force})`);

    const integration = await prisma.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration) {
      throw createError({
        statusCode: 404,
        message: "Integration not found",
      });
    }

    if (!integration.enabled) {
      throw createError({
        statusCode: 400,
        message: "Integration is not enabled",
      });
    }

    await setupIntegrationSync(integration as Integration, true);

    consola.debug(`Sync Trigger: Successfully triggered sync for ${integrationType} integration ${integrationId}`);

    return {
      success: true,
      message: "Integration sync triggered successfully",
      integrationId,
      integrationType,
    };
  }
  catch (error) {
    consola.error("Sync Trigger: Failed to trigger integration sync:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to trigger integration sync",
    });
  }
});
