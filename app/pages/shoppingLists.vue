<script setup lang="ts">
import type { JsonObject } from "type-fest";

import { consola } from "consola";

import type {
  CreateShoppingListInput,
  CreateShoppingListItemInput,
  Integration,
  RawIntegrationItem,
  ShoppingList,
  ShoppingListItem,
} from "~/types/database";
import type { DialogField, ShoppingListWithIntegration } from "~/types/ui";

import GlobalFloatingActionButton from "~/components/global/globalFloatingActionButton.vue";
import GlobalList from "~/components/global/globalList.vue";
import ShoppingListDialog from "~/components/shopping/shoppingListDialog.vue";
import ShoppingListItemDialog from "~/components/shopping/shoppingListItemDialog.vue";
import { useAlertToast } from "~/composables/useAlertToast";
import { useStableDate } from "~/composables/useStableDate";
import { useSyncManager } from "~/composables/useSyncManager";
import {
  getFieldsForItem,
  getIntegrationFields,
} from "~/integrations/integrationConfig";
import { integrationRegistry } from "~/types/integrations";

const { parseStableDate, getStableDate } = useStableDate();
const { getCachedIntegrationData } = useSyncManager();
const nuxtApp = useNuxtApp();

function updateIntegrationCache(
  integrationType: string,
  integrationId: string,
  data: unknown,
) {
  const cacheKey =
    integrationType === "shopping"
      ? `shopping-lists-${integrationId}`
      : `${integrationType}-${integrationId}`;
  nuxtApp.payload.data = {
    ...nuxtApp.payload.data,
    [cacheKey]: data,
  };
}

function getDateWithFallback(dateString: string | Date | null): Date {
  if (!dateString) return getStableDate();
  return dateString instanceof Date ? dateString : parseStableDate(dateString);
}

const {
  shoppingLists: nativeShoppingLists,
  loading: nativeLoading,
  createShoppingList,
  updateShoppingList,
  deleteShoppingList,
  addItemToList,
  updateShoppingListItem,
  reorderItem,
  reorderShoppingList,
  deleteCompletedItems,
} = useShoppingLists();

const {
  shoppingLists: integrationLists,
  shoppingIntegrations,
  loading: integrationLoading,
  addItemToList: _addItemToIntegrationList,
  updateShoppingListItem: _updateIntegrationItem,
  toggleItem: _toggleIntegrationItem,
  clearCompletedItems: clearIntegrationCompletedItems,
} = useShoppingIntegrations();

const listDialog = ref(false);
const itemDialog = ref(false);
const selectedListId = ref<string>("");
const editingList = ref<ShoppingList | null>(null);
const editingItem = ref<ShoppingListItem | null>(null);

const { showError, showWarning } = useAlertToast();

function normalizeIntegrationItem(item: RawIntegrationItem): ShoppingListItem {
  return {
    id: String(item.id),
    name: String(item.name ?? ""),
    checked: Boolean(item.checked),
    order: Number(item.order ?? 0),
    notes: item.notes ?? null,
    quantity: Number(item.quantity ?? 1),
    unit: item.unit ?? null,
    label: null,
    food: item.food ?? null,
    integrationData: item.integrationData as JsonObject | undefined,
    source: "integration",
    integrationId: undefined,
  };
}

const nativeListsWithSource = computed(() => {
  return nativeShoppingLists.value.map((list) => ({
    ...list,
    source: "native" as const,
  }));
});

const integrationListsWithSource = computed(() => {
  const lists = integrationLists.value ?? [];
  const result: ShoppingList[] = [];
  for (const list of lists) {
    const integration = (
      shoppingIntegrations.value as readonly Integration[]
    ).find((i) => i.id === list.integrationId);
    const hasClearCapability =
      integration &&
      getIntegrationCapabilities(integration.id).includes("clear_items");
    const filteredItems = Array.isArray(list.items)
      ? list.items
          .map(normalizeIntegrationItem)
          .filter((item) => hasClearCapability || !item.checked)
      : [];

    result.push({
      id: String(list.id),
      name: String(list.name ?? ""),
      order: Number(list.order ?? 0),
      createdAt: getDateWithFallback(list.createdAt),
      updatedAt: getDateWithFallback(list.updatedAt),
      items: filteredItems,
      source: "integration",
      integrationId: list.integrationId ?? undefined,
      integrationName:
        integration?.name || list.integrationName || "Integration",
      integrationIcon: integration
        ? getIntegrationIconUrl(integration)
        : (list.integrationIcon ?? null),
    });
  }
  return result;
});

const allShoppingLists = computed(() => {
  return [
    ...nativeListsWithSource.value,
    ...integrationListsWithSource.value,
  ] as ShoppingList[];
});

const isLoading = computed(() => {
  return nativeLoading.value || integrationLoading.value;
});

