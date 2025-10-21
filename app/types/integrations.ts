import consola from "consola";

import type { CalendarEvent } from "~/types/calendar";
import type { CreateShoppingListItemInput, CreateTodoInput, Integration, ShoppingListItem, ShoppingListWithItemsAndCount, Todo, TodoWithUser, UpdateShoppingListItemInput, UpdateTodoInput } from "~/types/database";
import type { DialogField, IntegrationSettingsField } from "~/types/ui";

import { getServiceFactories, integrationConfigs } from "~/integrations/integrationConfig";

export type IntegrationService = {
  initialize: () => Promise<void>;
  validate: () => Promise<boolean>;
  getStatus: () => Promise<IntegrationStatus>;

  testConnection?: () => Promise<boolean>;
  getCapabilities?: () => Promise<string[]>;
};

export type IntegrationStatus = {
  isConnected: boolean;
  lastChecked: Date;
  error?: string;
};

export type CalendarIntegrationService = IntegrationService & {
  getEvents: () => Promise<CalendarEvent[]>;
};

export type ShoppingIntegrationService = IntegrationService & {
  getShoppingLists: () => Promise<ShoppingListWithItemsAndCount[]>;
};

export type TodoIntegrationService = IntegrationService & {
  getTodos: () => Promise<TodoWithUser[]>;
};

export type UserWithColor = {
  id: string;
  name: string;
  color: string | null;
};

export type IntegrationConfig = {
  type: string;
  service: string;
  settingsFields: IntegrationSettingsField[];
  capabilities: string[];
  icon: string;
  files: string[];
  dialogFields: DialogField[];
  syncInterval: number;
  customSaveHandler?: (
    integrationData: Record<string, unknown>,
    settingsData: Record<string, unknown>,
    isExisting: boolean,
    originalIntegration?: Integration | null,
  ) => Promise<boolean>;
};

export type ICalSettings = {
  eventColor?: string;
  user?: string[];
  useUserColors?: boolean;
};

export type CalendarConfig = {
  id: string;
  name: string;
  enabled: boolean;
  user?: string[];
  eventColor?: string;
  useUserColors?: boolean;
};

export type GoogleCalendarSettings = {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  tokenExpiry?: number;
  needsReauth?: boolean;
  calendars?: CalendarConfig[];
};

export type IntegrationSettings = ICalSettings | GoogleCalendarSettings;

export const integrationRegistry = new Map<string, IntegrationConfig>();

export function registerIntegration(config: IntegrationConfig) {
  const key = `${config.type}:${config.service}`;
  integrationRegistry.set(key, config);
}

let isInitialized = false;

function ensureInitialized() {
  if (!isInitialized) {
    for (const config of integrationConfigs) {
      const key = `${config.type}:${config.service}`;
      integrationRegistry.set(key, config);
    }
    isInitialized = true;
  }
}

export async function createIntegrationService(integration: Integration): Promise<IntegrationService | null> {
  ensureInitialized();
  try {
    const key = `${integration.type}:${integration.service}`;
    const serviceFactory = getServiceFactories().find(sf => sf.key === key);

    if (!serviceFactory) {
      consola.warn(`No service factory found for integration type: ${key}`);
      return null;
    }

    return serviceFactory.factory(integration.id, integration.apiKey || "", integration.baseUrl || "", integration.settings as IntegrationSettings);
  }
  catch (error) {
    consola.error(`Failed to create integration service for ${integration.type}:${integration.service}:`, error);
    return null;
  }
}

export type ServerShoppingIntegrationService = {
  getShoppingLists: () => Promise<ShoppingListWithItemsAndCount[]>;
  addItemToList?: (listId: string, item: CreateShoppingListItemInput) => Promise<ShoppingListItem>;
  updateShoppingListItem?: (itemId: string, updates: UpdateShoppingListItemInput) => Promise<ShoppingListItem>;
  toggleItem?: (itemId: string, checked: boolean) => Promise<void>;
  deleteShoppingListItems?: (ids: string[]) => Promise<void>;
};

export type ServerTodoIntegrationService = {
  getTodos: () => Promise<TodoWithUser[]>;
  addTodo?: (todo: CreateTodoInput) => Promise<Todo>;
  updateTodo?: (todoId: string, updates: UpdateTodoInput) => Promise<Todo>;
  deleteTodo?: (todoId: string) => Promise<void>;
};

export type ServerCalendarIntegrationService = {
  getEvents: () => Promise<CalendarEvent[]>;
  addEvent?: (event: Omit<CalendarEvent, "id">) => Promise<CalendarEvent>;
  updateEvent?: (eventId: string, updates: Partial<CalendarEvent>) => Promise<CalendarEvent>;
  deleteEvent?: (eventId: string) => Promise<void>;
};

export type ServerTypedIntegrationService
  = | ServerShoppingIntegrationService
    | ServerTodoIntegrationService
    | ServerCalendarIntegrationService;
