import type { CalendarView } from "~/types/calendar";
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

const SYSTEM_FONT_STACK = "ui-sans-serif, system-ui, sans-serif";

const FONT_PREFERENCES = [
  { value: "system", label: "System", stack: SYSTEM_FONT_STACK },
  {
    value: "inclusiveSans",
    label: "Inclusive Sans",
    stack: `"Inclusive Sans", ${SYSTEM_FONT_STACK}`,
  },
  {
    value: "notoSans",
    label: "Noto Sans",
    stack: `"Noto Sans", ${SYSTEM_FONT_STACK}`,
  },
  {
    value: "ebGaramond",
    label: "EB Garamond",
    stack: `"EB Garamond", ${SYSTEM_FONT_STACK}`,
  },
  {
    value: "ibmPlexMono",
    label: "IBM Plex Mono",
    stack: `"IBM Plex Mono", ${SYSTEM_FONT_STACK}`,
  },
  {
    value: "ovo",
    label: "Ovo",
    stack: `"Ovo", ${SYSTEM_FONT_STACK}`,
  },
  {
    value: "handlee",
    label: "Handlee",
    stack: `"Handlee", ${SYSTEM_FONT_STACK}`,
  },
] as const;

export type FontPreference = (typeof FONT_PREFERENCES)[number]["value"];

export type TodoSortMode = "date" | "priority" | "alpha";

export type ClientPreferences = {
  colorMode?: "light" | "dark" | "system";
  notifications?: boolean;
  font?: FontPreference;
  todoSortBy?: TodoSortMode;
  defaultView?: string;
  calendarView?: CalendarView;
};

export const MAIN_VIEW_OPTIONS: { path: string; label: string }[] = [
  { path: "/calendar", label: "Calendar" },
  { path: "/toDoLists", label: "Todo Lists" },
  { path: "/shoppingLists", label: "Shopping Lists" },
  { path: "/mealplanner", label: "Meal Planner" },
];

export const defaultClientPreferences: ClientPreferences = {
  colorMode: "system",
  notifications: false,
  font: "system",
  todoSortBy: "date",
  defaultView: "/calendar",
  calendarView: "week",
};

export const TODO_SORT_OPTIONS: { value: TodoSortMode; label: string }[] = [
  { value: "date", label: "Date" },
  { value: "priority", label: "Priority" },
  { value: "alpha", label: "A-Z" },
];

export const FONT_STACKS: Record<FontPreference, string> = Object.fromEntries(
  FONT_PREFERENCES.map(f => [f.value, f.stack]),
) as Record<FontPreference, string>;

export const FONT_OPTIONS: { label: string; value: FontPreference }[]
  = FONT_PREFERENCES.map(({ value, label }) => ({ value, label }));

export function getFontStack(font: FontPreference | undefined): string {
  if (!font || font === "system")
    return SYSTEM_FONT_STACK;
  return FONT_STACKS[font] ?? SYSTEM_FONT_STACK;
}