const transformedShoppingLists = computed(() => {
  return allShoppingLists.value.map((list) => ({
    id: list.id,
    name: list.name,
    order: list.order || 0,
    createdAt: parseStableDate(list.createdAt),
    updatedAt: parseStableDate(list.updatedAt),
    items: list.items,
    _count: list._count,
    source: list.source || "native",
    integrationId: list.integrationId,
    integrationName: list.integrationName,
    integrationIcon: list.integrationIcon,
  })) as ShoppingListWithIntegration[];
});

function openCreateList() {
  editingList.value = null;
  listDialog.value = true;
}

function openAddItem(listId: string) {
  selectedListId.value = listId;
  editingItem.value = null;
  itemDialog.value = true;
}

function openEditItem(item: ShoppingListItem) {
  const list = findItemList(item.id);
  if (list?.source === "integration") {
    editingItem.value = {
      ...item,
      integrationId: list.integrationId,
      source: "integration",
    };
  } else {
    editingItem.value = { ...item };
  }
  itemDialog.value = true;
}

async function handleListSave(listData: CreateShoppingListInput) {
  try {
    if (editingList.value?.id) {
      const { data: cachedLists } = useNuxtData("native-shopping-lists");
      const previousLists = cachedLists.value ? [...cachedLists.value] : [];

      if (cachedLists.value && Array.isArray(cachedLists.value)) {
        const listIndex = cachedLists.value.findIndex(
          (l: ShoppingList) => l.id === editingList.value!.id,
        );
        if (listIndex !== -1) {
          cachedLists.value[listIndex] = {
            ...cachedLists.value[listIndex],
            ...listData,
          };
        }
      }

      try {
        await updateShoppingList(editingList.value.id, listData);
      } catch (error) {
        if (cachedLists.value && previousLists.length > 0) {
          cachedLists.value.splice(
            0,
            cachedLists.value.length,
            ...previousLists,
          );
        }
        throw error;
      }
    } else {
      const { data: cachedLists } = useNuxtData("native-shopping-lists");
      const previousLists = cachedLists.value ? [...cachedLists.value] : [];
      const newList = {
        id: `temp-${Date.now()}`,
        ...listData,
        createdAt: new Date(),
        updatedAt: new Date(),
        order: (cachedLists.value?.length || 0) + 1,
        items: [],
        _count: { items: 0 },
      };

      if (cachedLists.value && Array.isArray(cachedLists.value)) {
        cachedLists.value.push(newList);
      }

      try {
        const createdList = await createShoppingList(listData);

        if (cachedLists.value && Array.isArray(cachedLists.value)) {
          const tempIndex = cachedLists.value.findIndex(
            (l: ShoppingList) => l.id === newList.id,
          );
          if (tempIndex !== -1) {
            cachedLists.value[tempIndex] = createdList;
          }
        }
      } catch (error) {
        if (cachedLists.value && previousLists.length > 0) {
          cachedLists.value.splice(
            0,
            cachedLists.value.length,
            ...previousLists,
          );
        }
        throw error;
      }
    }

    listDialog.value = false;
    editingList.value = null;
  } catch (error) {
    consola.error("Shopping List: Failed to save shopping list:", error);
    showError(
      "Failed to Save",
      "Failed to save shopping list. Please try again.",
    );
  }
}

async function handleListDelete() {
  if (!editingList.value?.id) return;

  try {
    const { data: cachedLists } = useNuxtData("native-shopping-lists");
    const previousLists = cachedLists.value ? [...cachedLists.value] : [];

    if (cachedLists.value && Array.isArray(cachedLists.value)) {
      cachedLists.value.splice(
        0,
        cachedLists.value.length,
        ...cachedLists.value.filter(
          (l: ShoppingList) => l.id !== editingList.value!.id,
        ),
      );
    }

    try {
      await deleteShoppingList(editingList.value.id);
      listDialog.value = false;
      editingList.value = null;
    } catch (error) {
      if (cachedLists.value && previousLists.length > 0) {
        cachedLists.value.splice(0, cachedLists.value.length, ...previousLists);
      }
      throw error;
    }
  } catch (error) {
    consola.error("Shopping List: Failed to delete shopping list:", error);
    showError(
      "Failed to Delete",
      "Failed to delete shopping list. Please try again.",
    );
  }
}

