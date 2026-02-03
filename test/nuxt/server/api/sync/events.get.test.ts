import type { H3Event } from "h3";

import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { syncManager, sendCachedSyncData } from "~~/server/plugins/02.syncManager";

const { defineEventHandler } = useH3TestUtils();

vi.mock("h3", async () => {
  const actual = await vi.importActual("h3");
  return {
    ...actual,
    getQuery: (event: H3Event) => event?.context?.query || {},
    setResponseHeaders: vi.fn((event: H3Event, headers: Record<string, string>) => {
      if (event?.node?.res) {
        if (typeof event.node.res.setHeader !== "function") {
          event.node.res.setHeader = vi.fn();
        }
        Object.entries(headers).forEach(([key, value]) => {
          event.node.res.setHeader(key, value);
        });
      }
    }),
  };
});

import handler from "~~/server/api/sync/events.get";

vi.mock("~~/server/plugins/02.syncManager", () => ({
  syncManager: {
    registerClient: vi.fn(), // Should not throw
    unregisterClient: vi.fn(),
    getConnectedClientsCount: vi.fn(),
    getActiveSyncIntervals: vi.fn(),
    getSyncIntervals: vi.fn(),
  },
  sendCachedSyncData: vi.fn(),
}));

describe("gET /api/sync/events", () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockEventWithStream = (query: Record<string, string> = {}) => {
    const writeMock = vi.fn();
    const setHeaderMock = vi.fn();
    const endMock = vi.fn();
    const closeCallbacks: Array<() => void> = [];
    const errorCallbacks: Array<(err: Error) => void> = [];

    const onMock = vi.fn((event: string, callback: () => void | ((err: Error) => void)) => {
      if (event === "close") {
        closeCallbacks.push(callback as () => void);
      }
      if (event === "error") {
        errorCallbacks.push(callback as (err: Error) => void);
      }
    });

    const triggerClose = () => {
      closeCallbacks.forEach(cb => cb());
    };

    const triggerError = (err: Error) => {
      errorCallbacks.forEach(cb => cb(err));
    };

    const resMock = {
      write: writeMock,
      setHeader: setHeaderMock,
      end: endMock,
    };

    const event = createMockH3Event({
      query,
    });

    event.node.res = resMock as unknown as typeof event.node.res;
    event.node.req = {
      on: onMock,
    } as unknown as typeof event.node.req;

    if (!event.node.res.setHeader) {
      (event.node.res as unknown as { setHeader?: typeof setHeaderMock }).setHeader = setHeaderMock;
    }

    return { event, writeMock, onMock, setHeaderMock, triggerClose, triggerError };
  };

  describe("establishes SSE connection successfully", () => {
    it("sends connection established event", async () => {
      const { event, writeMock, triggerClose } = createMockEventWithStream();

      vi.mocked(syncManager.getActiveSyncIntervals).mockReturnValue([]);
      vi.mocked(syncManager.getConnectedClientsCount).mockReturnValue(0);
      vi.mocked(syncManager.getSyncIntervals).mockReturnValue(
        new Map(),
      );

      let handlerError: Error | null = null;
      const handlerPromise = handler(event).catch((err) => {
        handlerError = err;
      });

      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setTimeout(resolve, 20));
      
      if (handlerError) {
        throw handlerError;
      }

      expect(syncManager.registerClient).toHaveBeenCalledWith(event);

      const writeCalls = writeMock.mock.calls;
      expect(writeCalls.length).toBeGreaterThan(0);

      const firstCall = writeCalls[0]?.[0];
      expect(firstCall).toBeDefined();
      expect(firstCall).toContain("connection_established");

      triggerClose();
      await new Promise(resolve => setTimeout(resolve, 10));
    }, 10000); // Increase timeout to 10s

    it("sends sync status event", async () => {
      const { event, writeMock, triggerClose } = createMockEventWithStream();

      const mockActiveIntervals = ["integration-1", "integration-2"];
      vi.mocked(syncManager.getActiveSyncIntervals).mockReturnValue(
        mockActiveIntervals,
      );
      vi.mocked(syncManager.getConnectedClientsCount).mockReturnValue(1);
      vi.mocked(syncManager.getSyncIntervals).mockReturnValue(
        new Map(),
      );

      handler(event).catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 20));

      const writeCalls = writeMock.mock.calls;
      const statusCall = writeCalls.find(call =>
        call[0]?.includes("sync_status"),
      );

      expect(statusCall).toBeDefined();
      if (statusCall) {
        const statusData = JSON.parse(
          statusCall[0].replace("data: ", "").replace("\n\n", ""),
        );
        expect(statusData.type).toBe("sync_status");
        expect(statusData.activeIntegrations).toEqual(mockActiveIntervals);
      }

      triggerClose();
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    it("sends cached sync data when client timestamp is older", async () => {
      const { event, writeMock, triggerClose } = createMockEventWithStream();

      const clientTimestamp = new Date("2025-01-01T00:00:00Z");
      const serverLastSync = new Date("2025-01-02T00:00:00Z");

      const mockSyncInterval = {
        integrationId: "integration-1",
        interval: setInterval(() => {}, 1000),
        lastSync: serverLastSync,
        config: {
          type: "calendar" as const,
          service: "ical" as const,
          syncInterval: 60,
          capabilities: [] as string[],
        },
      };

      const syncIntervalsMap = new Map([
        ["integration-1", mockSyncInterval],
      ]);

      vi.mocked(syncManager.getActiveSyncIntervals).mockReturnValue([
        "integration-1",
      ]);
      vi.mocked(syncManager.getConnectedClientsCount).mockReturnValue(1);
      vi.mocked(syncManager.getSyncIntervals).mockReturnValue(
        syncIntervalsMap,
      );

      const eventWithQuery = createMockH3Event({
        query: {
          "integration-1": clientTimestamp.toISOString(),
        },
      });

      eventWithQuery.node.res = event.node.res;
      eventWithQuery.node.req = event.node.req;

      handler(eventWithQuery).catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(sendCachedSyncData).toHaveBeenCalledWith(
        eventWithQuery,
        "integration-1",
        mockSyncInterval,
      );

      triggerClose();
      await new Promise(resolve => setTimeout(resolve, 10));
    });
  });

  describe("invalid timestamp in query", () => {
    it("does not throw and continues flow when timestamp is invalid", async () => {
      const { event, writeMock, triggerClose } = createMockEventWithStream({
        "integration-1": "not-a-valid-date",
      });

      vi.mocked(syncManager.getActiveSyncIntervals).mockReturnValue([]);
      vi.mocked(syncManager.getConnectedClientsCount).mockReturnValue(0);
      vi.mocked(syncManager.getSyncIntervals).mockReturnValue(new Map());

      let handlerError: Error | null = null;
      handler(event).catch((err) => { handlerError = err; });

      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(handlerError).toBeNull();
      expect(syncManager.registerClient).toHaveBeenCalledWith(event);
      expect(writeMock.mock.calls.length).toBeGreaterThan(0);

      triggerClose();
      await new Promise(resolve => setTimeout(resolve, 10));
    });
  });

  describe("close and error handlers", () => {
    it("calls unregisterClient when req close is triggered", async () => {
      const { event, triggerClose } = createMockEventWithStream();

      vi.mocked(syncManager.getActiveSyncIntervals).mockReturnValue([]);
      vi.mocked(syncManager.getConnectedClientsCount).mockReturnValue(0);
      vi.mocked(syncManager.getSyncIntervals).mockReturnValue(new Map());

      handler(event).catch(() => {});
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(syncManager.unregisterClient).not.toHaveBeenCalled();
      triggerClose();
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(syncManager.unregisterClient).toHaveBeenCalledWith(event);
    });

    it("calls unregisterClient when req error is triggered", async () => {
      const { event, triggerError } = createMockEventWithStream();

      vi.mocked(syncManager.getActiveSyncIntervals).mockReturnValue([]);
      vi.mocked(syncManager.getConnectedClientsCount).mockReturnValue(0);
      vi.mocked(syncManager.getSyncIntervals).mockReturnValue(new Map());

      handler(event).catch(() => {});
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(syncManager.unregisterClient).not.toHaveBeenCalled();
      triggerError(new Error("some error"));
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(syncManager.unregisterClient).toHaveBeenCalledWith(event);
    });

    it("calls unregisterClient when req error is triggered with aborted message", async () => {
      const { event, triggerError } = createMockEventWithStream();

      vi.mocked(syncManager.getActiveSyncIntervals).mockReturnValue([]);
      vi.mocked(syncManager.getConnectedClientsCount).mockReturnValue(0);
      vi.mocked(syncManager.getSyncIntervals).mockReturnValue(new Map());

      handler(event).catch(() => {});
      await new Promise(resolve => setImmediate(resolve));
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(syncManager.unregisterClient).not.toHaveBeenCalled();
      triggerError(new Error("aborted"));
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(syncManager.unregisterClient).toHaveBeenCalledWith(event);
    });
  });

  describe("error handling", () => {
    it("handles errors when setting up sync stream", async () => {
      const event = createMockH3Event({
        query: {},
      });

      vi.mocked(syncManager.registerClient).mockImplementation(() => {
        throw new Error("Registration error");
      });

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
