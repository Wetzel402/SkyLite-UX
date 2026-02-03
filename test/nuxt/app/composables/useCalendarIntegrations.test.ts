import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";

import type { CalendarEvent } from "~/types/calendar";
import type { Integration } from "~/types/database";

vi.mock("consola", () => ({
  consola: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const testDate = new Date("2026-01-26T12:00:00Z");

const {
  mockUseCalendar,
  mockUseIntegrations,
  mockUseSyncManager,
  mockUseUsers,
  integrationsRef,
  getCalendarSyncDataRef,
  loadingRef,
  errorRef,
  getIntegrationEventsMap,
  getServiceMap,
} = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref } = require("vue");
  const intRef = ref([]);
  const syncDataRef = ref([]);
  const loadRef = ref(false);
  const errRef = ref(null as string | null);
  const eventsMap = new Map<string, CalendarEvent[]>();
  const serviceMap = new Map<string, object>();

  const useCalendarMock = () => ({
    combineEvents: (events: unknown[]) => events,
    getEventUserColors: () => "#06b6d4",
    getIntegrationEvents: (id: string) => eventsMap.get(id) ?? [],
  });

  const useIntegrationsMock = () => ({
    integrations: intRef,
    loading: loadRef,
    error: errRef,
    getService: vi.fn((id: string) => serviceMap.get(id) ?? null),
  });

  const useSyncManagerMock = () => ({
    getCalendarSyncData: vi.fn(() => syncDataRef.value),
  });

  const useUsersMock = () => ({
    users: ref([]),
  });

  return {
    mockUseCalendar: useCalendarMock,
    mockUseIntegrations: useIntegrationsMock,
    mockUseSyncManager: useSyncManagerMock,
    mockUseUsers: useUsersMock,
    integrationsRef: intRef,
    getCalendarSyncDataRef: syncDataRef,
    loadingRef: loadRef,
    errorRef: errRef,
    getIntegrationEventsMap: () => eventsMap,
    getServiceMap: () => serviceMap,
  };
});

mockNuxtImport("useCalendar", () => mockUseCalendar);
mockNuxtImport("useIntegrations", () => mockUseIntegrations);
mockNuxtImport("useSyncManager", () => mockUseSyncManager);
mockNuxtImport("useUsers", () => mockUseUsers);

import { useCalendarIntegrations } from "../../../../app/composables/useCalendarIntegrations";