async function handleItemSave(itemData: CreateShoppingListItemInput) {
  try {
    let targetList: ShoppingList | undefined;
    let isIntegrationList = false;

    if (editingItem.value?.id) {
      targetList = allShoppingLists.value.find((list) =>
        list.items?.some(
          (item: ShoppingListItem) => item.id === editingItem.value!.id,
        ),
      );
      isIntegrationList = targetList?.source === "integration";
    } else {
      targetList = allShoppingLists.value.find(
        (list) => list.id === selectedListId.value,
      );
      isIntegrationList = targetList?.source === "integration";
    }

    if (editingItem.value?.id) {
      if (isIntegrationList && targetList?.integrationId) {
        const integrationLists = getCachedIntegrationData(
          "shopping",
          targetList.integrationId,
        ) as ShoppingList[];
        const previousLists = integrationLists ? [...integrationLists] : [];

        if (integrationLists && Array.isArray(integrationLists)) {
          const listIndex = integrationLists.findIndex(
            (l: ShoppingList) => l.id === targetList!.id,
          );
          if (listIndex !== -1) {
            const list = integrationLists[listIndex];
            if (list) {
              const itemIndex = list.items?.findIndex(
                (i: ShoppingListItem) => i.id === editingItem.value!.id,
              );
              if (itemIndex !== -1 && itemIndex >= 0 && list.items) {
                const updatedItems = [...list.items];
                const currentItem = updatedItems[itemIndex];
                if (currentItem) {
                  updatedItems[itemIndex] = {
                    ...currentItem,
                    name: itemData.name || currentItem.name,
                    notes:
                      itemData.notes !== undefined
                        ? itemData.notes
                        : currentItem.notes,
                    quantity:
                      itemData.quantity !== undefined
                        ? itemData.quantity
                        : currentItem.quantity,
                    unit:
                      itemData.unit !== undefined
                        ? itemData.unit
                        : currentItem.unit,
                  };
                }
                const updatedList = { ...list, items: updatedItems };
                const updatedLists = [...integrationLists];
                updatedLists[listIndex] = updatedList;

                updateIntegrationCache(
                  "shopping",
                  targetList.integrationId,
                  updatedLists,
                );
              }
            }
          }
        }

        try {
          await _updateIntegrationItem(
            targetList.integrationId,
            editingItem.value.id,
            itemData,
          );
        } catch (error) {
          if (integrationLists && previousLists.length > 0) {
            updateIntegrationCache(
              "shopping",
              targetList.integrationId,
              previousLists,
            );
          }
          throw error;
        }
      } else {
        const { data: cachedLists } = useNuxtData("native-shopping-lists");
        const previousLists = cachedLists.value ? [...cachedLists.value] : [];

        if (cachedLists.value && Array.isArray(cachedLists.value)) {
          const listIndex = cachedLists.value.findIndex(
            (l: ShoppingList) => l.id === targetList!.id,
          );
          if (listIndex !== -1) {
            const list = cachedLists.value[listIndex];
            if (list && list.items) {
              const itemIndex = list.items.findIndex(
                (i: ShoppingListItem) => i.id === editingItem.value!.id,
              );
              if (itemIndex !== -1 && itemIndex >= 0) {
                const updatedItems = [...list.items];
                const currentItem = updatedItems[itemIndex];
                if (currentItem) {
                  updatedItems[itemIndex] = {
                    ...currentItem,
                    name: itemData.name || currentItem.name,
                    notes:
                      itemData.notes !== undefined
                        ? itemData.notes
                        : currentItem.notes,
                    quantity:
                      itemData.quantity !== undefined
                        ? itemData.quantity
                        : currentItem.quantity,
                    unit:
                      itemData.unit !== undefined
                        ? itemData.unit
                        : currentItem.unit,
                  };
                }
                const updatedList = { ...list, items: updatedItems };
                const updatedLists = [...cachedLists.value];
                updatedLists[listIndex] = updatedList;
                cachedLists.value = updatedLists;
              }
            }
          }
        }

        try {
          await updateShoppingListItem(editingItem.value.id, itemData);
        } catch (error) {
          if (cachedLists.value && previousLists.length > 0) {
            cachedLists.value.splice(
              0,
              cachedLists.value.length,
              ...previousLists,
            );
          }
          throw error;
        }
      }
    } else {
      if (isIntegrationList && targetList?.integrationId) {
        const integrationLists = getCachedIntegrationData(
          "shopping",
          targetList.integrationId,
        ) as ShoppingList[];
        const previousLists = integrationLists ? [...integrationLists] : [];
        let tempItemId: string | null = null;

        if (integrationLists && Array.isArray(integrationLists)) {
          const listIndex = integrationLists.findIndex(
            (l: ShoppingList) => l.id === targetList!.id,
          );
          if (listIndex !== -1) {
            const list = integrationLists[listIndex];
            if (list) {
              const newItem: ShoppingListItem = {
                id: `temp-${Date.now()}`,
                name: itemData.name || "",
                checked: false,
                order: 0,
                notes: itemData.notes || null,
                quantity: itemData.quantity || 1,
                unit: itemData.unit || null,
                label: null,
                food: null,
                source: "integration" as const,
                integrationId: targetList.integrationId,
              };

              tempItemId = newItem.id;

              const currentItems = list.items || [];
              const updatedItems = [...currentItems, newItem];
              const updatedList = {
                ...list,
                items: updatedItems,
                _count: list._count
                  ? { ...list._count, items: (list._count.items || 0) + 1 }
                  : undefined,
              };
              const updatedLists = [...integrationLists];
              updatedLists[listIndex] = updatedList;

              updateIntegrationCache(
                "shopping",
                targetList.integrationId,
                updatedLists,
              );
            }
          }
        }

        try {
          const createdItem = await _addItemToIntegrationList(
            targetList.integrationId,
            selectedListId.value,
            itemData,
          );

          if (tempItemId) {
            const freshIntegrationLists = getCachedIntegrationData(
              "shopping",
              targetList.integrationId,
            ) as ShoppingList[];

            if (freshIntegrationLists && Array.isArray(freshIntegrationLists)) {
              const listIndex = freshIntegrationLists.findIndex(
                (l: ShoppingList) => l.id === targetList!.id,
              );
              if (listIndex !== -1) {
                const list = freshIntegrationLists[listIndex];
                if (list && list.items) {
                  const tempItemIndex = list.items.findIndex(
                    (item: ShoppingListItem) => item.id === tempItemId,
                  );
                  if (tempItemIndex !== -1) {
                    const updatedItems = [...list.items];
                    updatedItems[tempItemIndex] = createdItem;
                    const updatedList = { ...list, items: updatedItems };
                    const updatedLists = [...freshIntegrationLists];
                    updatedLists[listIndex] = updatedList;
                    updateIntegrationCache(
                      "shopping",
                      targetList.integrationId,
                      updatedLists,
                    );
                  }
                }
              }
            }
          }
        } catch (error) {
          if (integrationLists && previousLists.length > 0) {
            updateIntegrationCache(
              "shopping",
              targetList.integrationId,
              previousLists,
            );
          }
          throw error;
        }
      } else {
        const { data: cachedLists } = useNuxtData("native-shopping-lists");
        const previousLists = cachedLists.value ? [...cachedLists.value] : [];
        const newItem: ShoppingListItem = {
          id: `temp-${Date.now()}`,
          name: itemData.name || "",
          checked: false,
          order: 0,
          notes: itemData.notes || null,
          quantity: itemData.quantity || 1,
          unit: itemData.unit || null,
          label: null,
          food: null,
          source: "native" as const,
        };

        if (cachedLists.value && Array.isArray(cachedLists.value)) {
          const listIndex = cachedLists.value.findIndex(
            (l: ShoppingList) => l.id === targetList!.id,
          );
          if (listIndex !== -1) {
            const list = cachedLists.value[listIndex];
            if (list) {
              const currentItems = list.items || [];
              const updatedItems = [...currentItems, newItem];
              const updatedList = {
                ...list,
                items: updatedItems,
                _count: list._count
                  ? { ...list._count, items: (list._count.items || 0) + 1 }
                  : undefined,
              };
              const updatedLists = [...cachedLists.value];
              updatedLists[listIndex] = updatedList;
              cachedLists.value = updatedLists;
            }
          }
        }

        try {
          const createdItem = await addItemToList(targetList!.id, itemData);

          if (cachedLists.value && Array.isArray(cachedLists.value)) {
            const listIndex = cachedLists.value.findIndex(
              (l: ShoppingList) => l.id === targetList!.id,
            );
            if (listIndex !== -1) {
              const list = cachedLists.value[listIndex];
              if (list && list.items) {
                const tempIndex = list.items.findIndex(
                  (i: ShoppingListItem) => i.id === newItem.id,
                );
                if (tempIndex !== -1 && tempIndex >= 0) {
                  const updatedItems = [...list.items];
                  updatedItems[tempIndex] = createdItem;
                  const updatedList = { ...list, items: updatedItems };
                  const updatedLists = [...cachedLists.value];
                  updatedLists[listIndex] = updatedList;
                  cachedLists.value = updatedLists;
                }
              }
            }
          }
        } catch (error) {
          if (cachedLists.value && previousLists.length > 0) {
            cachedLists.value.splice(
              0,
              cachedLists.value.length,
              ...previousLists,
            );
          }
          throw error;
        }
      }
    }

    itemDialog.value = false;
    editingItem.value = null;
  } catch (error) {
    consola.error("Shopping List: Failed to save shopping list item:", error);
    showError("Failed to Save", "Failed to save item. Please try again.");
  }
}

