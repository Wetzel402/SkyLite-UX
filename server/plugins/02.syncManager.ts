import type { H3Event } from "h3";

import { consola } from "consola";
import { defineNitroPlugin } from "nitropack/runtime/plugin";

import type { CalendarEvent } from "../../app/types/calendar";
import type { Integration, ShoppingListWithItemsAndCount, TodoWithUser } from "../../app/types/database";
import type {
  ServerCalendarIntegrationService,
  ServerShoppingIntegrationService,
  ServerTodoIntegrationService,
  ServerTypedIntegrationService,
} from "../../app/types/integrations";
import type { ConnectedClient, ServerSyncEvent, SyncInterval } from "../../app/types/sync";

import { integrationConfigs } from "../../app/integrations/integrationConfig";
import { createIntegrationService, registerIntegration } from "../../app/types/integrations";

const syncIntervals = new Map<string, SyncInterval>();
const connectedClients = new Set<ConnectedClient>();
const integrationServices = new Map<string, ServerTypedIntegrationService>();

export default defineNitroPlugin(async (nitroApp) => {
  // Skip initialization during static generation (prevents hanging during 'nuxt generate')
  if (process.env.CAPACITOR_BUILD === "true" || process.env.prerender) {
    consola.info("Sync Manager: Skipping initialization (static generation mode)");
    return;
  }

  consola.start("Sync Manager: Initializing...");

  integrationConfigs.forEach((config) => {
    registerIntegration(config);
  });
  consola.debug(`Sync Manager: Registered ${integrationConfigs.length} integrations for server-side sync`);

  setInterval(() => {
    const now = new Date();
    const disconnectedClients: ConnectedClient[] = [];

    connectedClients.forEach((client) => {
      if (now.getTime() - client.lastActivity.getTime() > 5 * 60 * 1000) {
        disconnectedClients.push(client);
      }
    });

    disconnectedClients.forEach((client) => {
      connectedClients.delete(client);
    });

    if (disconnectedClients.length > 0) {
      consola.info(`Sync Manager: Cleaned up ${disconnectedClients.length} disconnected clients`);
    }
  }, 60 * 1000);

  await initializeIntegrationSync();

  nitroApp.hooks.hook("close", () => {
    consola.info("Sync Manager: Shutting down...");
    clearAllSyncIntervals();
  });
});

async function initializeIntegrationSync() {
  try {
    const prisma = await import("../../app/lib/prisma").then(m => m.default);
    const integrations = await prisma.integration.findMany({
      where: { enabled: true },
    });

    for (const integration of integrations) {
      await setupIntegrationSync(integration as Integration);
    }

    consola.debug(`Sync Manager: Initialized sync for ${integrations.length} integrations`);
  }
  catch (error) {
    consola.error("Sync Manager: Failed to initialize integration sync:", error);
  }
}

export async function setupIntegrationSync(integration: Integration, performImmediateSync = false) {
  try {
    const config = integrationConfigs.find(
      c => c.type === integration.type && c.service === integration.service,
    );

    if (!config) {
      consola.warn(`Sync Manager: No config found for integration ${integration.id} (${integration.type}:${integration.service})`);
      return;
    }

    clearIntegrationSync(integration.id);

    const service = await createIntegrationService(integration);
    if (!service) {
      consola.warn(`Sync Manager: Failed to create service for integration ${integration.id}`);
      return;
    }

    await service.initialize();
    integrationServices.set(integration.id, service as unknown as ServerTypedIntegrationService);

    if (performImmediateSync) {
      consola.debug(`Sync Manager: Performing immediate sync for integration ${integration.name} (${integration.id})`);
      await performIntegrationSync(integration, config, service as unknown as ServerTypedIntegrationService);
    }

    const interval = setInterval(async () => {
      await performIntegrationSync(integration, config, service as unknown as ServerTypedIntegrationService);
    }, config.syncInterval * 60 * 1000);

    syncIntervals.set(integration.id, {
      integrationId: integration.id,
      interval,
      lastSync: new Date(),
      config,
    });

    consola.debug(`Sync Manager: Set up sync for integration ${integration.name} (${integration.id}) - interval: ${config.syncInterval} minutes${performImmediateSync ? " with immediate sync" : ""}`);
  }
  catch (error) {
    consola.error(`Sync Manager: Failed to set up sync for integration ${integration.id}:`, error);
  }
}

