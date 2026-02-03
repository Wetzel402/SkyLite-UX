import { consola } from "consola";

import type {
  CreateShoppingListItemInput,
  Integration,
  ShoppingList,
  ShoppingListItem,
  UpdateShoppingListItemInput,
} from "~/types/database";
import type {
  IntegrationService,
  ServerShoppingIntegrationService,
} from "~/types/integrations";

import { useIntegrations } from "./useIntegrations";
import { useSyncManager } from "./useSyncManager";

export function useShoppingIntegrations() {
  const {
    integrations,
    loading: integrationsLoading,
    error: integrationsError,
    getService,
  } = useIntegrations();
  const { getShoppingSyncData, getCachedIntegrationData } = useSyncManager();

  const allShoppingLists = computed(() => {
    const lists: (ShoppingList & {
      source: "integration";
      integrationId?: string;
      integrationName?: string;
    })[] = [];

    const shoppingIntegrations = (
      (integrations.value as readonly Integration[]) || []
    ).filter(
      integration => integration.type === "shopping" && integration.enabled,
    );

    shoppingIntegrations.forEach((integration) => {
      try {
        const integrationLists = getCachedIntegrationData(
          "shopping",
          integration.id,
        ) as ShoppingList[];
        if (integrationLists && Array.isArray(integrationLists)) {
          const listsWithIntegration = integrationLists.map(
            (list: ShoppingList) => ({
              ...list,
              source: "integration" as const,
              integrationId: integration.id,
              integrationName: integration.name || "Unknown",
            }),
          );
          lists.push(...listsWithIntegration);
        }
      }
      catch (error) {
        consola.warn(
          `Use Shopping Integrations: Failed to get shopping lists for integration ${integration.id}:`,
          error,
        );
      }
    });

    return lists;
  });

  const shoppingIntegrations = computed(() => {
    return ((integrations.value as readonly Integration[]) || []).filter(
      integration => integration.type === "shopping" && integration.enabled,
    );
  });

  const shoppingServices = computed(() => {
    const services: Map<string, IntegrationService> = new Map();
    shoppingIntegrations.value.forEach((integration) => {
      const service = getService(integration.id);
      if (service) {
        services.set(integration.id, service);
      }
    });
    return services;
  });

  const shoppingSyncStatus = computed(() => {
    try {
      return getShoppingSyncData([...(integrations.value as Integration[])]);
    }
    catch {
      return [];
    }
  });

  const loading = ref(false);
  const error = ref<string | null>(null);
  const syncing = ref(false);

  const refreshShoppingLists = async () => {
    loading.value = true;
    error.value = null;

    try {
      await refreshNuxtData("native-shopping-lists");
    }
    catch (err) {
      error.value = "Failed to refresh shopping lists";
      consola.error(
        "Use Shopping Integrations: Error refreshing shopping lists:",
        err,
      );
      throw err;
    }
    finally {
      loading.value = false;
    }
  };

  const addItemToList = async (
    integrationId: string,
    listId: string,
    itemData: CreateShoppingListItemInput,
  ): Promise<ShoppingListItem> => {
    const service = shoppingServices.value.get(integrationId);
    if (!service) {
      throw new Error(`Integration service not found for ${integrationId}`);
    }

    try {
      const item = await (
        service as unknown as ServerShoppingIntegrationService
      ).addItemToList?.(listId, {
        name: itemData.name || itemData.notes || "Unknown",
        quantity: itemData.quantity ?? 0,
        unit: itemData.unit || null,
        notes: itemData.notes || null,
        checked: false,
        order: 0,
        label: null,
        food: null,
      });

      if (!item) {
        throw new Error("Failed to add item to list");
      }
      return item;
    }
    catch (err) {
      consola.error(
        `Use Shopping Integrations: Error adding item to list ${listId} in integration ${integrationId}:`,
        err,
      );
      throw err;
    }
  };

  const updateShoppingListItem = async (
    integrationId: string,
    itemId: string,
    updates: UpdateShoppingListItemInput,
  ): Promise<ShoppingListItem> => {
    const service = shoppingServices.value.get(integrationId);
    if (!service) {
      throw new Error(`Integration service not found for ${integrationId}`);
    }

    try {
      const updatedItem = await (
        service as unknown as {
          updateShoppingListItem?: (
            itemId: string,
            updates: UpdateShoppingListItemInput,
          ) => Promise<ShoppingListItem>;
        }
      ).updateShoppingListItem?.(itemId, updates);

      if (!updatedItem) {
        throw new Error(
          "Service does not support updating shopping list items",
        );
      }
      return updatedItem;
    }
    catch (err) {
      consola.error(
        `Use Shopping Integrations: Error updating item ${itemId} in integration ${integrationId}:`,
        err,
      );
      throw err;
    }
  };

  const toggleItem = async (
    integrationId: string,
    itemId: string,
    checked: boolean,
  ): Promise<void> => {
    const service = shoppingServices.value.get(integrationId);
    if (!service) {
      throw new Error(`Integration service not found for ${integrationId}`);
    }

    try {
      await (
        service as unknown as ServerShoppingIntegrationService
      ).toggleItem?.(itemId, checked);
    }
    catch (err) {
      consola.error(
        `Use Shopping Integrations: Error toggling item ${itemId} in integration ${integrationId}:`,
        err,
      );
      throw err;
    }
  };

  const clearCompletedItems = async (
    integrationId: string,
    listId: string,
    completedItemIds?: string[],
  ): Promise<void> => {
    const service = shoppingServices.value.get(integrationId);
    if (!service) {
      throw new Error(`Integration service not found for ${integrationId}`);
    }

    try {
      let itemsToDelete: string[] = [];

      if (completedItemIds && completedItemIds.length > 0) {
        itemsToDelete = completedItemIds;
      }
      else {
        const lists = getCachedIntegrationData(
          "shopping",
          integrationId,
        ) as ShoppingList[];
        const targetList = lists?.find(list => list.id === listId);

        if (!targetList || !targetList.items) {
          throw new Error(`List ${listId} not found or has no items`);
        }

        itemsToDelete = targetList.items
          .filter(item => item.checked)
          .map(item => item.id);
      }

      if (itemsToDelete.length === 0) {
        consola.warn(
          `Use Shopping Integrations: No completed items to clear from list ${listId}`,
        );
        return;
      }

      await (
        service as unknown as ServerShoppingIntegrationService
      ).deleteShoppingListItems?.(itemsToDelete);
    }
    catch (err) {
      consola.error(
        `Use Shopping Integrations: Error clearing completed items from list ${listId} in integration ${integrationId}:`,
        err,
      );
      throw err;
    }
  };

  return {
    shoppingLists: readonly(allShoppingLists),
    shoppingIntegrations: readonly(shoppingIntegrations),
    shoppingServices: readonly(shoppingServices),
    shoppingSyncStatus: readonly(shoppingSyncStatus),

    loading: readonly(loading),
    syncing: readonly(syncing),
    integrationsLoading: readonly(integrationsLoading),
    integrationsError: readonly(integrationsError),

    refreshShoppingLists,
    addItemToList,
    updateShoppingListItem,
    toggleItem,
    clearCompletedItems,
  };
}