async function handleItemDelete(itemId: string) {
  try {
    const list = findItemList(itemId);
    if (!list) {
      throw new Error("Item not found in any list");
    }

    if (list.source === "integration") {
      showWarning(
        "Warning",
        "Deleting items in integrations is not yet supported.",
      );
    } else {
      showWarning("Warning", "Deleting individual items is not yet supported.");
    }
    itemDialog.value = false;
    editingItem.value = null;
  } catch (error) {
    consola.error("Shopping List: Failed to delete item:", error);
    showError("Error", "Failed to delete item. Please try again.");
  }
}

async function handleToggleItem(itemId: string, checked: boolean) {
  try {
    const targetList = allShoppingLists.value.find((list) =>
      list.items?.some((item: ShoppingListItem) => item.id === itemId),
    );
    const isIntegrationList = targetList?.source === "integration";

    if (isIntegrationList && targetList?.integrationId) {
      const integrationLists = getCachedIntegrationData(
        "shopping",
        targetList.integrationId,
      ) as ShoppingList[];
      const previousLists = integrationLists ? [...integrationLists] : [];

      if (integrationLists && Array.isArray(integrationLists)) {
        for (const list of integrationLists) {
          const item = list.items?.find(
            (i: ShoppingListItem) => i.id === itemId,
          );
          if (item) {
            const itemIndex = list.items?.findIndex(
              (i: ShoppingListItem) => i.id === itemId,
            );
            if (itemIndex !== -1 && itemIndex >= 0 && list.items) {
              const updatedItems = [...list.items];
              const currentItem = updatedItems[itemIndex];
              if (currentItem) {
                updatedItems[itemIndex] = { ...currentItem, checked };
              }

              const listIndex = integrationLists.findIndex(
                (l: ShoppingList) => l.id === list.id,
              );
              if (listIndex !== -1) {
                const updatedList = { ...list, items: updatedItems };
                const updatedLists = [...integrationLists];
                updatedLists[listIndex] = updatedList;

                updateIntegrationCache(
                  "shopping",
                  targetList.integrationId,
                  updatedLists,
                );
              }
            }
            break;
          }
        }
      }

      try {
        await _toggleIntegrationItem(targetList.integrationId, itemId, checked);
      } catch (error) {
        if (integrationLists && previousLists.length > 0) {
          updateIntegrationCache(
            "shopping",
            targetList.integrationId,
            previousLists,
          );
        }
        throw error;
      }
    } else {
      const { data: cachedLists } = useNuxtData("native-shopping-lists");
      const previousLists = cachedLists.value ? [...cachedLists.value] : [];

      if (cachedLists.value && Array.isArray(cachedLists.value)) {
        for (
          let listIndex = 0;
          listIndex < cachedLists.value.length;
          listIndex++
        ) {
          const list = cachedLists.value[listIndex];
          const itemIndex = list.items?.findIndex(
            (i: ShoppingListItem) => i.id === itemId,
          );
          if (itemIndex !== -1 && itemIndex >= 0 && list.items) {
            const updatedItems = [...list.items];
            const currentItem = updatedItems[itemIndex];
            if (currentItem) {
              updatedItems[itemIndex] = { ...currentItem, checked };
            }
            const updatedList = { ...list, items: updatedItems };
            const updatedLists = [...cachedLists.value];
            updatedLists[listIndex] = updatedList;
            cachedLists.value = updatedLists;
            break;
          }
        }
      }

      try {
        await updateShoppingListItem(itemId, { checked });
      } catch (error) {
        if (cachedLists.value && previousLists.length > 0) {
          cachedLists.value.splice(
            0,
            cachedLists.value.length,
            ...previousLists,
          );
        }
        throw error;
      }
    }
  } catch (error) {
    consola.error("Shopping List: Failed to toggle item:", error);
    showError("Failed to Toggle", "Failed to toggle item. Please try again.");
  }
}

