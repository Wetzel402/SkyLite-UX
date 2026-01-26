import { PrismaClient } from "@prisma/client";
import { consola } from "consola";
import { createError, defineEventHandler, readBody } from "h3";

import { integrationRegistry } from "~/types/integrations";

const prisma = new PrismaClient();

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
      accessToken: null,
      refreshToken: null,
      tokenExpiry: null,
      tokenType: null,
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

    // Remove sensitive fields before sending to client
    return {
      id: integration.id,
      name: integration.name,
      type: integration.type,
      service: integration.service,
      icon: integration.icon,
      enabled: integration.enabled,
      settings: integration.settings,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
      // Explicitly exclude apiKey and baseUrl for security
    };
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
