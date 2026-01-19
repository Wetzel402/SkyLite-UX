import { consola } from "consola";
import { createError, defineEventHandler, readBody } from "h3";

import prisma from "~/lib/prisma";
import { integrationRegistry } from "~/types/integrations";

import { sanitizeIntegration } from "../../utils/sanitizeIntegration";

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const { name, type, service, apiKey, baseUrl, icon, enabled, settings } = body;

    const integrationKey = `${type}:${service}`;

    consola.debug(`Server: Looking for integration config: ${integrationKey}`);
    consola.debug(`Server: Registry size: ${integrationRegistry.size}`);
    consola.debug(`Server: Registry keys: ${Array.from(integrationRegistry.keys()).join(", ")}`);

    const integrationConfig = integrationRegistry.get(integrationKey);

    if (!integrationConfig) {
      throw createError({
        statusCode: 400,
        message: `Unsupported integration type: ${integrationKey}`,
      });
    }

    const missingFields = integrationConfig.settingsFields
      .filter(field => field.required)
      .filter((field) => {
        if (field.key === "apiKey")
          return !apiKey;
        if (field.key === "baseUrl")
          return !baseUrl;
        if (field.key === "name")
          return !name;
        if (field.key === "type")
          return !type;
        if (field.key === "service")
          return !service;
        return false;
      })
      .map(field => field.label);

    if (missingFields.length > 0) {
      throw createError({
        statusCode: 400,
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    const hasOAuth = integrationConfig.capabilities.includes("oauth");

    if (!hasOAuth) {
      const { createIntegrationService } = await import("~/types/integrations");
      const tempIntegration = {
        id: "temp",
        type,
        service,
        apiKey: apiKey || "",
        baseUrl,
        enabled: true,
        name: name || "Temp",
        icon: icon || null,
        settings: settings || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const integrationService = await createIntegrationService(tempIntegration);
      if (!integrationService) {
        throw createError({
          statusCode: 400,
          message: `Unsupported integration type: ${type}:${service}`,
        });
      }

      const connectionSuccess = await integrationService.testConnection?.();
      if (!connectionSuccess) {
        const status = await integrationService.getStatus();
        throw createError({
          statusCode: 400,
          message: `Connection test failed: ${status.error || "Unknown error"}`,
        });
      }
    }

    const integration = await prisma.integration.create({
      data: {
        name,
        type,
        service,
        apiKey,
        baseUrl,
        icon,
        enabled,
        settings,
      },
    });

    return sanitizeIntegration(integration);
  }
  catch (error: unknown) {
    consola.error("Integrations index post: Error creating integration:", error);
    const statusCode = error && typeof error === "object" && "statusCode" in error ? Number(error.statusCode) : 500;
    const message = error && typeof error === "object" && "message" in error ? String(error.message) : "Failed to create integration";
    throw createError({
      statusCode,
      message,
    });
  }
});