async function handleDeleteList(listId: string) {
  try {
    if (editingList.value?.source === "native" || !editingList.value?.source) {
      const { data: cachedLists } = useNuxtData("native-shopping-lists");
      const previousLists = cachedLists.value ? [...cachedLists.value] : [];

      if (cachedLists.value && Array.isArray(cachedLists.value)) {
        const listIndex = cachedLists.value.findIndex(
          (l: ShoppingList) => l.id === listId,
        );
        if (listIndex !== -1) {
          cachedLists.value.splice(listIndex, 1);
        }
      }

      try {
        await deleteShoppingList(listId);
      } catch (error) {
        if (cachedLists.value && previousLists.length > 0) {
          cachedLists.value.splice(
            0,
            cachedLists.value.length,
            ...previousLists,
          );
        }
        throw error;
      }
    } else {
      showWarning(
        "Warning",
        "Deleting lists in integrations is not yet supported.",
      );
    }
  } catch (error) {
    consola.error("Shopping List: Failed to delete list:", error);
    showError("Error", "Failed to delete list. Please try again.");
  }
}

const reorderingItems = ref(new Set<string>());

async function handleReorderItem(itemId: string, direction: "up" | "down") {
  if (reorderingItems.value.has(itemId)) return;

  reorderingItems.value.add(itemId);

  try {
    const list = findItemList(itemId);
    if (!list) {
      throw new Error("Item not found in any list");
    }

    if (list.source === "integration") {
      showWarning(
        "Reorder Not Supported",
        "Reordering items in integration lists is not currently supported.",
      );
    } else {
      const { data: cachedLists } = useNuxtData("native-shopping-lists");
      const previousLists = cachedLists.value ? [...cachedLists.value] : [];

      if (cachedLists.value && Array.isArray(cachedLists.value)) {
        const listIndex = cachedLists.value.findIndex(
          (l: ShoppingList) => l.id === list.id,
        );
        if (listIndex !== -1) {
          const list = cachedLists.value[listIndex];
          const items = list.items || [];
          const itemIndex = items.findIndex(
            (i: ShoppingListItem) => i.id === itemId,
          );

          if (itemIndex !== -1) {
            const newItems = [...items];
            if (direction === "up" && itemIndex > 0) {
              [newItems[itemIndex], newItems[itemIndex - 1]] = [
                newItems[itemIndex - 1],
                newItems[itemIndex],
              ];
            } else if (
              direction === "down" &&
              itemIndex < newItems.length - 1
            ) {
              [newItems[itemIndex], newItems[itemIndex + 1]] = [
                newItems[itemIndex + 1],
                newItems[itemIndex],
              ];
            }
            list.items = newItems;
          }
        }
      }

      try {
        await reorderItem(itemId, direction);
      } catch (error) {
        if (cachedLists.value && previousLists.length > 0) {
          cachedLists.value.splice(
            0,
            cachedLists.value.length,
            ...previousLists,
          );
        }
        throw error;
      }
    }
  } catch (error) {
    consola.error("Shopping List: Failed to reorder item:", error);
    showError("Reorder Failed", "Failed to reorder item. Please try again.");
  } finally {
    reorderingItems.value.delete(itemId);
  }
}

