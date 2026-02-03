import type { JsonObject } from "type-fest";

import { consola } from "consola";

import type {
  ShoppingList,
  ShoppingListItem,
  UpdateShoppingListItemInput,
} from "~/types/database";
import type {
  IntegrationService,
  IntegrationStatus,
} from "~/types/integrations";

import { useStableDate } from "~/composables/useStableDate";
import { integrationRegistry } from "~/types/integrations";

import type { TandoorShoppingListEntry } from "../../../server/integrations/tandoor/types";

export class TandoorService implements IntegrationService {
  private integrationId: string;
  private apiKey: string;
  private baseUrl: string;

  private parseStableDate: (dateInput?: string | Date, fallback?: Date) => Date;

  private status: IntegrationStatus = {
    isConnected: false,
    lastChecked: new Date(),
  };

  constructor(integrationId: string, apiKey: string, baseUrl: string) {
    this.integrationId = integrationId;
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;

    if (import.meta.client) {
      const { parseStableDate, getStableDate } = useStableDate();
      this.parseStableDate = parseStableDate;
      this.status.lastChecked = getStableDate();
    } else {
      this.parseStableDate = (dateInput?: string | Date, fallback?: Date) => {
        if (!dateInput) return fallback || new Date();
        return new Date(dateInput);
      };
      this.status.lastChecked = new Date();
    }
  }

  private getCurrentDate(): Date {
    if (import.meta.client) {
      const { getStableDate } = useStableDate();
      return getStableDate();
    } else {
      return new Date();
    }
  }

  async initialize(): Promise<void> {
    await this.validate();
  }

