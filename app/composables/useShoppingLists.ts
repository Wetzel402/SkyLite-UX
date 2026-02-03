import { consola } from "consola";

import type {
  CreateShoppingListInput,
  CreateShoppingListItemInput,
  ShoppingListItem,
  ShoppingListWithOrder,
  UpdateShoppingListItemInput,
} from "~/types/database";

export function useShoppingLists() {
  const loading = ref(false);
  const error = ref<string | null>(null);

  const { data: shoppingLists } = useNuxtData<ShoppingListWithOrder[]>(
    "native-shopping-lists",
  );

  const currentShoppingLists = computed(() => shoppingLists.value || []);

  const getShoppingLists = async () => {
    loading.value = true;
    error.value = null;
    try {
      await refreshNuxtData("native-shopping-lists");
      consola.debug(
        "Use Shopping Lists: Shopping lists refreshed successfully",
      );
    }
    catch (err) {
      error.value = "Failed to fetch shopping lists";
      consola.error("Use Shopping Lists: Error fetching shopping lists:", err);
      throw err;
    }
    finally {
      loading.value = false;
    }
  };

  const createShoppingList = async (listData: CreateShoppingListInput) => {
    try {
      const newList = await $fetch<ShoppingListWithOrder>(
        "/api/shopping-lists",
        {
          method: "POST",
          body: listData,
        },
      );

      await refreshNuxtData("native-shopping-lists");

      return newList;
    }
    catch (err) {
      error.value = "Failed to create shopping list";
      consola.error("Use Shopping Lists: Error creating shopping list:", err);
      throw err;
    }
  };

  const updateShoppingList = async (
    listId: string,
    updates: { name?: string },
  ) => {
    try {
      const updatedList = await $fetch<ShoppingListWithOrder>(
        `/api/shopping-lists/${listId}`,
        {
          method: "PUT",
          body: updates,
        },
      );

      await refreshNuxtData("native-shopping-lists");

      return updatedList;
    }
    catch (err) {
      error.value = "Failed to update shopping list";
      consola.error("Use Shopping Lists: Error updating shopping list:", err);
      throw err;
    }
  };

  const updateShoppingListItem = async (
    itemId: string,
    updates: UpdateShoppingListItemInput,
  ) => {
    try {
      const updatedItem = await $fetch<ShoppingListItem>(
        `/api/shopping-list-items/${itemId}`,
        {
          method: "PUT",
          body: updates,
        },
      );

      await refreshNuxtData("native-shopping-lists");

      return updatedItem;
    }
    catch (err) {
      error.value = "Failed to update shopping list item";
      consola.error(
        "Use Shopping Lists: Error updating shopping list item:",
        err,
      );
      throw err;
    }
  };

  const addItemToList = async (
    listId: string,
    itemData: CreateShoppingListItemInput,
  ) => {
    try {
      const newItem = await $fetch<ShoppingListItem>(
        `/api/shopping-lists/${listId}/items`,
        {
          method: "POST",
          body: itemData,
        },
      );

      await refreshNuxtData("native-shopping-lists");

      return newItem;
    }
    catch (err) {
      error.value = "Failed to add item to shopping list";
      consola.error(
        "Use Shopping Lists: Error adding item to shopping list:",
        err,
      );
      throw err;
    }
  };

  const deleteShoppingList = async (listId: string) => {
    try {
      const response = await fetch(`/api/shopping-lists/${listId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete shopping list");
      }

      await refreshNuxtData("native-shopping-lists");
    }
    catch (err) {
      error.value = "Failed to delete shopping list";
      consola.error("Use Shopping Lists: Error deleting shopping list:", err);
      throw err;
    }
  };

  const toggleItem = async (itemId: string, checked: boolean) => {
    return updateShoppingListItem(itemId, { checked });
  };

  const reorderShoppingList = async (
    listId: string,
    direction: "up" | "down",
  ) => {
    try {
      const sortedLists = [...currentShoppingLists.value].sort(
        (a, b) => (a.order || 0) - (b.order || 0),
      );
      const currentIndex = sortedLists.findIndex(list => list.id === listId);

      if (currentIndex === -1)
        return;

      let targetIndex;
      if (direction === "up" && currentIndex > 0) {
        targetIndex = currentIndex - 1;
      }
      else if (
        direction === "down"
        && currentIndex < sortedLists.length - 1
      ) {
        targetIndex = currentIndex + 1;
      }
      else {
        return;
      }

      const currentList = sortedLists[currentIndex];
      const targetList = sortedLists[targetIndex];

      if (!currentList || !targetList)
        return;

      const currentOrder = currentList.order || 0;
      const targetOrder = targetList.order || 0;

      const updatedLists = currentShoppingLists.value.map((list) => {
        if (list.id === currentList.id) {
          return { ...list, order: targetOrder };
        }
        if (list.id === targetList.id) {
          return { ...list, order: currentOrder };
        }
        return list;
      });

      const newOrder = updatedLists
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(list => list.id);

      await $fetch("/api/shopping-lists/reorder", {
        method: "PUT",
        body: { listIds: newOrder },
      });

      await refreshNuxtData("native-shopping-lists");
    }
    catch (err) {
      error.value = "Failed to reorder shopping list";
      consola.error("Use Shopping Lists: Error reordering shopping list:", err);
      throw err;
    }
  };

  const reorderItem = async (itemId: string, direction: "up" | "down") => {
    try {
      const listIndex = currentShoppingLists.value.findIndex(list =>
        list.items?.some(item => item.id === itemId),
      );

      if (listIndex === -1)
        return;

      const list = currentShoppingLists.value[listIndex];
      if (!list?.items)
        return;

      const sortedItems = [...list.items].sort(
        (a, b) => (a.order || 0) - (b.order || 0),
      );
      const currentIndex = sortedItems.findIndex(item => item.id === itemId);

      if (currentIndex === -1)
        return;

      let targetIndex;
      if (direction === "up" && currentIndex > 0) {
        targetIndex = currentIndex - 1;
      }
      else if (
        direction === "down"
        && currentIndex < sortedItems.length - 1
      ) {
        targetIndex = currentIndex + 1;
      }
      else {
        return;
      }

      const currentItem = sortedItems[currentIndex];
      const targetItem = sortedItems[targetIndex];

      if (!currentItem || !targetItem)
        return;

      const currentOrder = currentItem.order || 0;
      const targetOrder = targetItem.order || 0;

      const updatedItems = list.items.map((item) => {
        if (item.id === currentItem.id) {
          return { ...item, order: targetOrder };
        }
        if (item.id === targetItem.id) {
          return { ...item, order: currentOrder };
        }
        return item;
      });

      const newOrder = updatedItems
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(item => item.id);

      await $fetch("/api/shopping-list-items/reorder", {
        method: "PUT",
        body: { itemIds: newOrder },
      });

      await refreshNuxtData("native-shopping-lists");
    }
    catch (err) {
      error.value = "Failed to reorder item";
      consola.error("Use Shopping Lists: Error reordering item:", err);
      throw err;
    }
  };

  const deleteCompletedItems = async (
    listId: string,
    completedItemIds?: string[],
  ) => {
    try {
      let itemsToDelete: string[] = [];

      if (completedItemIds && completedItemIds.length > 0) {
        itemsToDelete = completedItemIds;
      }
      else {
        const list = currentShoppingLists.value.find(l => l.id === listId);
        if (!list)
          return;

        itemsToDelete = list.items
          .filter(item => item.checked)
          .map(item => item.id);
      }

      if (itemsToDelete.length === 0)
        return;

      await $fetch(`/api/shopping-lists/${listId}/items/clear-completed`, {
        method: "POST",
        body: { action: "delete" },
      });

      await refreshNuxtData("native-shopping-lists");
    }
    catch (err) {
      error.value = "Failed to clear completed items";
      consola.error("Use Shopping Lists: Error clearing completed items:", err);
      throw err;
    }
  };

  return {
    shoppingLists: readonly(currentShoppingLists),
    loading: readonly(loading),
    error: readonly(error),
    getShoppingLists,
    createShoppingList,
    updateShoppingList,
    updateShoppingListItem,
    addItemToList,
    deleteShoppingList,
    toggleItem,
    reorderShoppingList,
    reorderItem,
    deleteCompletedItems,
  };
}
