import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockIntegrationConfigs = [
  {
    type: "calendar",
    service: "iCal",
    syncInterval: 10,
    settingsFields: [],
    capabilities: [],
    icon: "",
    dialogFields: [],
  },
  {
    type: "shopping",
    service: "mealie",
    syncInterval: 10,
    settingsFields: [],
    capabilities: [],
    icon: "",
    dialogFields: [],
  },
  {
    type: "todo",
    service: "default",
    syncInterval: 10,
    settingsFields: [],
    capabilities: [],
    icon: "",
    dialogFields: [],
  },
];

const mockService = {
  initialize: vi.fn().mockResolvedValue(undefined),
  getEvents: vi.fn().mockResolvedValue([]),
};

vi.mock("../../../../app/integrations/integrationConfig", () => ({
  integrationConfigs: mockIntegrationConfigs,
}));

vi.mock("../../../../app/lib/prisma", () => ({
  default: {
    integration: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("../../../../app/types/integrations", () => ({
  createIntegrationService: vi.fn(),
  registerIntegration: vi.fn(),
}));

const createIntegrationServiceMock = vi.fn();

beforeEach(async () => {
  vi.clearAllMocks();
  const { createIntegrationService } = await import("../../../../app/types/integrations");
  vi.mocked(createIntegrationService).mockImplementation(createIntegrationServiceMock);
});

afterEach(async () => {
  const { syncManager } = await import("../../../../server/plugins/02.syncManager");
  syncManager.clearAllSyncIntervals();
});

describe("setupIntegrationSync", () => {
  it("sets up sync when config and service exist", async () => {
    createIntegrationServiceMock.mockResolvedValue(mockService);

    const { setupIntegrationSync, syncManager } = await import("../../../../server/plugins/02.syncManager");

    const integration = {
      id: "int-1",
      name: "Test",
      type: "calendar" as const,
      service: "iCal" as const,
      enabled: true,
      apiKey: null,
      baseUrl: null,
      icon: null,
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await setupIntegrationSync(integration, false);

    expect(createIntegrationServiceMock).toHaveBeenCalledWith(integration);
    expect(mockService.initialize).toHaveBeenCalled();
    expect(syncManager.getActiveSyncIntervals()).toContain("int-1");
  });

  it("performs immediate sync when performImmediateSync is true", async () => {
    createIntegrationServiceMock.mockResolvedValue(mockService);

    const { setupIntegrationSync, syncManager } = await import("../../../../server/plugins/02.syncManager");

    const integration = {
      id: "int-2",
      name: "Test",
      type: "calendar" as const,
      service: "iCal" as const,
      enabled: true,
      apiKey: null,
      baseUrl: null,
      icon: null,
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await setupIntegrationSync(integration, true);

    expect(mockService.getEvents).toHaveBeenCalled();
    expect(syncManager.getActiveSyncIntervals()).toContain("int-2");
  });

  it("does nothing when no config matches", async () => {
    const { setupIntegrationSync, syncManager } = await import("../../../../server/plugins/02.syncManager");

    const integration = {
      id: "int-3",
      name: "Test",
      type: "calendar" as const,
      service: "unknown" as const,
      enabled: true,
      apiKey: null,
      baseUrl: null,
      icon: null,
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await setupIntegrationSync(integration, false);

    expect(createIntegrationServiceMock).not.toHaveBeenCalled();
    expect(syncManager.getActiveSyncIntervals()).not.toContain("int-3");
  });

  it("does nothing when createIntegrationService returns null", async () => {
    createIntegrationServiceMock.mockResolvedValue(null);

    const { setupIntegrationSync, syncManager } = await import("../../../../server/plugins/02.syncManager");

    const integration = {
      id: "int-4",
      name: "Test",
      type: "calendar" as const,
      service: "iCal" as const,
      enabled: true,
      apiKey: null,
      baseUrl: null,
      icon: null,
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await setupIntegrationSync(integration, false);

    expect(syncManager.getActiveSyncIntervals()).not.toContain("int-4");
  });
});

describe("registerClient / unregisterClient", () => {
  it("registers client and updates count", async () => {
    const { registerClient, unregisterClient, syncManager } = await import("../../../../server/plugins/02.syncManager");

    const event = {
      node: { res: { write: vi.fn() } },
      context: {},
    } as unknown as Parameters<typeof registerClient>[0];

    expect(syncManager.getConnectedClientsCount()).toBe(0);
    registerClient(event);
    expect(syncManager.getConnectedClientsCount()).toBe(1);
    unregisterClient(event);
    expect(syncManager.getConnectedClientsCount()).toBe(0);
  });
});

describe("syncManager", () => {
  it("clearIntegrationSync removes interval for given id", async () => {
    createIntegrationServiceMock.mockResolvedValue(mockService);

    const { setupIntegrationSync, syncManager } = await import("../../../../server/plugins/02.syncManager");

    const integration = {
      id: "int-clear",
      name: "Test",
      type: "calendar" as const,
      service: "iCal" as const,
      enabled: true,
      apiKey: null,
      baseUrl: null,
      icon: null,
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await setupIntegrationSync(integration, false);
    expect(syncManager.getActiveSyncIntervals()).toContain("int-clear");
    syncManager.clearIntegrationSync("int-clear");
    expect(syncManager.getActiveSyncIntervals()).not.toContain("int-clear");
  });
});

describe("sendCachedSyncData", () => {
  it("returns without writing when integration not found", async () => {
    const prisma = (await import("../../../../app/lib/prisma")).default;
    vi.mocked(prisma.integration.findUnique).mockResolvedValue(null);

    const { sendCachedSyncData } = await import("../../../../server/plugins/02.syncManager");

    const writeMock = vi.fn();
    const event = {
      node: { res: { write: writeMock } },
    } as unknown as Parameters<typeof sendCachedSyncData>[0];

    const syncInterval = {
      integrationId: "int-missing",
      interval: setInterval(() => {}, 60000),
      lastSync: new Date(),
      config: { type: "calendar", service: "iCal", syncInterval: 10, capabilities: [] },
    };

    await sendCachedSyncData(event, "int-missing", syncInterval);

    expect(writeMock).not.toHaveBeenCalled();
    clearInterval(syncInterval.interval);
  });

  it("returns without writing when service not in map", async () => {
    const prisma = (await import("../../../../app/lib/prisma")).default;
    const integration = {
      id: "int-orphan",
      name: "Orphan",
      type: "calendar" as const,
      service: "iCal" as const,
      enabled: true,
      apiKey: null,
      baseUrl: null,
      icon: null,
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(prisma.integration.findUnique).mockResolvedValue(integration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);

    const { sendCachedSyncData } = await import("../../../../server/plugins/02.syncManager");

    const writeMock = vi.fn();
    const event = {
      node: { res: { write: writeMock } },
    } as unknown as Parameters<typeof sendCachedSyncData>[0];

    const syncInterval = {
      integrationId: "int-orphan",
      interval: setInterval(() => {}, 60000),
      lastSync: new Date(),
      config: { type: "calendar", service: "iCal", syncInterval: 10, capabilities: [] },
    };

    await sendCachedSyncData(event, "int-orphan", syncInterval);

    expect(writeMock).not.toHaveBeenCalled();
    clearInterval(syncInterval.interval);
  });

  it("writes integration_sync payload for calendar when integration and service exist", async () => {
    createIntegrationServiceMock.mockResolvedValue(mockService);

    const { setupIntegrationSync, sendCachedSyncData, syncManager } = await import("../../../../server/plugins/02.syncManager");

    const integration = {
      id: "int-send",
      name: "Send Test",
      type: "calendar" as const,
      service: "iCal" as const,
      enabled: true,
      apiKey: null,
      baseUrl: null,
      icon: null,
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await setupIntegrationSync(integration, false);

    const prisma = (await import("../../../../app/lib/prisma")).default;
    vi.mocked(prisma.integration.findUnique).mockResolvedValue(integration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);

    const writeMock = vi.fn();
    const event = {
      node: { res: { write: writeMock } },
    } as unknown as Parameters<typeof sendCachedSyncData>[0];

    const syncIntervals = syncManager.getSyncIntervals();
    const syncInterval = syncIntervals.get("int-send");
    expect(syncInterval).toBeDefined();

    await sendCachedSyncData(event, "int-send", syncInterval!);

    expect(writeMock).toHaveBeenCalledTimes(1);
    const written = writeMock.mock.calls[0]?.[0];
    expect(written).toContain("integration_sync");
    const parsed = JSON.parse((written as string).replace(/^data: /, "").replace(/\n\n$/, ""));
    expect(parsed.type).toBe("integration_sync");
    expect(parsed.integrationId).toBe("int-send");
    expect(parsed.integrationType).toBe("calendar");
    expect(parsed.data).toEqual([]);

    syncManager.clearIntegrationSync("int-send");
  });

  it("catches and logs when service getEvents throws", async () => {
    const failingService = {
      initialize: vi.fn().mockResolvedValue(undefined),
      getEvents: vi.fn().mockRejectedValue(new Error("fetch failed")),
    };
    createIntegrationServiceMock.mockResolvedValue(failingService);

    const { setupIntegrationSync, sendCachedSyncData, syncManager } = await import("../../../../server/plugins/02.syncManager");

    const integration = {
      id: "int-fail",
      name: "Fail",
      type: "calendar" as const,
      service: "iCal" as const,
      enabled: true,
      apiKey: null,
      baseUrl: null,
      icon: null,
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await setupIntegrationSync(integration, false);

    const prisma = (await import("../../../../app/lib/prisma")).default;
    vi.mocked(prisma.integration.findUnique).mockResolvedValue(integration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);

    const writeMock = vi.fn();
    const event = {
      node: { res: { write: writeMock } },
    } as unknown as Parameters<typeof sendCachedSyncData>[0];

    const syncIntervals = syncManager.getSyncIntervals();
    const syncInterval = syncIntervals.get("int-fail")!;

    await sendCachedSyncData(event, "int-fail", syncInterval);

    expect(writeMock).not.toHaveBeenCalled();
    syncManager.clearIntegrationSync("int-fail");
  });

  it("writes integration_sync payload for shopping when integration and service exist", async () => {
    const mockLists = [{ id: "list-1", name: "Groceries", items: [], itemCount: 0 }];
    const shoppingService = {
      initialize: vi.fn().mockResolvedValue(undefined),
      getShoppingLists: vi.fn().mockResolvedValue(mockLists),
    };
    createIntegrationServiceMock.mockResolvedValue(shoppingService);

    const { setupIntegrationSync, sendCachedSyncData, syncManager } = await import("../../../../server/plugins/02.syncManager");

    const integration = {
      id: "int-shop",
      name: "Shop",
      type: "shopping" as const,
      service: "mealie" as const,
      enabled: true,
      apiKey: null,
      baseUrl: null,
      icon: null,
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await setupIntegrationSync(integration, false);

    const prisma = (await import("../../../../app/lib/prisma")).default;
    vi.mocked(prisma.integration.findUnique).mockResolvedValue(integration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);

    const writeMock = vi.fn();
    const event = {
      node: { res: { write: writeMock } },
    } as unknown as Parameters<typeof sendCachedSyncData>[0];

    const syncIntervals = syncManager.getSyncIntervals();
    const syncInterval = syncIntervals.get("int-shop");
    expect(syncInterval).toBeDefined();

    await sendCachedSyncData(event, "int-shop", syncInterval!);

    expect(writeMock).toHaveBeenCalledTimes(1);
    const written = writeMock.mock.calls[0]?.[0];
    expect(written).toContain("integration_sync");
    const parsed = JSON.parse((written as string).replace(/^data: /, "").replace(/\n\n$/, ""));
    expect(parsed.type).toBe("integration_sync");
    expect(parsed.integrationId).toBe("int-shop");
    expect(parsed.integrationType).toBe("shopping");
    expect(parsed.data).toEqual(mockLists);

    syncManager.clearIntegrationSync("int-shop");
  });

  it("writes integration_sync payload for todo when integration and service exist", async () => {
    const mockTodos = [{ id: "col-1", name: "Column", todos: [], order: 0 }];
    const todoService = {
      initialize: vi.fn().mockResolvedValue(undefined),
      getTodos: vi.fn().mockResolvedValue(mockTodos),
    };
    createIntegrationServiceMock.mockResolvedValue(todoService);

    const { setupIntegrationSync, sendCachedSyncData, syncManager } = await import("../../../../server/plugins/02.syncManager");

    const integration = {
      id: "int-todo",
      name: "Todo",
      type: "todo" as const,
      service: "default" as const,
      enabled: true,
      apiKey: null,
      baseUrl: null,
      icon: null,
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await setupIntegrationSync(integration, false);

    const prisma = (await import("../../../../app/lib/prisma")).default;
    vi.mocked(prisma.integration.findUnique).mockResolvedValue(integration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);

    const writeMock = vi.fn();
    const event = {
      node: { res: { write: writeMock } },
    } as unknown as Parameters<typeof sendCachedSyncData>[0];

    const syncIntervals = syncManager.getSyncIntervals();
    const syncInterval = syncIntervals.get("int-todo");
    expect(syncInterval).toBeDefined();

    await sendCachedSyncData(event, "int-todo", syncInterval!);

    expect(writeMock).toHaveBeenCalledTimes(1);
    const written = writeMock.mock.calls[0]?.[0];
    expect(written).toContain("integration_sync");
    const parsed = JSON.parse((written as string).replace(/^data: /, "").replace(/\n\n$/, ""));
    expect(parsed.type).toBe("integration_sync");
    expect(parsed.integrationId).toBe("int-todo");
    expect(parsed.integrationType).toBe("todo");
    expect(parsed.data).toEqual(mockTodos);

    syncManager.clearIntegrationSync("int-todo");
  });
});

describe("syncManager.getIntegrationById", () => {
  it("returns integration when found", async () => {
    const prisma = (await import("../../../../app/lib/prisma")).default;
    const mockIntegration = {
      id: "some-id",
      name: "Test",
      type: "calendar" as const,
      service: "ical" as const,
      enabled: true,
      apiKey: null,
      baseUrl: null,
      icon: null,
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(prisma.integration.findUnique).mockResolvedValue(mockIntegration as Awaited<ReturnType<typeof prisma.integration.findUnique>>);

    const { syncManager } = await import("../../../../server/plugins/02.syncManager");

    const result = await syncManager.getIntegrationById("some-id");

    expect(prisma.integration.findUnique).toHaveBeenCalledWith({ where: { id: "some-id" } });
    expect(result).toEqual(mockIntegration);
  });
});
