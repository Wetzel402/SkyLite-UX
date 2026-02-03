import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("consola", () => ({ default: { error: vi.fn(), warn: vi.fn() } }));

const mockCalendarListList = vi.fn().mockResolvedValue({ data: { items: [] } });
const mockEventsList = vi.fn().mockResolvedValue({ data: { items: [] } });
const mockEventsGet = vi.fn().mockResolvedValue({ data: {} });
const mockEventsUpdate = vi.fn().mockResolvedValue({ data: {} });
const mockEventsDelete = vi.fn().mockResolvedValue(undefined);
const mockEventsInsert = vi.fn().mockResolvedValue({ data: {} });

vi.mock("googleapis", () => {
  const OAuth2Mock = vi.fn().mockImplementation(function (this: {
    setCredentials: ReturnType<typeof vi.fn>;
    credentials: { expiry_date: number; access_token?: string };
    refreshAccessToken: ReturnType<typeof vi.fn>;
  }) {
    this.setCredentials = vi.fn();
    this.credentials = { expiry_date: Date.now() + 60000 };
    this.refreshAccessToken = vi.fn().mockResolvedValue(undefined);
    return this;
  });
  return {
    google: {
      auth: { OAuth2: OAuth2Mock },
      calendar: vi.fn(() => ({
        calendarList: { list: mockCalendarListList },
        events: {
          list: mockEventsList,
          get: mockEventsGet,
          update: mockEventsUpdate,
          delete: mockEventsDelete,
          insert: mockEventsInsert,
        },
      })),
    },
  };
});

import { GoogleCalendarServerService } from "../../../../../server/integrations/google_calendar/client";

