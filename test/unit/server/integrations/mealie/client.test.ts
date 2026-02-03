import { describe, it, expect, beforeEach, vi } from "vitest";

import { MealieService } from "../../../../../server/integrations/mealie/client";
import type { MealieShoppingListItem } from "../../../../../server/integrations/mealie/types";

describe("MealieService", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [], total: 0 }),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  it("should call fetch with URL including /api/integrations/mealie/ and integrationId for getShoppingLists", async () => {
    const service = new MealieService("int-123");
    await service.getShoppingLists();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("/api/integrations/mealie/");
    expect(url).toContain("integrationId=int-123");
  });

  it("should call fetch with correct path for getShoppingList", async () => {
    const service = new MealieService("int-456");
    await service.getShoppingList("list-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("api/households/shopping/lists/list-1");
    expect(url).toContain("integrationId=int-456");
  });

  it("should call fetch with POST for createShoppingList", async () => {
    const service = new MealieService("int-789");
    await service.createShoppingList({ name: "New List" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options?.method).toBe("POST");
    expect(options?.body).toBe(JSON.stringify({ name: "New List" }));
  });

  it("should throw when response is not ok", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, statusText: "Not Found" });

    const service = new MealieService("int-1");
    await expect(service.getShoppingLists()).rejects.toThrow("Mealie API error: Not Found");
  });

  it("should call fetch with PUT and path for updateShoppingList", async () => {
    const service = new MealieService("int-1");
    await service.updateShoppingList("list-1", { name: "Updated" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("api/households/shopping/lists/list-1");
    expect(url).toContain("integrationId=int-1");
    expect(options?.method).toBe("PUT");
    expect(options?.body).toBe(JSON.stringify({ name: "Updated" }));
  });

  it("should call fetch with DELETE and path for deleteShoppingList", async () => {
    const service = new MealieService("int-1");
    await service.deleteShoppingList("list-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("api/households/shopping/lists/list-1");
    expect(options?.method).toBe("DELETE");
  });

  it("should call fetch with POST and body for createShoppingListItems", async () => {
    const items = [{ id: "item-1", note: "Milk" }];
    const service = new MealieService("int-1");
    await service.createShoppingListItems("list-1", items);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("api/households/shopping/items");
    expect(options?.method).toBe("POST");
    expect(options?.body).toBe(JSON.stringify(items));
  });

  it("should call fetch with POST and body for createShoppingListItem", async () => {
    const item = { note: "Bread" };
    const service = new MealieService("int-1");
    await service.createShoppingListItem(item);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options?.method).toBe("POST");
    expect(options?.body).toBe(JSON.stringify(item));
  });

  it("should call fetch with DELETE and ids query for deleteShoppingListItems", async () => {
    const service = new MealieService("int-1");
    await service.deleteShoppingListItems(["id-1", "id-2"]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("api/households/shopping/items");
    expect(url).toContain("ids=id-1");
    expect(url).toContain("ids=id-2");
    expect(options?.method).toBe("DELETE");
  });

  it("should call fetch with path api/foods for getFoods", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
    const service = new MealieService("int-1");
    await service.getFoods();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("api/foods");
  });

  it("should call fetch with POST and body for createFood", async () => {
    const service = new MealieService("int-1");
    await service.createFood({ name: "Apple", pluralName: "Apples" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("api/foods");
    expect(options?.method).toBe("POST");
    expect(options?.body).toBe(JSON.stringify({ name: "Apple", pluralName: "Apples" }));
  });

  it("should call fetch with path api/units for getUnits", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });
    const service = new MealieService("int-1");
    await service.getUnits();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("api/units");
  });

  it("should call fetch with POST and body for createUnit", async () => {
    const service = new MealieService("int-1");
    await service.createUnit({ name: "cup", pluralName: "cups" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("api/units");
    expect(options?.method).toBe("POST");
    expect(options?.body).toBe(JSON.stringify({ name: "cup", pluralName: "cups" }));
  });

  it("should call fetch with PUT and body for updateShoppingListItem", async () => {
    const items = [{ id: "item-1", checked: true }] as MealieShoppingListItem[];
    const service = new MealieService("int-1");
    await service.updateShoppingListItem(items);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("api/households/shopping/items");
    expect(options?.method).toBe("PUT");
    expect(options?.body).toBe(JSON.stringify(items));
  });

  it("should call fetch with PUT and path for updateShoppingListItemById", async () => {
    const service = new MealieService("int-1");
    await service.updateShoppingListItemById("item-1", { checked: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("api/households/shopping/items/item-1");
    expect(options?.method).toBe("PUT");
    expect(options?.body).toBe(JSON.stringify({ checked: true }));
  });
});