describe("useCalendarIntegrations", () => {
  const mockCalendarIntegration: Integration = {
    id: "int-cal-1",
    name: "Test Calendar",
    type: "calendar",
    service: "ical",
    apiKey: null,
    baseUrl: null,
    icon: null,
    enabled: true,
    settings: null,
    createdAt: testDate,
    updatedAt: testDate,
  };

  const mockShoppingIntegration: Integration = {
    id: "int-shop-1",
    name: "Test Shopping",
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
    integrationsRef.value = [mockCalendarIntegration, mockShoppingIntegration];
    getCalendarSyncDataRef.value = [];
    loadingRef.value = false;
    errorRef.value = null;
    getIntegrationEventsMap().clear();
    getServiceMap().clear();
  });

  it("should filter calendar integrations by type and enabled", () => {
    const { calendarIntegrations } = useCalendarIntegrations();
    expect(calendarIntegrations.value).toHaveLength(1);
    expect(calendarIntegrations.value[0]!.id).toBe("int-cal-1");
    expect(calendarIntegrations.value[0]!.type).toBe("calendar");
  });

  it("should return empty calendar integrations when none are calendar type", () => {
    integrationsRef.value = [mockShoppingIntegration];
    const { calendarIntegrations } = useCalendarIntegrations();
    expect(calendarIntegrations.value).toHaveLength(0);
  });

  it("should exclude disabled integrations from calendarIntegrations", () => {
    integrationsRef.value = [{ ...mockCalendarIntegration, enabled: false }];
    const { calendarIntegrations } = useCalendarIntegrations();
    expect(calendarIntegrations.value).toHaveLength(0);
  });

  it("should expose integrationsLoading from useIntegrations", () => {
    const { integrationsLoading } = useCalendarIntegrations();
    expect(integrationsLoading.value).toBe(false);
  });

  it("should expose integrationsError from useIntegrations", () => {
    const { integrationsError } = useCalendarIntegrations();
    expect(integrationsError.value).toBeNull();
  });

  it("should return getProcessedIntegrationEvents empty when integration not found", () => {
    const { getProcessedIntegrationEvents } = useCalendarIntegrations();
    expect(getProcessedIntegrationEvents("non-existent")).toEqual([]);
  });

  it("should reflect loading when useIntegrations loading is true", () => {
    loadingRef.value = true;
    const { integrationsLoading } = useCalendarIntegrations();
    expect(integrationsLoading.value).toBe(true);
  });

  it("should reflect error when useIntegrations error is set", () => {
    errorRef.value = "Failed to load";
    const { integrationsError } = useCalendarIntegrations();
    expect(integrationsError.value).toBe("Failed to load");
  });

  describe("getProcessedIntegrationEvents", () => {
    it("should return processed events when integration has events", () => {
      const events: CalendarEvent[] = [
        {
          id: "e1",
          title: "Event",
          start: testDate,
          end: testDate,
        },
      ];
      getIntegrationEventsMap().set("int-cal-1", events);
      const { getProcessedIntegrationEvents } = useCalendarIntegrations();
      const result = getProcessedIntegrationEvents("int-cal-1");
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe("e1");
      expect(result[0]!.integrationId).toBe("int-cal-1");
      expect(result[0]!.sourceCalendars).toBeDefined();
    });
  });

  describe("getCalendarAccessRole and canEditCalendar", () => {
    it("should return null when integration not found", () => {
      const { getCalendarAccessRole } = useCalendarIntegrations();
      expect(getCalendarAccessRole("missing", "cal1")).toBeNull();
    });

    it("should return accessRole from settings.calendars when present", () => {
      const withCalendars = {
        ...mockCalendarIntegration,
        settings: {
          calendars: [
            { id: "cal1", name: "Cal", enabled: true, accessRole: "write" as const },
          ],
        },
      };
      integrationsRef.value = [withCalendars];
      const { getCalendarAccessRole, canEditCalendar } =
        useCalendarIntegrations();
      expect(getCalendarAccessRole("int-cal-1", "cal1")).toBe("write");
      expect(canEditCalendar("int-cal-1", "cal1")).toBe(true);
    });

    it("should return read and canEdit false when accessRole is read", () => {
      const withCalendars = {
        ...mockCalendarIntegration,
        settings: {
          calendars: [
            { id: "cal1", name: "Cal", enabled: true, accessRole: "read" as const },
          ],
        },
      };
      integrationsRef.value = [withCalendars];
      const { getCalendarAccessRole, canEditCalendar } =
        useCalendarIntegrations();
      expect(getCalendarAccessRole("int-cal-1", "cal1")).toBe("read");
      expect(canEditCalendar("int-cal-1", "cal1")).toBe(false);
    });
  });

  describe("service methods", () => {
    it("updateCalendarEvent throws when service not found", async () => {
      const { updateCalendarEvent } = useCalendarIntegrations();
      await expect(
        updateCalendarEvent("missing", "e1", { title: "x" }),
      ).rejects.toThrow("Integration service not found");
    });

    it("updateCalendarEvent throws when service has no updateEvent", async () => {
      getServiceMap().set("int-cal-1", { getEvents: async () => [] });
      const { updateCalendarEvent } = useCalendarIntegrations();
      await expect(
        updateCalendarEvent("int-cal-1", "e1", { title: "x" }),
      ).rejects.toThrow("does not support updating");
    });

    it("updateCalendarEvent succeeds when service has updateEvent", async () => {
      const updated = {
        id: "e1",
        title: "Updated",
        start: testDate,
        end: testDate,
      };
      getServiceMap().set("int-cal-1", {
        getEvents: async () => [],
        updateEvent: vi.fn().mockResolvedValue(updated),
      });
      const { updateCalendarEvent } = useCalendarIntegrations();
      const result = await updateCalendarEvent("int-cal-1", "e1", {
        title: "Updated",
      });
      expect(result).toEqual(updated);
    });

    it("getCalendarEvent throws when service not found", async () => {
      const { getCalendarEvent } = useCalendarIntegrations();
      await expect(getCalendarEvent("missing", "e1")).rejects.toThrow(
        "Integration service not found",
      );
    });

    it("getCalendarEvent throws when service has no getEvent", async () => {
      getServiceMap().set("int-cal-1", { getEvents: async () => [] });
      const { getCalendarEvent } = useCalendarIntegrations();
      await expect(getCalendarEvent("int-cal-1", "e1")).rejects.toThrow(
        "does not support fetching individual events",
      );
    });

    it("deleteCalendarEvent throws when service not found", async () => {
      const { deleteCalendarEvent } = useCalendarIntegrations();
      await expect(deleteCalendarEvent("missing", "e1")).rejects.toThrow(
        "Integration service not found",
      );
    });

    it("deleteCalendarEvent throws when service has no deleteEvent", async () => {
      getServiceMap().set("int-cal-1", { getEvents: async () => [] });
      const { deleteCalendarEvent } = useCalendarIntegrations();
      await expect(deleteCalendarEvent("int-cal-1", "e1")).rejects.toThrow(
        "does not support deleting",
      );
    });

    it("addCalendarEvent throws when service not found", async () => {
      const { addCalendarEvent } = useCalendarIntegrations();
      await expect(
        addCalendarEvent("missing", "cal1", { title: "x" }),
      ).rejects.toThrow("Integration service not found");
    });

    it("addCalendarEvent throws when service has no addEvent", async () => {
      getServiceMap().set("int-cal-1", { getEvents: async () => [] });
      const { addCalendarEvent } = useCalendarIntegrations();
      await expect(
        addCalendarEvent("int-cal-1", "cal1", { title: "x" }),
      ).rejects.toThrow("does not support adding");
    });

    it("getAvailableCalendars returns [] when service not found", async () => {
      const { getAvailableCalendars } = useCalendarIntegrations();
      expect(await getAvailableCalendars("missing")).toEqual([]);
    });

    it("getAvailableCalendars returns [] when service has no getAvailableCalendars", async () => {
      getServiceMap().set("int-cal-1", { getEvents: async () => [] });
      const { getAvailableCalendars } = useCalendarIntegrations();
      expect(await getAvailableCalendars("int-cal-1")).toEqual([]);
    });

    it("getAvailableCalendars returns write-only calendars", async () => {
      const calendars = [
        { id: "c1", name: "C1", accessRole: "write" as const },
        { id: "c2", name: "C2", accessRole: "read" as const },
      ];
      getServiceMap().set("int-cal-1", {
        getEvents: async () => [],
        getAvailableCalendars: async () => calendars,
      });
      const { getAvailableCalendars } = useCalendarIntegrations();
      const result = await getAvailableCalendars("int-cal-1");
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe("c1");
    });
  });
});
