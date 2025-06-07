export interface TandoorShoppingList {
  id: number
  title: string
  created_by: number
  created_at: string
  note: string
  entries: TandoorShoppingListEntry[]
}

export interface TandoorShoppingListEntry {
  id: number
  list_recipe: number | null
  food: {
    id: number
    name: string
    plural_name: string
  }
  unit: {
    id: number
    name: string
    plural_name: string
  } | null
  amount: number
  order: number
  checked: boolean
}

export class TandoorService {
  private apiKey: string
  private baseUrl: string
  private integrationId: string

  constructor(apiKey: string, baseUrl: string, integrationId: string) {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
    this.integrationId = integrationId
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    // Ensure endpoint starts with a slash and ends with a slash
    const formattedEndpoint = path.startsWith('/') ? path : `/${path}`
    const url = `/api/tandoor${formattedEndpoint}?integrationId=${this.integrationId}`
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    }

    const response = await fetch(url, {
      ...options,
      headers
    })

    if (!response.ok) {
      throw new Error(`Tandoor API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  async getShoppingListEntries(): Promise<TandoorShoppingListEntry[]> {
    const response = await this.request<TandoorShoppingListEntry[]>('/shopping-list-entry/')
    // The response is already an array of entries
    return response
  }

  async getShoppingListEntry(id: number): Promise<TandoorShoppingListEntry> {
    return await this.request<TandoorShoppingListEntry>(`/shopping-list-entry/${id}/`)
  }

  async createShoppingListEntry(data: {
    food: { name: string }
    unit?: { name: string }
    amount: string
    list_recipe?: number
  }): Promise<TandoorShoppingListEntry> {
    console.log('DEBUG: Creating shopping list entry with data:', data)
    console.log('DEBUG: Tandoor API request:', JSON.stringify(data))
    const response = await this.request<TandoorShoppingListEntry>('/shopping-list-entry/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
    // The response is already a single entry, no need to access any properties
    return response
  }

  async updateShoppingListEntry(id: number, data: {
    amount?: string
    checked?: boolean
    order?: number
  }): Promise<TandoorShoppingListEntry> {
    return await this.request<TandoorShoppingListEntry>(`/shopping-list-entry/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    })
  }

  async deleteShoppingListEntry(id: number): Promise<void> {
    await this.request(`/shopping-list-entry/${id}/`, {
      method: 'DELETE'
    })
  }

  async searchFoods(query: string): Promise<Array<{ id: number; name: string }>> {
    const response = await this.request<{ results: Array<{ id: number; name: string }> }>(`/food/?search=${encodeURIComponent(query)}`)
    return response.results
  }

  async getUnits(): Promise<Array<{ id: number; name: string; plural_name: string }>> {
    const response = await this.request<{ results: Array<{ id: number; name: string; plural_name: string }> }>('/unit/')
    return response.results
  }
} 