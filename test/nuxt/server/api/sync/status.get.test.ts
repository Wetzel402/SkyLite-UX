import { createMockH3Event } from "~~/test/nuxt/mocks/h3Event";
import { useH3TestUtils } from "~~/test/nuxt/setup";
import { describe, expect, it, vi } from "vitest";

import { syncManager } from "~~/server/plugins/02.syncManager";

const { defineEventHandler } = useH3TestUtils();

import handler from "~~/server/api/sync/status.get";

vi.mock("~~/server/plugins/02.syncManager", () => ({
  syncManager: {
    getConnectedClientsCount: vi.fn(),
    getActiveSyncIntervals: vi.fn(),
  },
}));

describe("gET /api/sync/status", () => {

  describe("returns sync status successfully", () => {
    it("returns status with connected clients and active intervals", async () => {
      const mockConnectedClients = 2;
      const mockActiveIntervals = ["integration-1", "integration-2"];

      vi.mocked(syncManager.getConnectedClientsCount).mockReturnValue(
        mockConnectedClients,
      );
      vi.mocked(syncManager.getActiveSyncIntervals).mockReturnValue(
        mockActiveIntervals,
      );

      const event = createMockH3Event({});

      const response = await handler(event);

      expect(syncManager.getConnectedClientsCount).toHaveBeenCalled();
      expect(syncManager.getActiveSyncIntervals).toHaveBeenCalled();

      expect(response).toEqual({
        connectedClients: mockConnectedClients,
        activeSyncIntervals: mockActiveIntervals,
        timestamp: expect.any(Date),
      });
    });

    it("returns status with no connected clients", async () => {
      vi.mocked(syncManager.getConnectedClientsCount).mockReturnValue(0);
      vi.mocked(syncManager.getActiveSyncIntervals).mockReturnValue([]);

      const event = createMockH3Event({});

      const response = await handler(event);

      expect(response.connectedClients).toBe(0);
      expect(response.activeSyncIntervals).toEqual([]);
    });
  });

  describe("error handling", () => {
    it("handles errors when getting status", async () => {
      vi.mocked(syncManager.getConnectedClientsCount).mockImplementation(
        () => {
          throw new Error("Sync manager error");
        },
      );

      const event = createMockH3Event({});

      await expect(handler(event)).rejects.toThrow();
    });
  });
});