  async validate(): Promise<boolean> {
    try {
      await $fetch("/api/integrations/tandoor/shopping-list-entry/", {
        query: { integrationId: this.integrationId },
      });

      this.status = {
        isConnected: true,
        lastChecked: this.getCurrentDate(),
      };

      return true;
    } catch (error) {
      this.status = {
        isConnected: false,
        lastChecked: this.getCurrentDate(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
      return false;
    }
  }

  async getStatus(): Promise<IntegrationStatus> {
    return this.status;
  }

  async testConnection(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/api/shopping-list-entry/`;
      const headers = {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      };
      const response = await fetch(url, {
        method: "GET",
        headers,
      });
      if (!response.ok) {
        this.status = {
          isConnected: false,
          lastChecked: this.getCurrentDate(),
          error: `API error: ${response.status} ${response.statusText}`,
        };
        return false;
      }
      this.status = {
        isConnected: true,
        lastChecked: this.getCurrentDate(),
      };
      return true;
    } catch (error) {
      this.status = {
        isConnected: false,
        lastChecked: this.getCurrentDate(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
      return false;
    }
  }

  async getCapabilities(): Promise<string[]> {
    const config = integrationRegistry.get("shopping:tandoor");
    return config?.capabilities || [];
  }

  async getShoppingLists(): Promise<ShoppingList[]> {
    try {
      const response = await $fetch<{ results: TandoorShoppingListEntry[] }>(
        "/api/integrations/tandoor/shopping-list-entry/",
        {
          query: { integrationId: this.integrationId },
        },
      );

      if (!response || !response.results || !Array.isArray(response.results)) {
        consola.warn(
          "Tandoor Shopping Lists: Service returned invalid response:",
          response,
        );
        return [];
      }

      const items: ShoppingListItem[] = response.results.map(
        (entry: TandoorShoppingListEntry, index) => ({
          id: entry.id.toString(),
          name: entry.food?.name || "Unknown",
          checked: entry.checked,
          order: entry.order || index,
          notes: null,
          quantity: entry.amount,
          unit: entry.unit?.name || null,
          label: null,
          food: null,
          integrationData: entry as unknown as JsonObject,
        }),
      );

      return [
        {
          id: "default",
          name: "Shopping List",
          order: 0,
          createdAt: this.parseStableDate(),
          updatedAt: this.parseStableDate(),
          items,
          _count: {
            items: items.length,
          },
        },
      ];
    } catch (error) {
      consola.error(
        "Tandoor Shopping Lists: Error fetching shopping lists:",
        error,
      );
      throw error;
    }
  }

  async getShoppingList(id: string): Promise<ShoppingList> {
    const lists = await this.getShoppingLists();
    const list = lists.find((l) => l.id === id);

    if (!list) {
      throw new Error(`Shopping list with id ${id} not found`);
    }

    return list;
  }

  async addItemToList(
    listId: string,
    item: {
      name: string;
      quantity: number;
      unit?: string;
      notes?: string;
    },
  ): Promise<ShoppingListItem> {
    const tandoorItem = {
      food: { name: item.name },
      unit: item.unit ? { name: item.unit } : undefined,
      amount: item.quantity.toString(),
      list_recipe: undefined,
    };

    const createdEntry = await $fetch<TandoorShoppingListEntry>(
      "/api/integrations/tandoor/shopping-list-entry/",
      {
        method: "POST",
        query: { integrationId: this.integrationId },
        body: tandoorItem,
      },
    );

    return {
      id: createdEntry.id.toString(),
      name: createdEntry.food.name,
      checked: createdEntry.checked,
      order: createdEntry.order,
      notes: null,
      quantity: createdEntry.amount,
      unit: createdEntry.unit?.name || null,
      label: null,
      food: null,
      integrationData: createdEntry as unknown as JsonObject,
    };
  }

  async updateShoppingListItem(
    itemId: string,
    updates: UpdateShoppingListItemInput,
  ): Promise<ShoppingListItem> {
    try {
      const tandoorUpdates: Record<string, unknown> = {};

      if (updates.name !== undefined) {
        tandoorUpdates.food = { name: updates.name };
      }
      if (updates.checked !== undefined) {
        tandoorUpdates.checked = updates.checked;
      }
      if (updates.quantity !== undefined) {
        tandoorUpdates.amount = updates.quantity.toString();
      }
      if (updates.order !== undefined) {
        tandoorUpdates.order = updates.order;
      }

      const updatedEntry = await $fetch<TandoorShoppingListEntry>(
        `/api/integrations/tandoor/shopping-list-entry/${itemId}/`,
        {
          method: "PATCH",
          query: { integrationId: this.integrationId },
          body: tandoorUpdates,
        },
      );

      return {
        id: updatedEntry.id.toString(),
        name: updatedEntry.food.name,
        checked: updatedEntry.checked,
        order: updatedEntry.order,
        notes: null,
        quantity: updatedEntry.amount,
        unit: updatedEntry.unit?.name || null,
        label: null,
        food: null,
        integrationData: updatedEntry as unknown as JsonObject,
      };
    } catch (error) {
      consola.error(
        `Tandoor Shopping Lists: Error updating item ${itemId}:`,
        error,
      );
      throw new Error(
        `Failed to update item: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async toggleItem(
    itemId: string,
    checked: boolean,
  ): Promise<ShoppingListItem> {
    try {
      const updatedEntry = await $fetch<TandoorShoppingListEntry>(
        `/api/integrations/tandoor/shopping-list-entry/${itemId}/`,
        {
          method: "PATCH",
          query: { integrationId: this.integrationId },
          body: { checked },
        },
      );

      return {
        id: updatedEntry.id.toString(),
        name: updatedEntry.food.name,
        checked: updatedEntry.checked,
        order: updatedEntry.order,
        notes: null,
        quantity: updatedEntry.amount,
        unit: updatedEntry.unit?.name || null,
        label: null,
        food: null,
        integrationData: updatedEntry as unknown as JsonObject,
      };
    } catch (error) {
      consola.error(
        `Tandoor Shopping Lists: Error toggling item ${itemId}:`,
        error,
      );
      throw new Error(
        `Failed to toggle item: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
}

export function createTandoorService(
  integrationId: string,
  apiKey: string,
  baseUrl: string,
): TandoorService {
  return new TandoorService(integrationId, apiKey, baseUrl);
}

export function getTandoorFieldsForItem(
  item: { unit?: unknown } | null | undefined,
  allFields: { key: string }[],
): { key: string }[] {
  if (!item || item.unit === null || item.unit === undefined) {
    return allFields.filter((field) => field.key !== "unit");
  }
  return allFields;
}
