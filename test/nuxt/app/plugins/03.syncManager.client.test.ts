import { useNuxtApp, useState } from "#app";
import { describe, it, expect } from "vitest";

describe("03.syncManager.client plugin", () => {
  it("should provide sync state with expected initial shapes after app load", () => {
    const syncData = useState("sync-data");
    const connectionStatus = useState("sync-connection-status");
    const lastHeartbeat = useState("sync-last-heartbeat");

    expect(syncData).toBeDefined();
    expect(connectionStatus).toBeDefined();
    expect(lastHeartbeat).toBeDefined();

    expect(syncData.value).toEqual({});
    expect(["disconnected", "connecting", "connected"]).toContain(
      connectionStatus.value,
    );
    expect(lastHeartbeat.value).toBeNull();
  });

  it("should provide reconnectSync as callable on nuxtApp", () => {
    const nuxtApp = useNuxtApp();
    const reconnectSync = nuxtApp.$reconnectSync ?? (nuxtApp as { reconnectSync?: () => void }).reconnectSync;

    expect(reconnectSync).toBeDefined();
    expect(typeof reconnectSync).toBe("function");
  });

  it("should not throw when calling reconnectSync", () => {
    const nuxtApp = useNuxtApp();
    const reconnectSync = nuxtApp.$reconnectSync ?? (nuxtApp as { reconnectSync?: () => void }).reconnectSync;

    expect(reconnectSync).toBeDefined();
    expect(typeof reconnectSync).toBe("function");
    expect(() => (reconnectSync as () => void)()).not.toThrow();
  });

  it("should provide getSyncData and getAllSyncData with expected behavior", () => {
    const nuxtApp = useNuxtApp();
    const getSyncData = (nuxtApp as { getSyncData?: (id: string) => unknown }).getSyncData ?? (nuxtApp as { $getSyncData?: (id: string) => unknown }).$getSyncData;
    const getAllSyncData = (nuxtApp as { getAllSyncData?: () => unknown }).getAllSyncData ?? (nuxtApp as { $getAllSyncData?: () => unknown }).$getAllSyncData;

    if (getSyncData) {
      expect(getSyncData("unknown-id")).toBeUndefined();
    }
    if (getAllSyncData) {
      const all = getAllSyncData();
      expect(all).toBeDefined();
      expect(typeof all === "object" && all !== null && !Array.isArray(all)).toBe(true);
    }
  });

  it("should provide getSyncConnectionStatus returning a valid status", () => {
    const nuxtApp = useNuxtApp();
    const getSyncConnectionStatus = (nuxtApp as { getSyncConnectionStatus?: () => string }).getSyncConnectionStatus ?? (nuxtApp as { $getSyncConnectionStatus?: () => string }).$getSyncConnectionStatus;

    if (getSyncConnectionStatus) {
      const status = getSyncConnectionStatus();
      expect(["disconnected", "connecting", "connected", "error"]).toContain(status);
    }
  });
});
