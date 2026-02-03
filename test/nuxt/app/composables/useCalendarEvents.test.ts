import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";

import type { CalendarEvent } from "~/types/calendar";

vi.mock("consola", () => ({
  consola: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

const testDate = new Date("2026-01-26T12:00:00Z");

const { mockUseNuxtData, mockRefreshNuxtData, eventsDataRef } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref } = require("vue");
  const eventsRef = ref([]);
  const store = new Map();
  store.set("calendar-events", eventsRef);

  const useNuxtDataMock = vi.fn((key: string) => {
    if (!store.has(key)) {
      store.set(key, ref(null));
    }
    return { data: store.get(key)! };
  });

  const refreshNuxtDataMock = vi.fn(async (key: string) => {
    if (key === "calendar-events" && store.has(key)) {
      store.get(key)!.value = eventsRef.value;
    }
    return undefined;
  });

  return {
    mockUseNuxtData: useNuxtDataMock,
    mockRefreshNuxtData: refreshNuxtDataMock,
    eventsDataRef: eventsRef,
  };
});

mockNuxtImport("useNuxtData", () => mockUseNuxtData);
mockNuxtImport("refreshNuxtData", () => mockRefreshNuxtData);

import { useCalendarEvents } from "../../../../app/composables/useCalendarEvents";

describe("useCalendarEvents", () => {
  const mockEvents: CalendarEvent[] = [
    {
      id: "evt-1",
      title: "Event 1",
      start: testDate,
      end: testDate,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    eventsDataRef.value = [...mockEvents];
  });

  it("should return events from useNuxtData", () => {
    const { events } = useCalendarEvents();
    expect(events.value).toEqual(mockEvents);
  });

  it("should return empty array when events data is null", () => {
    eventsDataRef.value = null;
    const { events } = useCalendarEvents();
    expect(events.value).toEqual([]);
  });

  it("should have loading state", () => {
    const { loading } = useCalendarEvents();
    expect(loading.value).toBe(false);
  });

  it("should have error state", () => {
    const { error } = useCalendarEvents();
    expect(error.value).toBeNull();
  });

  describe("fetchEvents", () => {
    it("should fetch events successfully", async () => {
      const { fetchEvents, loading } = useCalendarEvents();

      const result = await fetchEvents();

      expect(mockRefreshNuxtData).toHaveBeenCalledWith("calendar-events");
      expect(loading.value).toBe(false);
      expect(result).toEqual(mockEvents);
    });

    it("should set loading to true during fetch", async () => {
      mockRefreshNuxtData.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100)),
      );
      const { fetchEvents, loading } = useCalendarEvents();

      const fetchPromise = fetchEvents();
      expect(loading.value).toBe(true);

      await fetchPromise;
      expect(loading.value).toBe(false);
    });

    it("should handle fetch errors", async () => {
      const err = new Error("Fetch failed");
      mockRefreshNuxtData.mockRejectedValue(err);
      const { fetchEvents, error: errorState } = useCalendarEvents();

      await expect(fetchEvents()).rejects.toThrow("Fetch failed");
      expect(errorState.value).toBe("Failed to fetch calendar events");
    });
  });
});