const reorderingLists = ref(new Set<string>());

async function handleReorderList(listId: string, direction: "up" | "down") {
  if (reorderingLists.value.has(listId)) return;

  reorderingLists.value.add(listId);

  try {
    const list = allShoppingLists.value.find((l) => l.id === listId);
    if (!list) {
      throw new Error("List not found");
    }

    if (list.source === "integration") {
      showWarning(
        "Reorder Not Supported",
        "Reordering integration lists is not currently supported.",
      );
    } else {
      const { data: cachedLists } = useNuxtData("native-shopping-lists");
      const previousLists = cachedLists.value ? [...cachedLists.value] : [];

      if (cachedLists.value && Array.isArray(cachedLists.value)) {
        const lists = [...cachedLists.value].sort(
          (a, b) => (a.order || 0) - (b.order || 0),
        );
        const listIndex = lists.findIndex((l: ShoppingList) => l.id === listId);

        if (listIndex !== -1) {
          if (direction === "up" && listIndex > 0) {
            [lists[listIndex], lists[listIndex - 1]] = [
              lists[listIndex - 1],
              lists[listIndex],
            ];
            lists[listIndex].order = listIndex;
            lists[listIndex - 1].order = listIndex - 1;
          } else if (direction === "down" && listIndex < lists.length - 1) {
            [lists[listIndex], lists[listIndex + 1]] = [
              lists[listIndex + 1],
              lists[listIndex],
            ];
            lists[listIndex].order = listIndex;
            lists[listIndex + 1].order = listIndex + 1;
          }

          cachedLists.value.splice(0, cachedLists.value.length, ...lists);
        }
      }

      try {
        await reorderShoppingList(listId, direction);
      } catch (error) {
        if (cachedLists.value && previousLists.length > 0) {
          cachedLists.value.splice(
            0,
            cachedLists.value.length,
            ...previousLists,
          );
        }
        throw error;
      }
    }
  } catch (error) {
    consola.error("Shopping List: Failed to reorder shopping list:", error);
    showError(
      "Reorder Failed",
      "Failed to reorder shopping list. Please try again.",
    );
  } finally {
    reorderingLists.value.delete(listId);
  }
}

