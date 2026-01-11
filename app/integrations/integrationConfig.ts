import type { ICalSettings, IntegrationConfig } from "~/types/integrations";
// Shared integrations configuration
// This file contains all integration configurations that are used by both client and server
import type { DialogField } from "~/types/ui";

import { createGoogleCalendarService } from "./google-calendar/googleCalendar";
import { createICalService } from "./iCal/iCalendar";
import { createMealieService, getMealieFieldsForItem } from "./mealie/mealieShoppingLists";
import { createTandoorService, getTandoorFieldsForItem } from "./tandoor/tandoorShoppingLists";

export const integrationConfigs: IntegrationConfig[] = [
  // ================================================
  // Calendar integration configs can support the following list-level capabilities:
  // - get_events: Can get events from the calendar
  // - add_events: Can add events to the calendar
  // - edit_events: Can edit events in the calendar
  // - delete_events: Can delete events from the calendar
  // ================================================
  {
    type: "calendar",
    service: "iCal",
    settingsFields: [
      {
        key: "baseUrl",
        label: "URL",
        type: "url" as const,
        placeholder: "https://example.com/calendar.ics",
        required: true,
        description: "Your iCal URL",
      },
      {
        key: "user",
        label: "User",
        type: "text" as const,
        placeholder: "Jane Doe",
        required: false,
        description: "Select user(s) to link to this calendar or choose an event color",
      },
      {
        key: "eventColor",
        label: "Event Color",
        type: "color" as const,
        placeholder: "#06b6d4",
        required: false,
      },
      {
        key: "useUserColors",
        label: "Use User Profile Colors",
        type: "boolean" as const,
        required: false,
        description: "Use individual user profile colors for events instead of a single event color",
      },
    ],
    capabilities: ["get_events"],
    icon: "https://unpkg.com/lucide-static@latest/icons/calendar.svg",
    files: [],
    dialogFields: [],
    syncInterval: 10,
  },
  // ================================================
  // Meal integration configs can support the following list-level capabilities:
  // ================================================
  // TODO: Add meal integration configs
  // TODO: Define meal capabilities
  // ================================================
  // Shopping integration configs can support the following list-level capabilities:
  // - add_items: Can add new items to lists
  // - clear_items: Can clear completed items from lists
  // - edit_items: Can edit existing items in lists
  // - delete_items: Can delete items from lists
  // ================================================
  {
    type: "shopping",
    service: "tandoor",
    settingsFields: [
      {
        key: "apiKey",
        label: "API Key",
        type: "password" as const,
        placeholder: "Scope needs to be \"read write\"",
        required: true,
        description: "Your Tandoor API key for authentication",
      },
      {
        key: "baseUrl",
        label: "Base URL",
        type: "url" as const,
        placeholder: "http://your-tandoor-instance:port",
        required: true,
        description: "The base URL of your Tandoor instance",
      },
    ],
    capabilities: ["add_items", "edit_items"],
    icon: "https://cdn.jsdelivr.net/gh/selfhst/icons/svg/tandoor-recipes.svg",
    files: [
      "/integrations/tandoor/tandoorShoppingLists.ts",
      "/server/api/integrations/tandoor/[...path].ts",
      "/server/integrations/tandoor/",
    ],
    dialogFields: [
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
        placeholder: "Disabled for Tandoor",
        canEdit: false,
      },
    ],
    syncInterval: 5,
  },
  {
    type: "shopping",
    service: "mealie",
    settingsFields: [
      {
        key: "apiKey",
        label: "API Key",
        type: "password" as const,
        placeholder: "Enter your Mealie API key",
        required: true,
        description: "Your Mealie API key for authentication",
      },
      {
        key: "baseUrl",
        label: "Base URL",
        type: "url" as const,
        placeholder: "http://your-mealie-instance:port",
        required: true,
        description: "The base URL of your Mealie instance",
      },
    ],
    capabilities: ["add_items", "clear_items", "edit_items"],
    icon: "https://cdn.jsdelivr.net/gh/selfhst/icons/svg/mealie.svg",
    files: [
      "/integrations/mealie/mealieShoppingLists.ts",
      "/server/api/integrations/mealie/[...path].ts",
      "/server/integrations/mealie/",
    ],
    dialogFields: [
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
        placeholder: "Disabled for Mealie",
        canEdit: false,
      },
      {
        key: "notes",
        label: "Notes",
        type: "textarea" as const,
        placeholder: "Note...",
        canEdit: true,
      },
      {
        key: "food",
        label: "Food Item",
        type: "text" as const,
        placeholder: "Disabled for Mealie",
        canEdit: false,
      },
    ],
    syncInterval: 5,
  },
  // ================================================
  // TODO integration configs can support the following list-level capabilities:
  // ================================================
  // TODO: Add TODO integration configs
  // TODO: Define TODO capabilities
  // ================================================
];

const serviceFactoryMap = {
  "calendar:iCal": (_id: string, _apiKey: string, baseUrl: string, settings?: ICalSettings) => {
    const eventColor = settings?.eventColor || "#06b6d4";
    const user = settings?.user;
    const useUserColors = settings?.useUserColors || false;
    return createICalService(_id, baseUrl, eventColor, user, useUserColors);
  },
  "shopping:mealie": createMealieService,
  "shopping:tandoor": createTandoorService,
} as const;

const fieldFilters = {
  mealie: getMealieFieldsForItem,
  tandoor: getTandoorFieldsForItem,
};
export function getIntegrationFields(integrationType: string): DialogField[] {
  const config = integrationConfigs.find(c => c.service === integrationType);
  return config?.dialogFields || [];
}

export function getFieldsForItem(item: unknown, integrationType: string | undefined, allFields: { key: string }[]): { key: string }[] {
  if (!integrationType || !fieldFilters[integrationType as keyof typeof fieldFilters]) {
    return allFields;
  }

  const filterFunction = fieldFilters[integrationType as keyof typeof fieldFilters];

  if (integrationType === "mealie") {
    return (filterFunction as typeof getMealieFieldsForItem)(item as { integrationData?: { isFood?: boolean } } | null | undefined, allFields);
  }
  else if (integrationType === "tandoor") {
    return (filterFunction as typeof getTandoorFieldsForItem)(item as { unit?: unknown } | null | undefined, allFields);
  }

  return allFields;
}
export function getServiceFactories() {
  return integrationConfigs.map(config => ({
    key: `${config.type}:${config.service}`,
    factory: serviceFactoryMap[`${config.type}:${config.service}` as keyof typeof serviceFactoryMap],
  }));
}
