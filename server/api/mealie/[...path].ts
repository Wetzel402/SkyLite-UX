import { PrismaClient } from "@prisma/client";
import { createError, defineEventHandler, getQuery, readBody } from "h3";

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
  const pathParts = event.context.params?.path;
  if (!pathParts) {
    throw createError({
      statusCode: 400,
      message: "Invalid path",
    });
  }

  const method = event.method;
  const query = getQuery(event);
  const body = method !== "GET" ? await readBody(event) : undefined;

  if (method === "POST" && !body) {
    throw createError({
      statusCode: 400,
      message: "Request body is required for POST requests",
    });
  }

  console.warn("DEBUG: Server received request:", {
    method,
    path: pathParts,
    query,
    body,
  });

  // Get integration ID from query parameter
  const integrationId = query.integrationId as string;
  if (!integrationId) {
    throw createError({
      statusCode: 400,
      message: "integrationId query parameter is required",
    });
  }

  // Find the specific integration
  const integration = await prisma.integration.findFirst({
    where: {
      id: integrationId,
      type: "shopping",
      enabled: true,
    },
  });

  if (!integration || !integration.apiKey || !integration.baseUrl) {
    throw createError({
      statusCode: 404,
      message: "Mealie integration not found or not configured",
    });
  }

  // Verify that this is a Mealie integration
  if (integration.type !== "shopping") {
    throw createError({
      statusCode: 400,
      message: "Invalid integration type for Mealie API",
    });
  }

  const baseUrl = integration.baseUrl.endsWith("/") ? integration.baseUrl : `${integration.baseUrl}/`;
  const path = Array.isArray(pathParts) ? pathParts.join("/") : pathParts;

  // Remove integrationId from query params before forwarding to Mealie
  const { integrationId: _, ...restQuery } = query;
  const queryString = new URLSearchParams();

  // Handle array parameters (like ids) correctly, excluding integrationId
  Object.entries(restQuery).forEach(([key, value]) => {
    if (key === "integrationId")
      return; // Skip integrationId
    if (Array.isArray(value)) {
      value.forEach(v => queryString.append(key, v as string));
    }
    else {
      queryString.append(key, value as string);
    }
  });

  const url = `${baseUrl}${path}${queryString.toString() ? `?${queryString.toString()}` : ""}`;

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Authorization": `Bearer ${integration.apiKey}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw createError({
        statusCode: response.status,
        message: `Mealie API error: ${response.statusText}`,
      });
    }

    const data = await response.json();
    return data;
  }
  catch (error: any) {
    console.error("Error proxying to Mealie:", error);
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || "Failed to proxy request to Mealie",
    });
  }
});
