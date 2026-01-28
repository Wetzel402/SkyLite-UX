import type { Priority, Prisma } from "@prisma/client";

export type User = Prisma.UserGetPayload<Record<string, never>> & {
  avatar?: string | null;
  color?: string | null;
};
export type UserWithTodos = Prisma.UserGetPayload<{
  include: {
    todoColumn: {
      include: {
        todos: true;
      };
    };
  };
}>;

export type Todo = Prisma.TodoGetPayload<Record<string, never>>;
export type TodoWithUser = Prisma.TodoGetPayload<{
  include: {
    todoColumn: {
      include: {
        user: {
          select: {
            id: true;
            name: true;
            avatar: true;
          };
        };
      };
    };
  };
}>;

export type TodoColumn = Omit<Prisma.TodoColumnGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        name: true;
        avatar: true;
      };
    };
    todos: true;
    _count: {
      select: {
        todos: true;
      };
    };
  };
}>, "todos" | "createdAt" | "updatedAt"> & {
  todos?: Prisma.TodoGetPayload<Record<string, never>>[];
  createdAt: string;
  updatedAt: string;
};

export type TodoColumnBasic = Pick<TodoColumn, "id" | "name"> & {
  user?: {
    id: string;
    name: string;
    avatar: string | null;
  };
};

export type BaseListItem = {
  id: string;
  name: string;
  checked: boolean;
  order: number;
  notes: string | null;
};

export type ShoppingList = {
  id: string;
  name: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  items: readonly ShoppingListItem[];
  _count?: {
    items: number;
  };
  source?: "native" | "integration";
  integrationId?: string;
  integrationName?: string;
  integrationIcon?: string | null;
};

export type ShoppingListItem = BaseListItem & {
  quantity: number;
  unit: string | null;
  label: string | null;
  food: string | null;
  integrationData?: Record<string, any>;
  source?: "native" | "integration";
  integrationId?: string;
};

export type ShoppingListWithItems = Prisma.ShoppingListGetPayload<{
  include: { items: true };
}>;
export type ShoppingListWithItemsAndCount = Prisma.ShoppingListGetPayload<{
  include: {
    items: true;
    _count: { select: { items: true } };
  };
}>;

export type Integration = {
  id: string;
  name: string;
  type: string;
  service: string;
  apiKey: string | null;
  baseUrl: string | null;
  icon: string | null;
  enabled: boolean;
  settings: Record<string, any> | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiry: Date | null;
  tokenType: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateIntegrationInput = Omit<Integration, "id" | "createdAt" | "updatedAt">;
export type UpdateIntegrationInput = Partial<CreateIntegrationInput>;

export type CreateUserInput = Omit<User, "id" | "createdAt" | "updatedAt" | "avatar" | "color">;
export type CreateTodoInput = Omit<Todo, "id" | "createdAt" | "updatedAt">;
export type CreateShoppingListInput = Omit<ShoppingList, "id" | "createdAt" | "updatedAt" | "items">;
export type CreateShoppingListItemInput = Omit<ShoppingListItem, "id" | "shoppingListId">;

export type UpdateTodoInput = Partial<Omit<Todo, "id" | "createdAt" | "updatedAt">>;
export type UpdateShoppingListItemInput = Partial<CreateShoppingListItemInput>;

export type TodoList = {
  id: string;
  name: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  isDefault: boolean;
  items: readonly TodoListItem[];
  _count?: {
    items: number;
  };
};

export type TodoListItem = BaseListItem & {
  description: string;
  priority: Priority;
  dueDate: Date | null;
  todoColumnId: string;
  shoppingListId: string;
};

export type TodoWithOrder = TodoWithUser & { order: number };

export type UserWithOrder = User & { todoOrder: number };

export type ShoppingListWithOrder = ShoppingListWithItemsAndCount & { order: number };

export type RawIntegrationList = {
  readonly id: string;
  readonly name: string;
  readonly order: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly items: readonly RawIntegrationItem[];
  integrationId?: string;
  integrationName?: string;
  integrationIcon?: string | null;
};

export type RawIntegrationItem = {
  id: string;
  name: string;
  checked: boolean;
  order: number;
  notes: string | null;
  quantity: number;
  unit: string | null;
  food: string | null;
  integrationData?: Record<string, any>;
};

export type { Priority };
