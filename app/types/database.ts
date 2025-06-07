import type { Prisma, Priority } from '@prisma/client'
import type { JsonObject } from 'type-fest'

// User types
export type User = Prisma.UserGetPayload<{}>
export type UserWithTodos = Prisma.UserGetPayload<{
  include: { todos: true }
}>

// Todo types
export type Todo = Prisma.TodoGetPayload<{}>
export type TodoWithUser = Prisma.TodoGetPayload<{
  include: { user: { select: { id: true, name: true, avatar: true } } }
}>

// Shopping List types
export interface ShoppingList {
  id: string
  name: string
  order: number
  createdAt: Date
  updatedAt: Date
  items: ShoppingListItem[]
}

export interface ShoppingListItem {
  id: string
  name: string
  quantity: number
  unit: string | null
  checked: boolean
  notes: string | null
  order: number
  shoppingListId: string
}

export type ShoppingListWithItems = Prisma.ShoppingListGetPayload<{
  include: { items: true }
}>
export type ShoppingListWithItemsAndCount = Prisma.ShoppingListGetPayload<{
  include: { 
    items: true,
    _count: { select: { items: true } }
  }
}>

// Integration types
export interface Integration {
  id: string
  name: string
  type: string
  service: string
  apiKey: string | null
  baseUrl: string | null
  enabled: boolean
  settings: JsonObject | null
  createdAt: Date
  updatedAt: Date
}

export type CreateIntegrationInput = Omit<Integration, 'id' | 'createdAt' | 'updatedAt'>
export type UpdateIntegrationInput = Partial<CreateIntegrationInput>

// Create types for forms
export type CreateUserInput = Omit<User, 'id' | 'createdAt' | 'updatedAt'>
export type CreateTodoInput = Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>
export type CreateShoppingListInput = Omit<ShoppingList, 'id' | 'createdAt' | 'updatedAt' | 'items'>
export type CreateShoppingListItemInput = Omit<ShoppingListItem, 'id' | 'shoppingListId'>

// Update types
export type UpdateTodoInput = Partial<Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>>
export type UpdateShoppingListItemInput = Partial<CreateShoppingListItemInput>

// Re-export Priority enum
export type { Priority } 