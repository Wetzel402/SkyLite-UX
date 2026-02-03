import type { CalendarEvent } from "~/types/calendar";
import type {
  ShoppingListWithItemsAndCount,
  TodoWithUser,
} from "~/types/database";

export type SyncData
  = | CalendarEvent[]
    | ShoppingListWithItemsAndCount[]
    | TodoWithUser[];

export type SyncEvent = {
  type:
    | "integration_sync"
    | "connection_established"
    | "sync_status"
    | "heartbeat";
  integrationId?: string;
  integrationType?: string;
  service?: string;
  data?: SyncData;
  timestamp: Date;
  success?: boolean;
  error?: string;
  message?: string;
  activeIntegrations?: string[];
  connectedClients?: number;
};

export type IntegrationSyncData = {
  [integrationId: string]: {
    data: SyncData;
    lastSync: Date;
    success: boolean;
    error?: string;
  };
};

export type SyncConnectionStatus
  = | "connecting"
    | "connected"
    | "disconnected"
    | "error";

export type EventSourceStatus = "CONNECTING" | "OPEN" | "CLOSED";

export type SyncStatus = {
  totalIntegrations: number;
  successfulSyncs: number;
  failedSyncs: number;
  lastSyncTime: Date | null;
  integrations: Record<
    string,
    {
      lastSync: Date;
      success: boolean;
      error?: string;
      hasData: boolean;
    }
  >;
};

export type SyncInterval = {
  integrationId: string;
  interval: NodeJS.Timeout;
  lastSync: Date;
  config: {
    type: string;
    service: string;
    syncInterval: number;
    capabilities: string[];
  };
};

export type ConnectedClient = {
  event: {
    node: {
      res: {
        write: (data: string) => void;
      };
    };
  };
  lastActivity: Date;
};

export type ServerSyncEvent = {
  type: "integration_sync";
  integrationId: string;
  integrationType: string;
  service: string;
  data: SyncData;
  timestamp: Date;
  success: boolean;
  error?: string;
};
