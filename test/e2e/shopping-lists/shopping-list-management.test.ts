import type { ShoppingListItem, ShoppingList } from "~/types/database";

import { $fetch, url } from "@nuxt/test-utils/e2e";
import { describe, it, expect } from "vitest";

describe("Shopping List Management E2E", () => {
  it("should navigate to shopping lists page", async () => {
    const html = await $fetch(url("/shoppinglists"));
    expect(html).toContain("Shopping");
  });

  it("should create a shopping list", async () => {
    const response = await $fetch(url("/api/shopping-lists"), {
      method: "POST",
      body: {
        name: "E2E Test Shopping List",
      },
    }) as ShoppingList;

    expect(response).toHaveProperty("id");
    expect(response.name).toBe("E2E Test Shopping List");
  });

  it("should add items to a shopping list", async () => {
    const listResponse = await $fetch(url("/api/shopping-lists"), {
      method: "POST",
      body: {
        name: "Test List for Items",
      },
    }) as ShoppingList;

    const itemResponse = await $fetch(url(`/api/shopping-lists/${listResponse.id}/items`), {
      method: "POST",
      body: {
        name: "Milk",
        quantity: 1,
        unit: "gallon",
      },
    }) as ShoppingListItem;

    expect(itemResponse).toHaveProperty("id");
    expect(itemResponse.name).toBe("Milk");
    expect(itemResponse.quantity).toBe(1);
    expect(itemResponse.unit).toBe("gallon");
  });

  it("should check and uncheck shopping list items", async () => {
    const listResponse = await $fetch(url("/api/shopping-lists"), {
      method: "POST",
      body: {
        name: "Test List for Checking",
      },
    }) as ShoppingList;

    const itemResponse = await $fetch(url(`/api/shopping-lists/${listResponse.id}/items`), {
      method: "POST",
      body: {
        name: "Bread",
        quantity: 1,
      },
    }) as ShoppingListItem;

    const checkedResponse = await $fetch(url(`/api/shopping-list-items/${itemResponse.id}`), {
      method: "PUT",
      body: {
        checked: true,
      },
    }) as ShoppingListItem | { success: boolean };

    if ("checked" in checkedResponse) {
      expect(checkedResponse.checked).toBe(true);
    }

    const uncheckedResponse = await $fetch(url(`/api/shopping-list-items/${itemResponse.id}`), {
      method: "PUT",
      body: {
        checked: false,
      },
    }) as ShoppingListItem | { success: boolean };

    if ("checked" in uncheckedResponse) {
      expect(uncheckedResponse.checked).toBe(false);
    }
  });

  it("should edit shopping list items", async () => {
    const listResponse = await $fetch(url("/api/shopping-lists"), {
      method: "POST",
      body: {
        name: "Test List for Editing",
      },
    }) as ShoppingList;

    const itemResponse = await $fetch(url(`/api/shopping-lists/${listResponse.id}/items`), {
      method: "POST",
      body: {
        name: "Original Item",
        quantity: 1,
      },
    }) as ShoppingListItem;

    const updateResponse = await $fetch(url(`/api/shopping-list-items/${itemResponse.id}`), {
      method: "PUT",
      body: {
        name: "Updated Item",
        quantity: 2,
        unit: "pounds",
      },
    }) as ShoppingListItem | { success: boolean };

    if ("name" in updateResponse) {
      expect(updateResponse.name).toBe("Updated Item");
      expect(updateResponse.quantity).toBe(2);
      expect(updateResponse.unit).toBe("pounds");
    }
  });

  it("should delete shopping list items", async () => {
    const listResponse = await $fetch(url("/api/shopping-lists"), {
      method: "POST",
      body: {
        name: "Test List for Deletion",
      },
    }) as ShoppingList;

    const itemResponse = await $fetch(url(`/api/shopping-lists/${listResponse.id}/items`), {
      method: "POST",
      body: {
        name: "Item to Delete",
        quantity: 1,
      },
    }) as ShoppingListItem;

    await $fetch(url(`/api/shopping-list-items/${itemResponse.id}`), {
      method: "DELETE" as const,
    });

    const lists = await $fetch(url("/api/shopping-lists")) as (ShoppingList & { items: ShoppingListItem[] })[];
    const list = lists.find((l) => l.id === listResponse.id);
    const deletedItem = list?.items.find((i) => i.id === itemResponse.id);
    expect(deletedItem).toBeUndefined();
  });

  it("should delete a shopping list", async () => {
    const listResponse = await $fetch(url("/api/shopping-lists"), {
      method: "POST",
      body: {
        name: "List to Delete",
      },
    }) as ShoppingList;

    await $fetch(url(`/api/shopping-lists/${listResponse.id}`), {
      method: "DELETE" as const,
    });

    const lists = await $fetch(url("/api/shopping-lists")) as ShoppingList[];
    const deletedList = lists.find((l) => l.id === listResponse.id);
    expect(deletedList).toBeUndefined();
  });
});
