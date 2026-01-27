import { consola } from "consola";

import type { CalendarEvent } from "~/types/calendar";
import type { ShoppingListWithItemsAndCount, TodoWithUser } from "~/types/database";
import type { EventSourceStatus, IntegrationSyncData, SyncConnectionStatus, SyncEvent } from "~/types/sync";

export default defineNuxtPlugin((): any => {
  const isCapacitor = typeof window !== "undefined" && "Capacitor" in window;

  if (isCapacitor) {
    consola.info("[Sync Manager] Capacitor detected, skipping sync manager initialization");
    return {
      provide: {
        // Return stub functions matching the real API so code doesn't break
        getSyncData: () => undefined,
        getAllSyncData: () => ({}),
        getSyncConnectionStatus: () => "disabled" as SyncConnectionStatus,
        getLastHeartbeat: () => null,
        isSyncConnected: () => false,
        getCachedIntegrationData: () => undefined,
        checkIntegrationCache: () => false,
        purgeIntegrationCache: () => {},
        triggerImmediateSync: async () => Promise.resolve(),
        reconnectSync: () => {},
      },
    };
  }

  const syncData = useState<IntegrationSyncData>("sync-data", () => ({}));
  const connectionStatus = useState<SyncConnectionStatus>("sync-connection-status", () => "disconnected");
  const lastHeartbeat = useState<Date | null>("sync-last-heartbeat", () => null);

  let eventSource: EventSource | null = null;
  const eventSourceData = ref<string | null>(null);
  const eventSourceStatus = ref<EventSourceStatus>("CLOSED");
  const eventSourceError = ref<Event | null>(null);

  function connectEventSource() {
    if (eventSource && (eventSource.readyState === EventSource.OPEN || eventSource.readyState === EventSource.CONNECTING)) {
      consola.debug("Sync Manager: Connection already exists, skipping");
      return;
    }

    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }

    try {
      const syncTimestamps: Record<string, string> = {};
      Object.keys(syncData.value).forEach((integrationId) => {
        const syncInfo = syncData.value[integrationId];
        if (syncInfo?.lastSync) {
          syncTimestamps[integrationId] = syncInfo.lastSync.toISOString();
        }
      });

      const queryString = new URLSearchParams(syncTimestamps).toString();
      const url = queryString ? `/api/sync/events?${queryString}` : "/api/sync/events";

      eventSource = new EventSource(url);

      eventSource.onopen = () => {
        eventSourceStatus.value = "OPEN";
        connectionStatus.value = "connected";
        consola.debug("Sync Manager: Connected to sync stream");
      };

      eventSource.onmessage = (event) => {
        if (!navigator.onLine) {
          consola.debug("Sync Manager: Ignoring message - client is offline");
          return;
        }

        if (eventSource && eventSource.readyState === EventSource.OPEN) {
          eventSourceData.value = event.data;
        }
        else {
          consola.debug("Sync Manager: Ignoring message - EventSource not open (readyState:", eventSource?.readyState, ")");
        }
      };

      eventSource.onerror = (error) => {
        if (!navigator.onLine) {
          consola.debug("Sync Manager: EventSource error - client is offline");
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          eventSourceStatus.value = "CLOSED";
          connectionStatus.value = "disconnected";
          return;
        }

        if (eventSource) {
          if (eventSource.readyState === EventSource.CLOSED) {
            eventSourceStatus.value = "CLOSED";
            connectionStatus.value = "disconnected";
            eventSource.close();
            eventSource = null;
            attemptReconnect();
          }
          else if (eventSource.readyState === EventSource.CONNECTING) {
            eventSourceStatus.value = "CONNECTING";
          }
        }
        eventSourceError.value = error;
        consola.error("Sync Manager: EventSource error:", error, "readyState:", eventSource?.readyState);
      };

      eventSourceStatus.value = "CONNECTING";
      connectionStatus.value = "connecting";
    }
    catch (error) {
      consola.error("Sync Manager: Failed to create EventSource:", error);
      connectionStatus.value = "error";
    }
  }

  let reconnectAttempts = 0;
  const maxReconnectAttempts = 3;
  const reconnectDelay = 1000;
  const maxBackoffDelay = 60000;
  let reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;

  function attemptReconnect() {
    if (reconnectTimeoutId) {
      clearTimeout(reconnectTimeoutId);
      reconnectTimeoutId = null;
    }

    let delay: number;

    if (reconnectAttempts < maxReconnectAttempts) {
      delay = reconnectDelay * reconnectAttempts;
    }
    else {
      const backoffAttempt = reconnectAttempts - maxReconnectAttempts;
      delay = Math.min(
        reconnectDelay * (2 ** backoffAttempt),
        maxBackoffDelay,
      );
    }

    const attemptNumber = reconnectAttempts + 1;
    const delaySeconds = Math.round(delay / 1000);

    if (reconnectAttempts < maxReconnectAttempts) {
      consola.debug(`Sync Manager: Attempting to reconnect to sync stream (attempt ${attemptNumber}/${maxReconnectAttempts})`);
    }
    else {
      consola.warn(`Sync Manager: Attempting to reconnect to sync stream (attempt ${attemptNumber}, retrying in ${delaySeconds} seconds)`);
    }

    reconnectTimeoutId = setTimeout(() => {
      reconnectAttempts++;
      reconnectTimeoutId = null;
      connectEventSource();
    }, delay);
  }

  if (import.meta.client) {
    setTimeout(() => {
      watch(eventSourceStatus, (newStatus) => {
        switch (newStatus) {
          case "CONNECTING":
            connectionStatus.value = "connecting";
            break;
          case "OPEN":
            connectionStatus.value = "connected";
            reconnectAttempts = 0;
            break;
          case "CLOSED":
            connectionStatus.value = "disconnected";
            attemptReconnect();
            break;
        }
      });

      watch(eventSourceData, (rawData) => {
        if (!rawData)
          return;

        try {
          const event: SyncEvent = JSON.parse(rawData);
          consola.debug("Sync Manager: Received sync event:", event.type, event);

          switch (event.type) {
            case "connection_established":
              consola.debug("Sync Manager: Connected to sync stream:", event.message);
              break;

            case "sync_status":
              consola.debug(`Sync Manager: Sync status: ${event.activeIntegrations?.length || 0} active integrations, ${event.connectedClients || 0} connected clients`);
              break;

            case "heartbeat":
              lastHeartbeat.value = new Date(event.timestamp);
              break;

            case "integration_sync":
              if (event.integrationId) {
                syncData.value[event.integrationId] = {
                  data: event.data || [],
                  lastSync: new Date(event.timestamp),
                  success: event.success || false,
                  error: event.error,
                };

                if (event.integrationType && event.success) {
                  updateIntegrationCache(event.integrationType, event.integrationId, event.data || []);
                }

                consola.debug(`Sync Manager: Updated sync data for integration ${event.integrationId}:`, {
                  success: event.success,
                  hasData: !!event.data,
                  error: event.error,
                });
              }
              break;
          }
        }
        catch (error) {
          consola.error("Sync Manager: Failed to parse sync event:", error, rawData);
        }
      });

      watch(eventSourceError, (error) => {
        if (error) {
          consola.error("Sync Manager: Sync stream error:", error);
          connectionStatus.value = "error";
        }
      });

      connectEventSource();
    }, 0);
  }

  function updateIntegrationCache(integrationType: string, integrationId: string, data: CalendarEvent[] | ShoppingListWithItemsAndCount[] | TodoWithUser[]) {
    const nuxtApp = useNuxtApp();

    switch (integrationType) {
      case "calendar": {
        const cacheKey = `calendar-events-${integrationId}`;
        nuxtApp.payload.data = {
          ...nuxtApp.payload.data,
          [cacheKey]: data,
        };
        const { data: integrationEventsData } = useNuxtData<CalendarEvent[]>(cacheKey);
        if (integrationEventsData) {
          integrationEventsData.value = data as CalendarEvent[];
        }
        break;
      }

      case "shopping": {
        const cacheKey = `shopping-lists-${integrationId}`;
        nuxtApp.payload.data = {
          ...nuxtApp.payload.data,
          [cacheKey]: data,
        };
        const { data: integrationListsData } = useNuxtData<ShoppingListWithItemsAndCount[]>(cacheKey);
        if (integrationListsData) {
          integrationListsData.value = data as ShoppingListWithItemsAndCount[];
        }
        break;
      }

      case "todo": {
        const cacheKey = `todos-${integrationId}`;
        nuxtApp.payload.data = {
          ...nuxtApp.payload.data,
          [cacheKey]: data,
        };
        const { data: integrationTodosData } = useNuxtData<TodoWithUser[]>(cacheKey);
        if (integrationTodosData) {
          integrationTodosData.value = data as TodoWithUser[];
        }
        break;
      }
    }
  }

  function cleanup() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  }

  if (import.meta.client) {
    window.addEventListener("beforeunload", cleanup);

    window.addEventListener("online", () => {
      consola.debug("Sync Manager: Network came online, attempting to reconnect");

      if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId);
        reconnectTimeoutId = null;
      }

      if (!eventSource || eventSource.readyState === EventSource.CLOSED) {
        reconnectAttempts = 0;
        connectEventSource();
      }
    });

    window.addEventListener("offline", () => {
      consola.debug("Sync Manager: Network went offline");
      if (eventSource) {
        eventSource.close();
        eventSource = null;
        eventSourceStatus.value = "CLOSED";
        connectionStatus.value = "disconnected";
      }
    });
  }

  return {
    provide: {
      getSyncData: (integrationId: string) => {
        return syncData.value[integrationId];
      },

      getAllSyncData: () => {
        return syncData.value;
      },

      getSyncConnectionStatus: () => {
        return connectionStatus.value;
      },

      getLastHeartbeat: () => {
        return lastHeartbeat.value;
      },

      isSyncConnected: () => {
        return connectionStatus.value === "connected";
      },

      getCachedIntegrationData: (integrationType: string, integrationId: string) => {
        const nuxtApp = useNuxtApp();
        let cacheKey: string;
        if (integrationType === "calendar") {
          cacheKey = `${integrationType}-events-${integrationId}`;
        }
        else if (integrationType === "shopping") {
          cacheKey = `${integrationType}-lists-${integrationId}`;
        }
        else if (integrationType === "todo") {
          cacheKey = `${integrationType}s-${integrationId}`;
        }
        else {
          cacheKey = `${integrationType}-${integrationId}`;
        }
        return nuxtApp.payload.data[cacheKey];
      },

      checkIntegrationCache: (integrationType: string, integrationId: string) => {
        const nuxtApp = useNuxtApp();
        let cacheKey: string;
        if (integrationType === "calendar") {
          cacheKey = `${integrationType}-events-${integrationId}`;
        }
        else if (integrationType === "shopping") {
          cacheKey = `${integrationType}-lists-${integrationId}`;
        }
        else if (integrationType === "todo") {
          cacheKey = `${integrationType}s-${integrationId}`;
        }
        else {
          cacheKey = `${integrationType}-${integrationId}`;
        }
        return nuxtApp.payload.data[cacheKey] !== undefined;
      },

      purgeIntegrationCache: (integrationType: string, integrationId: string) => {
        const nuxtApp = useNuxtApp();
        let cacheKey: string;
        if (integrationType === "calendar") {
          cacheKey = `${integrationType}-events-${integrationId}`;
        }
        else if (integrationType === "shopping") {
          cacheKey = `${integrationType}-lists-${integrationId}`;
        }
        else if (integrationType === "todo") {
          cacheKey = `${integrationType}s-${integrationId}`;
        }
        else {
          cacheKey = `${integrationType}-${integrationId}`;
        }

        if (nuxtApp.payload.data[cacheKey] !== undefined) {
          delete nuxtApp.payload.data[cacheKey];
          consola.debug(`Sync Manager: Purged cache for ${integrationType} integration ${integrationId}`);
        }
      },

      triggerImmediateSync: async (integrationType: string, integrationId: string) => {
        try {
          consola.debug(`Sync Manager: Triggering immediate sync for ${integrationType} integration ${integrationId}`);

          const response = await $fetch("/api/sync/trigger", {
            method: "POST",
            body: {
              integrationId,
              integrationType,
              force: true,
            },
          });

          consola.debug(`Sync Manager: Immediate sync triggered successfully for ${integrationType} integration ${integrationId}`);
          return response;
        }
        catch (error) {
          consola.error(`Sync Manager: Failed to trigger immediate sync for ${integrationType} integration ${integrationId}:`, error);
          throw error;
        }
      },

      reconnectSync: () => {
        cleanup();
        reconnectAttempts = 0;
        connectEventSource();
      },
    },
  };
});