describe("GoogleCalendarServerService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCalendarListList.mockResolvedValue({ data: { items: [] } });
    mockEventsList.mockResolvedValue({ data: { items: [] } });
    mockEventsGet.mockResolvedValue({ data: {} });
    mockEventsUpdate.mockResolvedValue({ data: {} });
    mockEventsDelete.mockResolvedValue(undefined);
    mockEventsInsert.mockResolvedValue({ data: {} });
  });

  it("should instantiate with credentials", () => {
    const service = new GoogleCalendarServerService(
      "clientId",
      "clientSecret",
      "refreshToken",
    );
    expect(service).toBeDefined();
  });

  it("should call calendar.calendarList.list when listCalendars is invoked", async () => {
    const service = new GoogleCalendarServerService(
      "clientId",
      "clientSecret",
      "refreshToken",
      "accessToken",
      Date.now() + 60000,
    );

    const result = await service.listCalendars();

    expect(mockCalendarListList).toHaveBeenCalledTimes(1);
    expect(result).toEqual([]);
  });

  it("should map listCalendars response and set accessRole write for writer/owner", async () => {
    mockCalendarListList.mockResolvedValueOnce({
      data: {
        items: [
          { id: "id1", summary: "Cal 1", accessRole: "writer" },
          { id: "id2", summary: "Cal 2", accessRole: "owner" },
          { id: "id3", summary: "Cal 3", accessRole: "reader" },
        ],
      },
    });

    const service = new GoogleCalendarServerService(
      "clientId",
      "clientSecret",
      "refreshToken",
      "accessToken",
      Date.now() + 60000,
    );

    const result = await service.listCalendars();

    expect(result).toHaveLength(3);
    const [first, second, third] = result;
    expect(first?.accessRole).toBe("write");
    expect(second?.accessRole).toBe("write");
    expect(third?.accessRole).toBe("read");
  });

  it("should return empty array when listCalendars response has no items", async () => {
    mockCalendarListList.mockResolvedValueOnce({ data: {} });

    const service = new GoogleCalendarServerService(
      "clientId",
      "clientSecret",
      "refreshToken",
      "accessToken",
      Date.now() + 60000,
    );

    const result = await service.listCalendars();

    expect(result).toEqual([]);
  });

  it("should call calendar.events.list when fetchEventsFromCalendar is invoked", async () => {
    const service = new GoogleCalendarServerService(
      "clientId",
      "clientSecret",
      "refreshToken",
      "accessToken",
      Date.now() + 60000,
    );

    await service.fetchEventsFromCalendar("primary");

    expect(mockEventsList).toHaveBeenCalledTimes(1);
    const [params] = mockEventsList.mock.calls[0] as [{ calendarId: string }];
    expect(params.calendarId).toBe("primary");
  });

  it("should return empty array when fetchEventsFromCalendar response has no items", async () => {
    mockEventsList.mockResolvedValueOnce({ data: {} });

    const service = new GoogleCalendarServerService(
      "clientId",
      "clientSecret",
      "refreshToken",
      "accessToken",
      Date.now() + 60000,
    );

    const result = await service.fetchEventsFromCalendar("cal-1");

    expect(result).toEqual([]);
  });

  it("should call events.get when fetchEvent is invoked", async () => {
    mockEventsGet.mockResolvedValueOnce({
      data: {
        id: "ev-1",
        summary: "Event",
        start: { dateTime: "2025-01-15T10:00:00Z" },
        end: { dateTime: "2025-01-15T11:00:00Z" },
      },
    });

    const service = new GoogleCalendarServerService(
      "clientId",
      "clientSecret",
      "refreshToken",
      "accessToken",
      Date.now() + 60000,
    );

    await service.fetchEvent("cal-1", "ev-1");

    expect(mockEventsGet).toHaveBeenCalledWith({ calendarId: "cal-1", eventId: "ev-1" });
  });

  it("should call events.update when updateEvent is invoked", async () => {
    mockEventsUpdate.mockResolvedValueOnce({
      data: {
        id: "ev-1",
        summary: "Updated",
        start: {},
        end: {},
      },
    });

    const service = new GoogleCalendarServerService(
      "clientId",
      "clientSecret",
      "refreshToken",
      "accessToken",
      Date.now() + 60000,
    );

    await service.updateEvent("cal-1", "ev-1", {
      summary: "Updated",
      start: { dateTime: "2025-01-15T10:00:00Z" },
      end: { dateTime: "2025-01-15T11:00:00Z" },
    });

    expect(mockEventsUpdate).toHaveBeenCalled();
  });

  it("should call events.delete when deleteEvent is invoked", async () => {
    const service = new GoogleCalendarServerService(
      "clientId",
      "clientSecret",
      "refreshToken",
      "accessToken",
      Date.now() + 60000,
    );

    await service.deleteEvent("cal-1", "ev-1");

    expect(mockEventsDelete).toHaveBeenCalledWith({
      calendarId: "cal-1",
      eventId: "ev-1",
      sendUpdates: "all",
    });
  });

  it("should call events.insert when addEvent is invoked", async () => {
    mockEventsInsert.mockResolvedValueOnce({
      data: {
        id: "ev-new",
        summary: "New",
        start: {},
        end: {},
      },
    });

    const service = new GoogleCalendarServerService(
      "clientId",
      "clientSecret",
      "refreshToken",
      "accessToken",
      Date.now() + 60000,
    );

    await service.addEvent("cal-1", {
      summary: "New",
      start: { dateTime: "2025-01-15T10:00:00Z" },
      end: { dateTime: "2025-01-15T11:00:00Z" },
    });

    expect(mockEventsInsert).toHaveBeenCalled();
  });

  it("should use primary when fetchEvents is given empty calendarIds", async () => {
    const service = new GoogleCalendarServerService(
      "clientId",
      "clientSecret",
      "refreshToken",
      "accessToken",
      Date.now() + 60000,
    );

    await service.fetchEvents([]);

    expect(mockEventsList).toHaveBeenCalled();
    const [params] = mockEventsList.mock.calls[0] as [{ calendarId: string }];
    expect(params.calendarId).toBe("primary");
  });

  it("should throw auth error when fetchEvents gets Invalid Credentials", async () => {
    mockEventsList.mockRejectedValueOnce(new Error("Invalid Credentials"));

    const service = new GoogleCalendarServerService(
      "clientId",
      "clientSecret",
      "refreshToken",
      "accessToken",
      Date.now() + 60000,
    );

    await expect(service.fetchEvents(["cal-1"])).rejects.toThrow("Invalid Credentials");
  });

  it("should throw when fetchEvents gets invalid_grant", async () => {
    mockEventsList.mockRejectedValueOnce(new Error("invalid_grant"));

    const service = new GoogleCalendarServerService(
      "clientId",
      "clientSecret",
      "refreshToken",
      "accessToken",
      Date.now() + 60000,
    );

    await expect(service.fetchEvents(["cal-1"])).rejects.toThrow();
  });
});
