import type { ShoppingList, TodoList } from "~/types/database";

export type ConnectionTestResult = {
  success: boolean;
  message?: string;
  error?: string;
  isLoading?: boolean;
} | null;

export type ShoppingListWithIntegration = ShoppingList & {
  source: "native" | "integration";
  integrationId?: string;
  integrationName?: string;
  integrationIcon?: string | null;
};

export type TodoListWithIntegration = TodoList & {
  source: "native" | "integration";
  integrationId?: string;
  integrationName?: string;
  integrationIcon?: string | null;
};

export type AnyListWithIntegration
  = | ShoppingListWithIntegration
    | TodoListWithIntegration;

export type ToggleEvent = {
  itemId: string;
  checked: boolean;
};

export type ReorderEvent = {
  itemId: string;
  newOrder: number;
  direction?: "up" | "down";
};

export type ReorderDirectionEvent = {
  itemId: string;
  direction: "up" | "down";
};

export type DialogField = {
  key: string;
  label: string;
  type: "text" | "number" | "textarea";
  placeholder?: string;
  min?: number;
  required?: boolean;
  disabled?: boolean;
  canEdit: boolean;
};

export type IntegrationSettingsField = {
  key: string;
  label: string;
  type: "text" | "password" | "url" | "color" | "boolean";
  placeholder?: string;
  required?: boolean;
  description?: string;
};

export type ToastType = "error" | "warning" | "success" | "info";

export type GlobalFloatingActionButtonProps = {
  icon?: string;
  label?: string;
  color?: "primary" | "secondary" | "success" | "warning" | "error";
  size?: "sm" | "md" | "lg";
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  disabled?: boolean;
};

export type ClientPreferences = {
  colorMode?: "light" | "dark" | "system";
  notifications?: boolean;
};

export const defaultClientPreferences: ClientPreferences = {
  colorMode: "system",
  notifications: false,
};