async function handleClearCompleted(listId: string) {
  try {
    const list = allShoppingLists.value.find((l) => l.id === listId);
    if (!list) {
      throw new Error("List not found");
    }

    if (list.source === "integration") {
      if (!list.integrationId) {
        throw new Error("Integration ID is required");
      }

      const integrationLists = getCachedIntegrationData(
        "shopping",
        list.integrationId,
      ) as ShoppingList[];
      const previousLists = integrationLists ? [...integrationLists] : [];
      let completedItemIds: string[] = [];

      if (integrationLists && Array.isArray(integrationLists)) {
        const listIndex = integrationLists.findIndex(
          (l: ShoppingList) => l.id === listId,
        );
        if (listIndex !== -1) {
          const cachedList = integrationLists[listIndex];
          if (cachedList && cachedList.items) {
            completedItemIds = cachedList.items
              .filter((item: ShoppingListItem) => item.checked)
              .map((item: ShoppingListItem) => item.id);

            const completedItems = cachedList.items.filter(
              (item: ShoppingListItem) => item.checked,
            );
            const updatedItems = cachedList.items.filter(
              (item: ShoppingListItem) => !item.checked,
            );
            const updatedList: ShoppingList = {
              ...cachedList,
              items: updatedItems,
              _count: cachedList._count
                ? {
                    ...cachedList._count,
                    items: Math.max(
                      0,
                      (cachedList._count.items || 0) - completedItems.length,
                    ),
                  }
                : undefined,
            };
            const updatedLists = [...integrationLists];
            updatedLists[listIndex] = updatedList;

            updateIntegrationCache(
              "shopping",
              list.integrationId,
              updatedLists,
            );
          }
        }
      }

      try {
        await clearIntegrationCompletedItems(
          list.integrationId,
          listId,
          completedItemIds,
        );
      } catch (error) {
        if (integrationLists && previousLists.length > 0) {
          updateIntegrationCache("shopping", list.integrationId, previousLists);
        }
        throw error;
      }
    } else {
      const { data: cachedLists } = useNuxtData("native-shopping-lists");
      const previousLists = cachedLists.value ? [...cachedLists.value] : [];

      let completedItemIds: string[] = [];
      if (cachedLists.value && Array.isArray(cachedLists.value)) {
        const listIndex = cachedLists.value.findIndex(
          (l: ShoppingList) => l.id === listId,
        );
        if (listIndex !== -1) {
          const cachedList = cachedLists.value[listIndex];
          if (cachedList && cachedList.items) {
            completedItemIds = cachedList.items
              .filter((item: ShoppingListItem) => item.checked)
              .map((item: ShoppingListItem) => item.id);

            const completedItems = cachedList.items.filter(
              (item: ShoppingListItem) => item.checked,
            );
            const updatedItems = cachedList.items.filter(
              (item: ShoppingListItem) => !item.checked,
            );
            const updatedList: ShoppingList = {
              ...cachedList,
              items: updatedItems,
              _count: cachedList._count
                ? {
                    ...cachedList._count,
                    items: Math.max(
                      0,
                      (cachedList._count.items || 0) - completedItems.length,
                    ),
                  }
                : undefined,
            };
            const updatedLists = [...cachedLists.value];
            updatedLists[listIndex] = updatedList;
            cachedLists.value = updatedLists;
          }
        }
      }

      try {
        await deleteCompletedItems(listId, completedItemIds);
      } catch (error) {
        if (cachedLists.value && previousLists.length > 0) {
          cachedLists.value.splice(
            0,
            cachedLists.value.length,
            ...previousLists,
          );
        }
        throw error;
      }
    }
  } catch (error) {
    consola.error("Shopping List: Failed to clear completed items:", error);
    showError(
      "Clear Failed",
      "Failed to clear completed items. Please try again.",
    );
  }
}

function findItemList(itemId: string) {
  return allShoppingLists.value.find((list) =>
    list.items?.some((item: ShoppingListItem) => item.id === itemId),
  );
}

function getIntegrationIconUrl(integration: {
  icon?: string | null;
  type: string;
  service: string;
}) {
  if (integration.icon) {
    return integration.icon;
  }

  const config = integrationRegistry.get(
    `${integration.type}:${integration.service}`,
  );
  return config?.icon || null;
}

function getIntegrationCapabilities(integrationId: string): string[] {
  const integrations = shoppingIntegrations.value as Integration[];
  const integration = integrations.find((i) => i.id === integrationId);
  if (!integration) return [];

  const config = integrationRegistry.get(
    `${integration.type}:${integration.service}`,
  );
  return config?.capabilities || [];
}

function hasCapability(integrationId: string, capability: string): boolean {
  const capabilities = getIntegrationCapabilities(integrationId);
  return capabilities.includes(capability);
}

function getIntegrationType(): string | undefined {
  if (editingItem.value?.source === "integration") {
    const integrations: Integration[] =
      shoppingIntegrations.value as Integration[];
    const integration = integrations.find(
      (i) => i.id === editingItem.value?.integrationId,
    );
    return integration?.service;
  }

  if (selectedListId.value) {
    const selectedList = allShoppingLists.value.find(
      (list) => list.id === selectedListId.value,
    );
    if (selectedList?.source === "integration") {
      const integrations: Integration[] =
        shoppingIntegrations.value as Integration[];
      const integration = integrations.find(
        (i) => i.id === selectedList.integrationId,
      );
      return integration?.service;
    }
  }

  return undefined;
}

