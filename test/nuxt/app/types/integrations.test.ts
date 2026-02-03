import { describe, it, expect, vi, beforeEach } from "vitest";

const mockConsola = {
  warn: vi.fn(),
  error: vi.fn(),
};

vi.mock("consola", () => ({
  default: mockConsola,
}));

const mockFactory = vi.fn();
const getServiceFactoriesMock = vi.fn();

vi.mock("~/integrations/integrationConfig", () => ({
  getServiceFactories: () => getServiceFactoriesMock(),
  integrationConfigs: [{ type: "calendar", service: "iCal" }],
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createIntegrationService", () => {
  it("returns service from matching factory and calls factory with expected args", async () => {
    const mockService = {
      initialize: vi.fn().mockResolvedValue(undefined),
      validate: vi.fn().mockResolvedValue(true),
      getStatus: vi.fn().mockResolvedValue({ isConnected: true, lastChecked: new Date() }),
    };
    getServiceFactoriesMock.mockReturnValue([
      {
        key: "calendar:iCal",
        factory: mockFactory,
      },
    ]);
    mockFactory.mockResolvedValue(mockService);

    const { createIntegrationService } = await import("~/types/integrations");
    const integration = {
      id: "int-1",
      name: "iCal",
      type: "calendar",
      service: "iCal",
      enabled: true,
      apiKey: "key",
      baseUrl: "https://example.com",
      icon: null,
      settings: { url: "https://cal.example.com" },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await createIntegrationService(integration);

    expect(result).toBe(mockService);
    expect(mockFactory).toHaveBeenCalledWith(
      "int-1",
      "key",
      "https://example.com",
      { url: "https://cal.example.com" },
    );
  });

  it("returns null and warns when no factory matches", async () => {
    getServiceFactoriesMock.mockReturnValue([
      { key: "calendar:google", factory: vi.fn() },
    ]);

    const { createIntegrationService } = await import("~/types/integrations");
    const integration = {
      id: "int-1",
      name: "Unknown",
      type: "calendar",
      service: "unknown",
      enabled: true,
      apiKey: null,
      baseUrl: null,
      icon: null,
      settings: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await createIntegrationService(integration);

    expect(result).toBeNull();
    expect(mockConsola.warn).toHaveBeenCalledWith(
      "No service factory found for integration type: calendar:unknown",
    );
  });

  it("returns null and errors when factory throws synchronously", async () => {
    const err = new Error("Factory failed");
    getServiceFactoriesMock.mockReturnValue([
      {
        key: "calendar:iCal",
        factory: vi.fn(() => { throw err; }),
      },
    ]);

    const { createIntegrationService } = await import("~/types/integrations");
    const integration = {
      id: "int-1",
      name: "iCal",
      type: "calendar",
      service: "iCal",
      enabled: true,
      apiKey: null,
      baseUrl: null,
      icon: null,
      settings: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await createIntegrationService(integration);

    expect(result).toBeNull();
    expect(mockConsola.error).toHaveBeenCalledWith(
      "Failed to create integration service for calendar:iCal:",
      err,
    );
  });
});
