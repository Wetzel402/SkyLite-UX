import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";

import type { Integration } from "~/types/database";

vi.mock("consola", () => ({
  consola: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const testDate = new Date("2026-01-26T12:00:00Z");

const {
  mockUseIntegrations,
  mockUseSyncManager,
  integrationsRef,
  getCachedIntegrationDataFn,
} = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref } = require("vue");
  const intRef = ref([]);
  const getCachedFn = vi.fn(() => null as unknown);

  const useIntegrationsMock = () => ({
    integrations: intRef,
    loading: ref(false),
    error: ref(null),
    getService: vi.fn(() => null),
  });

  const useSyncManagerMock = () => ({
    getShoppingSyncData: vi.fn(() => []),
    getCachedIntegrationData: getCachedFn,
  });

  return {
    mockUseIntegrations: useIntegrationsMock,
    mockUseSyncManager: useSyncManagerMock,
    integrationsRef: intRef,
    getCachedIntegrationDataFn: getCachedFn,
  };
});

mockNuxtImport("useIntegrations", () => mockUseIntegrations);
mockNuxtImport("useSyncManager", () => mockUseSyncManager);

import { useShoppingIntegrations } from "../../../../app/composables/useShoppingIntegrations";

describe("useShoppingIntegrations", () => {
  const mockShoppingIntegration: Integration = {
    id: "int-shop-1",
    name: "Mealie",
    type: "shopping",
    service: "mealie",
    apiKey: null,
    baseUrl: null,
    icon: null,
    enabled: true,
    settings: null,
    createdAt: testDate,
    updatedAt: testDate,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    integrationsRef.value = [mockShoppingIntegration];
    getCachedIntegrationDataFn.mockReturnValue(null);
  });

  it("should return empty allShoppingLists when getCachedIntegrationData returns null", () => {
    const { shoppingLists } = useShoppingIntegrations();
    expect(shoppingLists.value).toEqual([]);
  });

  it("should merge integration lists from getCachedIntegrationData into allShoppingLists", () => {
    const cachedLists = [
      {
        id: "list-1",
        name: "From Mealie",
        order: 1,
        createdAt: testDate,
        updatedAt: testDate,
        items: [],
        _count: { items: 0 },
      },
    ];
    getCachedIntegrationDataFn.mockReturnValue(cachedLists);

    const { shoppingLists } = useShoppingIntegrations();

    expect(shoppingLists.value).toHaveLength(1);
    expect(shoppingLists.value[0]!.id).toBe("list-1");
    expect(shoppingLists.value[0]!.source).toBe("integration");
    expect(shoppingLists.value[0]!.integrationId).toBe("int-shop-1");
    expect(shoppingLists.value[0]!.integrationName).toBe("Mealie");
  });

  it("should filter to shopping type and enabled in shoppingIntegrations", () => {
    const { shoppingIntegrations } = useShoppingIntegrations();
    expect(shoppingIntegrations.value).toHaveLength(1);
    expect(shoppingIntegrations.value[0]!.type).toBe("shopping");
    expect(shoppingIntegrations.value[0]!.enabled).toBe(true);
  });

  it("should expose integrationsLoading and integrationsError", () => {
    const { integrationsLoading, integrationsError } = useShoppingIntegrations();
    expect(integrationsLoading.value).toBe(false);
    expect(integrationsError.value).toBeNull();
  });
});