function getItemIntegrationCapabilities(): string[] | undefined {
  if (editingItem.value?.source === "integration") {
    if (!editingItem.value.integrationId) {
      return undefined;
    }
    return getIntegrationCapabilities(editingItem.value.integrationId);
  }

  if (selectedListId.value) {
    const selectedList = allShoppingLists.value.find(
      (list) => list.id === selectedListId.value,
    );
    if (selectedList?.source === "integration") {
      if (!selectedList.integrationId) {
        return undefined;
      }
      return getIntegrationCapabilities(selectedList.integrationId);
    }
  }

  return undefined;
}

function getFilteredFieldsForItem(
  item: ShoppingListItem,
  integrationType: string | undefined,
): DialogField[] {
  const baseFields: DialogField[] = integrationType
    ? getIntegrationFields(integrationType)
    : [
        {
          key: "name",
          label: "Item Name",
          type: "text" as const,
          placeholder: "Milk, Bread, Apples, etc.",
          required: true,
          canEdit: true,
        },
        {
          key: "quantity",
          label: "Quantity",
          type: "number" as const,
          min: 0,
          canEdit: true,
        },
        {
          key: "unit",
          label: "Unit",
          type: "text" as const,
          placeholder: "Can, Box, etc.",
          canEdit: true,
        },
        {
          key: "notes",
          label: "Notes",
          type: "textarea" as const,
          placeholder: "Additional notes (optional)",
          canEdit: true,
        },
      ];

  return getFieldsForItem(item, integrationType, baseFields) as DialogField[];
}
</script>

<template>
  <div class="flex h-[calc(100vh-2rem)] w-full flex-col rounded-lg">
    <div
      class="py-5 sm:px-4 sticky top-0 z-40 bg-default border-b border-default"
    >
      <GlobalDateHeader />
    </div>

    <div class="flex-1 overflow-y-auto">
      <GlobalList
        :lists="transformedShoppingLists"
        :loading="isLoading"
        empty-state-icon="i-lucide-shopping-cart"
        empty-state-title="No shopping lists found"
        empty-state-description="Create your first shopping list to get started"
        show-quantity
        :show-notes="true"
        show-reorder
        :show-edit="
          (list) => {
            const shoppingList = list as ShoppingListWithIntegration;
            return shoppingList.source === 'native';
          }
        "
        :show-add="
          (list) => {
            const shoppingList = list as ShoppingListWithIntegration;
            return (
              shoppingList.source === 'native' ||
              (shoppingList.integrationId
                ? hasCapability(shoppingList.integrationId!, 'add_items')
                : false)
            );
          }
        "
        :show-edit-item="
          (list) => {
            const shoppingList = list as ShoppingListWithIntegration;
            return (
              shoppingList.source === 'native' ||
              (shoppingList.integrationId
                ? hasCapability(shoppingList.integrationId!, 'edit_items')
                : false)
            );
          }
        "
        :show-completed="
          (list) => {
            const shoppingList = list as ShoppingListWithIntegration;
            return (
              shoppingList.source === 'native' ||
              (shoppingList.integrationId
                ? hasCapability(shoppingList.integrationId!, 'clear_items')
                : false)
            );
          }
        "
        show-integration-icons
        @create="openCreateList"
        @edit="
          editingList = $event as ShoppingListWithIntegration;
          listDialog = true;
        "
        @delete="handleDeleteList"
        @add-item="openAddItem"
        @edit-item="(item) => openEditItem(item as ShoppingListItem)"
        @toggle-item="handleToggleItem"
        @reorder-item="handleReorderItem"
        @reorder-list="handleReorderList"
        @clear-completed="handleClearCompleted"
      />
    </div>

    <GlobalFloatingActionButton
      icon="i-lucide-plus"
      label="Create new shopping list"
      color="primary"
      size="lg"
      position="bottom-right"
      @click="openCreateList"
    />

    <ShoppingListDialog
      :is-open="listDialog"
      :list="editingList"
      :integration-capabilities="
        editingList?.source === 'integration' && editingList.integrationId
          ? getIntegrationCapabilities(editingList.integrationId)
          : undefined
      "
      @close="
        listDialog = false;
        editingList = null;
      "
      @save="handleListSave"
      @delete="handleListDelete"
    />

    <ShoppingListItemDialog
      :is-open="itemDialog"
      :item="editingItem"
      :fields="
        getFilteredFieldsForItem(
          editingItem ?? ({ integrationData: {} } as ShoppingListItem),
          getIntegrationType(),
        )
      "
      :integration-capabilities="getItemIntegrationCapabilities()"
      @close="
        itemDialog = false;
        selectedListId = '';
        editingItem = null;
      "
      @save="handleItemSave"
      @delete="handleItemDelete"
    />
  </div>
</template>