async function performIntegrationSync(
  integration: Integration,
  config: typeof integrationConfigs[0],
  service: ServerTypedIntegrationService,
) {
  const syncStart = new Date();
  let success = false;
  let error: string | undefined;
  let data: CalendarEvent[] | ShoppingListWithItemsAndCount[] | TodoWithUser[] | null = null;

  try {
    consola.debug(`Sync Manager: Syncing integration ${integration.name} (${integration.id})...`);

    switch (integration.type) {
      case "calendar":
        data = await (service as ServerCalendarIntegrationService).getEvents();
        break;
      case "shopping":
        data = await (service as ServerShoppingIntegrationService).getShoppingLists();
        break;
      case "todo":
        data = await (service as ServerTodoIntegrationService).getTodos();
        break;
      case "tasks":
        // Tasks integrations are fetch-on-demand, not synced
        consola.debug(`Sync Manager: Skipping sync for tasks integration (fetch-on-demand)`);
        return;
      case "photos":
        // Photos integrations don't sync data, they're server-side only
        consola.debug(`Sync Manager: Skipping sync for photos integration (server-side only)`);
        return;
      default:
        consola.warn(`Sync Manager: Unknown integration type: ${integration.type}`);
        return;
    }

    success = true;
    consola.debug(`Sync Manager: Successfully synced integration ${integration.name} (${integration.id})`);
  }
  catch (err) {
    error = err instanceof Error ? err.message : String(err);
    const errObj = err as { code?: number; statusCode?: number };

    // Check if this is an authentication error (401)
    const isAuthError = errObj?.code === 401 || errObj?.statusCode === 401 || error?.includes("authentication expired") || error?.includes("Refresh token expired");

    if (isAuthError) {
      consola.warn(`Sync Manager: Integration ${integration.name} (${integration.id}) needs re-authorization. Disabling automatic sync.`);

      // Clear the sync interval to prevent continuous failed attempts
      clearIntegrationSync(integration.id);

      // Note: The API endpoint should have already marked the integration as needsReauth
      // We just stop trying to sync it automatically
    }
    else {
      consola.error(`Sync Manager: Failed to sync integration ${integration.name} (${integration.id}):`, err);
    }
  }
  finally {
    const syncInterval = syncIntervals.get(integration.id);
    if (syncInterval) {
      syncInterval.lastSync = syncStart;
    }

    const syncEvent: ServerSyncEvent = {
      type: "integration_sync",
      integrationId: integration.id,
      integrationType: integration.type,
      service: integration.service,
      data: data || [],
      timestamp: syncStart,
      success,
      error,
    };

    broadcastToClients(syncEvent);
  }
}

function broadcastToClients(event: ServerSyncEvent) {
  if (connectedClients.size === 0) {
    return;
  }

  const eventData = `data: ${JSON.stringify(event)}\n\n`;
  const disconnectedClients: ConnectedClient[] = [];

  connectedClients.forEach((client) => {
    try {
      client.lastActivity = new Date();

      client.event.node.res.write(eventData);
    }
    catch (err) {
      consola.warn("Sync Manager: Failed to send event to client, marking for cleanup:", err);
      disconnectedClients.push(client);
    }
  });

  disconnectedClients.forEach((client) => {
    connectedClients.delete(client);
  });
}

function clearIntegrationSync(integrationId: string) {
  const syncInterval = syncIntervals.get(integrationId);
  if (syncInterval) {
    clearInterval(syncInterval.interval);
    syncIntervals.delete(integrationId);
    integrationServices.delete(integrationId);
    consola.debug(`Sync Manager: Cleared sync for integration ${integrationId}`);
  }
}

function clearAllSyncIntervals() {
  syncIntervals.forEach((syncInterval) => {
    clearInterval(syncInterval.interval);
  });
  syncIntervals.clear();
  integrationServices.clear();
  connectedClients.clear();
  consola.debug("Sync Manager: Cleared all sync intervals");
}

export async function sendCachedSyncData(event: H3Event, integrationId: string, syncInterval: SyncInterval) {
  const prisma = await import("../../app/lib/prisma").then(m => m.default);
  const integration = await prisma.integration.findUnique({ where: { id: integrationId } });
  const service = integrationServices.get(integrationId);

  if (!integration || !service) {
    return;
  }

  try {
    let data: CalendarEvent[] | ShoppingListWithItemsAndCount[] | TodoWithUser[] | null = null;

    switch (integration.type) {
      case "calendar":
        data = await (service as ServerCalendarIntegrationService).getEvents();
        break;
      case "shopping":
        data = await (service as ServerShoppingIntegrationService).getShoppingLists();
        break;
      case "todo":
        data = await (service as ServerTodoIntegrationService).getTodos();
        break;
      case "tasks":
      case "photos":
        // Tasks and photos integrations are fetch-on-demand, not synced
        return;
    }

    if (data) {
      const syncEvent: ServerSyncEvent = {
        type: "integration_sync",
        integrationId: integration.id,
        integrationType: integration.type,
        service: integration.service,
        data,
        timestamp: syncInterval.lastSync,
        success: true,
      };

      event.node.res.write(`data: ${JSON.stringify(syncEvent)}\n\n`);
      consola.debug(`Sync Manager: Sent cached data for integration ${integration.name} (${integration.id}) to reconnecting client`);
    }
  }
  catch (error) {
    consola.error(`Sync Manager: Failed to send cached data for ${integrationId}:`, error);
  }
}

export function registerClient(event: H3Event) {
  const client: ConnectedClient = {
    event,
    lastActivity: new Date(),
  };
  connectedClients.add(client);
  consola.info(`Sync Manager: New client connected. Total clients: ${connectedClients.size}`);
}

export function unregisterClient(event: H3Event) {
  const clientToRemove = Array.from(connectedClients).find(
    client => client.event === event,
  );
  if (clientToRemove) {
    connectedClients.delete(clientToRemove);
    consola.info(`Sync Manager: Client disconnected. Total clients: ${connectedClients.size}`);
  }
}

export const syncManager = {
  setupIntegrationSync,
  clearIntegrationSync,
  clearAllSyncIntervals,
  registerClient,
  unregisterClient,
  getConnectedClientsCount: () => connectedClients.size,
  getActiveSyncIntervals: () => Array.from(syncIntervals.keys()),
  getSyncIntervals: () => syncIntervals,
  getIntegrationById: async (id: string) => {
    const prisma = await import("../../app/lib/prisma").then(m => m.default);
    return prisma.integration.findUnique({ where: { id } });
  },
};
