import type { Integration } from "@prisma/client";

export function sanitizeSettings(settings: unknown) {
  if (!settings || typeof settings !== "object")
    return settings;

  const sanitized = { ...settings } as Record<string, unknown>;

  delete sanitized.clientSecret;

  return sanitized;
}

export function sanitizeIntegration(integration: Integration) {
  return {
    id: integration.id,
    name: integration.name,
    type: integration.type,
    service: integration.service,
    icon: integration.icon,
    enabled: integration.enabled,
    settings: sanitizeSettings(integration.settings),
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
  };
}
