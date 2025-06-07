export interface MealieShoppingList {
  id: string
  name: string
  extras: Record<string, any>
  createdAt: string
  updatedAt: string
  groupId: string
  userId: string
  householdId: string
  listItems: MealieShoppingListItem[]
  labelSettings: MealieLabelSetting[]
  recipeReferences: any[]
}

export interface MealieShoppingListItem {
  id: string
  quantity: number
  unit: MealieUnit | null
  food: MealieFood | null
  note: string
  isFood: boolean
  disableAmount: boolean
  display: string
  shoppingListId: string
  checked: boolean
  position: number
  foodId: string | null
  labelId: string | null
  unitId: string | null
  extras: Record<string, any>
  groupId: string
  householdId: string
  label: MealieLabel | null
  recipeReferences: any[]
  createdAt: string
  updatedAt: string
}

export interface MealieUnit {
  id: string
  name: string
  pluralName: string
  description: string
  extras: Record<string, any>
  fraction: boolean
  abbreviation: string
  pluralAbbreviation: string | null
  useAbbreviation: boolean
  aliases: string[]
  createdAt: string
  updatedAt: string
}

export interface MealieFood {
  id: string
  name: string
  pluralName: string | null
  description: string
  extras: Record<string, any>
  labelId: string | null
  aliases: string[]
  householdsWithIngredientFood: any[]
  label: MealieLabel | null
  createdAt: string
  updatedAt: string
}

export interface MealieLabel {
  name: string
  color: string
  groupId: string
  id: string
}

export interface MealieLabelSetting {
  shoppingListId: string
  labelId: string
  position: number
  id: string
  label: MealieLabel
}

export interface PaginatedResponse<T> {
  page: number
  per_page: number
  total: number
  total_pages: number
  items: T[]
  next: string | null
  previous: string | null
}

export interface MealieBulkUpdateResponse {
  createdItems: MealieShoppingListItem[]
  updatedItems: MealieShoppingListItem[]
  deletedItems: MealieShoppingListItem[]
}

export class MealieService {
  private integrationId: string

  constructor(integrationId: string) {
    this.integrationId = integrationId
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `/api/mealie/${path}${path.includes('?') ? '&' : '?'}integrationId=${this.integrationId}`
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    }

    const response = await fetch(url, {
      ...options,
      headers
    })

    if (!response.ok) {
      throw new Error(`Mealie API error: ${response.statusText}`)
    }

    return response.json()
  }

  async getShoppingLists(): Promise<PaginatedResponse<MealieShoppingList>> {
    return await this.request<PaginatedResponse<MealieShoppingList>>('api/households/shopping/lists')
  }

  async getShoppingList(id: string): Promise<MealieShoppingList> {
    return await this.request<MealieShoppingList>(`api/households/shopping/lists/${id}`)
  }

  async createShoppingList(data: { name: string }): Promise<MealieShoppingList> {
    return await this.request<MealieShoppingList>('api/households/shopping/lists', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async updateShoppingList(id: string, data: { name: string }): Promise<MealieShoppingList> {
    return await this.request<MealieShoppingList>(`api/households/shopping/lists/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  async deleteShoppingList(id: string): Promise<void> {
    await this.request(`api/households/shopping/lists/${id}`, {
      method: 'DELETE'
    })
  }

  async createShoppingListItems(items: Partial<MealieShoppingListItem>[]): Promise<MealieShoppingListItem[]> {
    return await this.request<MealieShoppingListItem[]>('api/households/shopping/items/create-bulk', {
      method: 'POST',
      body: JSON.stringify(items)
    })
  }

  async deleteShoppingListItems(ids: string[]): Promise<{ message: string; error: boolean }> {
    const queryParams = new URLSearchParams()
    ids.forEach(id => queryParams.append('ids', id))
    return await this.request<{ message: string; error: boolean }>(`api/households/shopping/items?${queryParams.toString()}`, {
      method: 'DELETE'
    })
  }

  async getFoods(): Promise<MealieFood[]> {
    return await this.request<MealieFood[]>('api/foods')
  }

  async createFood(data: { name: string, pluralName?: string }): Promise<MealieFood> {
    return await this.request<MealieFood>('api/foods', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async getUnits(): Promise<MealieUnit[]> {
    return await this.request<MealieUnit[]>('api/units')
  }

  async createUnit(data: { name: string, pluralName?: string }): Promise<MealieUnit> {
    return await this.request<MealieUnit>('api/units', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async updateShoppingListItem(items: MealieShoppingListItem[]): Promise<MealieBulkUpdateResponse> {
    return await this.request<MealieBulkUpdateResponse>('api/households/shopping/items', {
      method: 'PUT',
      body: JSON.stringify(items)
    })
  }
} 