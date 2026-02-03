import { describe, it, expect, beforeEach, vi } from "vitest";

import { TandoorService } from "../../../../../server/integrations/tandoor/client";

vi.mock("consola", () => ({
  consola: { error: vi.fn() },
}));

describe("TandoorService", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  it("should call fetch with URL containing /api/integrations/tandoor and integrationId for getShoppingListEntries", async () => {
    const service = new TandoorService("int-456");
    await service.getShoppingListEntries();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("/api/integrations/tandoor");
    expect(url).toContain("integrationId=int-456");
    expect(url).toContain("/shopping-list-entry/");
  });

  it("should call fetch with POST and body for createShoppingListEntry", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 1, food: { name: "Apple" }, amount: "2" }),
    });

    const service = new TandoorService("int-789");
    await service.createShoppingListEntry({
      food: { name: "Apple" },
      amount: "2",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options?.method).toBe("POST");
    expect(options?.body).toBe(
      JSON.stringify({ food: { name: "Apple" }, amount: "2" }),
    );
  });

  it("should throw when response is not ok", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Server Error",
      text: () => Promise.resolve("Error"),
    });

    const service = new TandoorService("int-1");
    await expect(service.getShoppingListEntries()).rejects.toThrow(
      "Tandoor API error: 500 Server Error",
    );
  });

  it("should call fetch with path for getShoppingListEntry", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 1, food: { name: "Apple" }, amount: "1" }),
    });
    const service = new TandoorService("int-1");
    await service.getShoppingListEntry(1);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("/shopping-list-entry/1/");
    expect(url).toContain("integrationId=int-1");
  });

  it("should call fetch with PATCH and body for updateShoppingListEntry", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 1, amount: "2", checked: true }),
    });
    const service = new TandoorService("int-1");
    await service.updateShoppingListEntry(1, { amount: "2", checked: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/shopping-list-entry/1/");
    expect(options?.method).toBe("PATCH");
    expect(options?.body).toBe(JSON.stringify({ amount: "2", checked: true }));
  });

  it("should call fetch with DELETE for deleteShoppingListEntry", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(undefined) });
    const service = new TandoorService("int-1");
    await service.deleteShoppingListEntry(1);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/shopping-list-entry/1/");
    expect(options?.method).toBe("DELETE");
  });

  it("should call fetch with search query for searchFoods and return results", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ results: [{ id: 1, name: "Apple" }] }),
    });
    const service = new TandoorService("int-1");
    const result = await service.searchFoods("apple");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("/food/");
    expect(url).toContain("search=apple");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ id: 1, name: "Apple" });
  });

  it("should call fetch for getUnits and return results", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ results: [{ id: 1, name: "kg" }] }),
    });
    const service = new TandoorService("int-1");
    const result = await service.getUnits();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("/unit/");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ id: 1, name: "kg" });
  });
});
