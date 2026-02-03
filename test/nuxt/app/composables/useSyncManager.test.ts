import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";

import { consola } from "consola";

vi.mock("consola", () => ({
  consola: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

const {
  mockUseState,
  mockUseNuxtApp,
  syncDataRef,
  connectionStatusRef,
  lastHeartbeatRef,
  payloadData,
  mockReconnect,
} = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref } = require("vue");
  const syncRef = ref({});
  const connRef = ref("disconnected");
  const heartbeatRef = ref(null);
  const data: Record<string, unknown> = {};
  const reconnectFn = vi.fn();

  const useStateMock = vi.fn((key: string) => {
    if (key === "sync-data") return syncRef;
    if (key === "sync-connection-status") return connRef;
    if (key === "sync-last-heartbeat") return heartbeatRef;
    return ref(null);
  });

  const useNuxtAppMock = vi.fn(() => ({
    payload: { data },
    $reconnectSync: reconnectFn,
  }));

  return {
    mockUseState: useStateMock,
    mockUseNuxtApp: useNuxtAppMock,
    syncDataRef: syncRef,
    connectionStatusRef: connRef,
    lastHeartbeatRef: heartbeatRef,
    payloadData: data,
    mockReconnect: reconnectFn,
  };
});

mockNuxtImport("useState", () => mockUseState);
mockNuxtImport("useNuxtApp", () => mockUseNuxtApp);

import { useSyncManager } from "../../../../app/composables/useSyncManager";

