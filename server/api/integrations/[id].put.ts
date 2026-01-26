import { PrismaClient } from "@prisma/client";
import { consola } from "consola";
import { createError, defineEventHandler, readBody } from "h3";

import { integrationRegistry } from "~/types/integrations";

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  try {
    const id = event.context.params?.id;
    if (!id) {
      throw createError({
        statusCode: 400,
        message: "Integration ID is required",
      });
    }

    const body = await readBody(event);
    const { name, type, service, apiKey, baseUrl, icon, enabled, settings } = body;

    if (apiKey || baseUrl) {
      const currentIntegration = await prisma.integration.findUnique({
        where: { id },
      });

      if (!currentIntegration) {
        throw createError({
          statusCode: 404,
          message: "Integration not found",
        });
      }

      const updatedData = {
        ...currentIntegration,
        ...(name && { name }),
        ...(type && { type }),
        ...(service && { service }),
        ...(apiKey && { apiKey }),
        ...(baseUrl && { baseUrl }),
        ...(icon !== undefined && { icon }),
        ...(enabled !== undefined && { enabled }),
        ...(settings && { settings }),
      };

      if (type || service) {
        const integrationKey = `${updatedData.type}:${updatedData.service}`;
        const integrationConfig = integrationRegistry.get(integrationKey);

        if (integrationConfig) {
          const missingFields = integrationConfig.settingsFields
            .filter(field => field.required)
            .filter((field) => {
              if (field.key === "apiKey")
                return !updatedData.apiKey;
              if (field.key === "baseUrl")
                return !updatedData.baseUrl;
              if (field.key === "name")
                return !updatedData.name;
              if (field.key === "type")
                return !updatedData.type;
              if (field.key === "service")
                return !updatedData.service;
              return false;
            })
            .map(field => field.label);

          if (missingFields.length > 0) {
            throw createError({
              statusCode: 400,
              message: `Missing required fields: ${missingFields.join(", ")}`,
            });
          }
        }
      }

      const { createIntegrationService } = await import("~/types/integrations");
      const tempIntegration = {
        id: "temp",
        type: updatedData.type,
        service: updatedData.service,
        apiKey: updatedData.apiKey,
        baseUrl: updatedData.baseUrl,
        enabled: true,
        name: updatedData.name || "Temp",
        icon: updatedData.icon || null,
        settings: updatedData.settings || {},
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
          message: `Unsupported integration type: ${updatedData.type}:${updatedData.service}`,
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

    const integration = await prisma.integration.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(service && { service }),
        ...(apiKey && { apiKey }),
        ...(baseUrl && { baseUrl }),
        ...(icon !== undefined && { icon }),
        ...(enabled !== undefined && { enabled }),
        ...(settings && { settings }),
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
    consola.error("Integrations id put: Error updating integration:", error);
    const statusCode = error && typeof error === "object" && "statusCode" in error ? Number(error.statusCode) : 500;
    const message = error && typeof error === "object" && "message" in error ? String(error.message) : "Failed to update integration";
    throw createError({
      statusCode,
      message,
    });
  }
});