describe("useSyncManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    syncDataRef.value = {};
    connectionStatusRef.value = "disconnected";
    lastHeartbeatRef.value = null;
    Object.keys(payloadData).forEach(k => delete payloadData[k]);
  });

  it("should return getSyncData for integration id", () => {
    const lastSync = new Date("2026-01-26T12:00:00Z");
    syncDataRef.value = {
      "int-1": { data: [], lastSync, success: true },
    };
    const { getSyncData } = useSyncManager();
    expect(getSyncData("int-1")).toEqual({ data: [], lastSync, success: true });
    expect(getSyncData("missing")).toBeUndefined();
  });

  it("should return getAllSyncData", () => {
    syncDataRef.value = { "int-1": { data: [], lastSync: new Date(), success: true } };
    const { getAllSyncData } = useSyncManager();
    expect(getAllSyncData()).toEqual(syncDataRef.value);
    syncDataRef.value = {};
    expect(getAllSyncData()).toEqual({});
  });

  it("should return getConnectionStatus", () => {
    const { getConnectionStatus } = useSyncManager();
    expect(getConnectionStatus()).toBe("disconnected");
    connectionStatusRef.value = "connected";
    expect(getConnectionStatus()).toBe("connected");
  });

  it("should return getLastHeartbeat", () => {
    const { getLastHeartbeat } = useSyncManager();
    expect(getLastHeartbeat()).toBeNull();
    const h = new Date();
    lastHeartbeatRef.value = h;
    expect(getLastHeartbeat()).toBe(h);
  });

  it("should return isConnected from connection status", () => {
    const { isConnected } = useSyncManager();
    expect(isConnected()).toBe(false);
    connectionStatusRef.value = "connected";
    expect(isConnected()).toBe(true);
  });

  it("should return getCachedIntegrationData from nuxtApp.payload.data", () => {
    payloadData["calendar-events-int-1"] = [{ id: "e1", title: "E", start: new Date(), end: new Date() }];
    payloadData["shopping-lists-int-2"] = [];
    const { getCachedIntegrationData } = useSyncManager();
    expect(getCachedIntegrationData("calendar", "int-1")).toEqual(payloadData["calendar-events-int-1"]);
    expect(getCachedIntegrationData("shopping", "int-2")).toBe(payloadData["shopping-lists-int-2"]);
  });

  it("should use todos and else cache keys in getCachedIntegrationData", () => {
    const todoData = [{ id: "t1", title: "T" }];
    const otherData = { custom: true };
    payloadData["todos-tid"] = todoData;
    payloadData["other-oid"] = otherData;
    const { getCachedIntegrationData } = useSyncManager();
    expect(getCachedIntegrationData("todo", "tid")).toEqual(todoData);
    expect(getCachedIntegrationData("other", "oid")).toEqual(otherData);
  });

  it("should return getSyncStatus shape from sync data", () => {
    const d1 = new Date("2026-01-26T10:00:00Z");
    const d2 = new Date("2026-01-26T12:00:00Z");
    syncDataRef.value = {
      "int-1": { data: [], lastSync: d1, success: true },
      "int-2": { data: [], lastSync: d2, success: false, error: "err" },
    };
    const { getSyncStatus } = useSyncManager();
    const status = getSyncStatus();
    expect(status.totalIntegrations).toBe(2);
    expect(status.successfulSyncs).toBe(1);
    expect(status.failedSyncs).toBe(1);
    expect(status.lastSyncTime).toEqual(d2);
    expect(Object.keys(status.integrations)).toEqual(["int-1", "int-2"]);
    expect(status.integrations["int-1"]!.success).toBe(true);
    expect(status.integrations["int-2"]!.success).toBe(false);
    expect(status.integrations["int-2"]!.error).toBe("err");
  });

  it("should call $reconnectSync when reconnect is called and it exists", () => {
    const { reconnect } = useSyncManager();
    reconnect();
    expect(mockReconnect).toHaveBeenCalled();
  });

  it("should not throw or call reconnect when $reconnectSync is missing", () => {
    mockUseNuxtApp.mockReturnValueOnce({ payload: { data: {} } });
    const { reconnect } = useSyncManager();
    expect(() => reconnect()).not.toThrow();
    expect(mockReconnect).not.toHaveBeenCalled();
  });

  it("should not throw or call reconnect when $reconnectSync is not a function", () => {
    mockUseNuxtApp.mockReturnValueOnce({
      payload: { data: {} },
      $reconnectSync: "not-a-function",
    });
    const { reconnect } = useSyncManager();
    expect(() => reconnect()).not.toThrow();
    expect(mockReconnect).not.toHaveBeenCalled();
  });

  it("should return hasFreshData true when lastSync within 5 min and success", () => {
    const lastSync = new Date(Date.now() - 2 * 60 * 1000);
    syncDataRef.value = {
      "int-1": { data: [], lastSync, success: true },
    };
    const { hasFreshData } = useSyncManager();
    expect(hasFreshData("int-1")).toBe(true);
  });

  it("should return hasFreshData false when lastSync older than 5 min", () => {
    const lastSync = new Date(Date.now() - 10 * 60 * 1000);
    syncDataRef.value = {
      "int-1": { data: [], lastSync, success: true },
    };
    const { hasFreshData } = useSyncManager();
    expect(hasFreshData("int-1")).toBe(false);
  });

  it("should return hasFreshData false when success is false", () => {
    const lastSync = new Date(Date.now() - 2 * 60 * 1000);
    syncDataRef.value = {
      "int-1": { data: [], lastSync, success: false },
    };
    const { hasFreshData } = useSyncManager();
    expect(hasFreshData("int-1")).toBe(false);
  });

  it("should return getConnectionHealth with isHealthy true when connected and recent heartbeat", () => {
    connectionStatusRef.value = "connected";
    lastHeartbeatRef.value = new Date(Date.now() - 30 * 1000);
    const { getConnectionHealth } = useSyncManager();
    const health = getConnectionHealth();
    expect(health.status).toBe("connected");
    expect(health.isHealthy).toBe(true);
    expect(health.heartbeatAge).toBeLessThan(60000);
    expect(health.lastHeartbeat).toBe(lastHeartbeatRef.value);
  });

  it("should return getConnectionHealth with isHealthy false when not connected", () => {
    connectionStatusRef.value = "disconnected";
    lastHeartbeatRef.value = new Date(Date.now() - 30 * 1000);
    const { getConnectionHealth } = useSyncManager();
    const health = getConnectionHealth();
    expect(health.isHealthy).toBe(false);
    expect(health.heartbeatAge).toBeNull();
  });

  it("should return getConnectionHealth with isHealthy false when no heartbeat", () => {
    connectionStatusRef.value = "connected";
    lastHeartbeatRef.value = null;
    const { getConnectionHealth } = useSyncManager();
    const health = getConnectionHealth();
    expect(health.isHealthy).toBe(false);
    expect(health.heartbeatAge).toBeNull();
  });

  it("should return checkIntegrationCache true when cache key exists", () => {
    payloadData["calendar-events-x"] = [];
    const { checkIntegrationCache } = useSyncManager();
    expect(checkIntegrationCache("calendar", "x")).toBe(true);
  });

  it("should return checkIntegrationCache false when cache key missing", () => {
    const { checkIntegrationCache } = useSyncManager();
    expect(checkIntegrationCache("calendar", "missing")).toBe(false);
  });

  it("should purge integration cache and call consola.debug", () => {
    payloadData["shopping-lists-y"] = [];
    const { purgeIntegrationCache } = useSyncManager();
    purgeIntegrationCache("shopping", "y");
    expect(payloadData["shopping-lists-y"]).toBeUndefined();
    expect(vi.mocked(consola.debug)).toHaveBeenCalledWith(
      "Use Sync Manager: Purged cache for shopping integration y",
    );
  });

  it("should return getSyncDataByType filtered by type and sync data", () => {
    const lastSync = new Date("2026-01-26T12:00:00Z");
    syncDataRef.value = {
      c1: { data: [], lastSync, success: true },
      s1: { data: [], lastSync, success: true },
    };
    payloadData["calendar-events-c1"] = [];
    payloadData["shopping-lists-s1"] = [];
    const integrations = [
      { id: "c1", type: "calendar" },
      { id: "s1", type: "shopping" },
      { id: "t1", type: "todo" },
    ];
    const { getSyncDataByType } = useSyncManager();

    const calendar = getSyncDataByType("calendar", integrations);
    expect(calendar).toHaveLength(1);
    expect(calendar[0]).toMatchObject({
      integration: { id: "c1", type: "calendar" },
      syncData: { data: [], lastSync, success: true },
    });
    expect(calendar[0]!.cachedData).toEqual([]);

    const shopping = getSyncDataByType("shopping", integrations);
    expect(shopping).toHaveLength(1);
    expect(shopping[0]!.integration.id).toBe("s1");

    const todo = getSyncDataByType("todo", integrations);
    expect(todo).toHaveLength(0);
  });

  it("should return getSyncDataByType empty when no integrations list", () => {
    const { getSyncDataByType } = useSyncManager();
    expect(getSyncDataByType("calendar")).toEqual([]);
  });

  it("should return getCalendarSyncData, getTodoSyncData, getShoppingSyncData by type", () => {
    const lastSync = new Date("2026-01-26T12:00:00Z");
    syncDataRef.value = {
      c1: { data: [], lastSync, success: true },
      s1: { data: [], lastSync, success: true },
    };
    payloadData["calendar-events-c1"] = [];
    payloadData["shopping-lists-s1"] = [];
    const integrations = [
      { id: "c1", type: "calendar" },
      { id: "s1", type: "shopping" },
      { id: "t1", type: "todo" },
    ];
    const { getCalendarSyncData, getTodoSyncData, getShoppingSyncData } =
      useSyncManager();

    expect(getCalendarSyncData(integrations)).toHaveLength(1);
    expect(getCalendarSyncData(integrations)[0]!.integration.type).toBe(
      "calendar",
    );
    expect(getShoppingSyncData(integrations)).toHaveLength(1);
    expect(getShoppingSyncData(integrations)[0]!.integration.type).toBe(
      "shopping",
    );
    expect(getTodoSyncData(integrations)).toHaveLength(0);
  });
});
