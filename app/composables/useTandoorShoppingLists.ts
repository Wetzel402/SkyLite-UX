import { TandoorService, type TandoorShoppingListEntry } from '~/lib/tandoor'

export const useTandoorShoppingLists = () => {
  const tandoorEntries = ref<TandoorShoppingListEntry[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const selectedIntegrationId = ref<string | null>(null)

  const { getIntegrationsByType, fetchIntegrations } = useIntegrations()
  
  // Fetch integrations first
  const initialize = async () => {
    await fetchIntegrations()
  }
  
  const getTandoorService = (integrationId?: string): TandoorService | null => {
    const tandoorIntegrations = getIntegrationsByType('shopping').filter(i => i.service === 'tandoor')
    if (tandoorIntegrations.length === 0) return null

    // If no specific integration is selected, use the first one
    const integration = integrationId 
      ? tandoorIntegrations.find(i => i.id === integrationId)
      : tandoorIntegrations[0]

    if (!integration || !integration.apiKey || !integration.baseUrl) {
      return null
    }

    // Store the selected integration ID
    selectedIntegrationId.value = integration.id
    return new TandoorService(integration.apiKey, integration.baseUrl, integration.id)
  }

  const fetchTandoorEntries = async (integrationId?: string) => {
    loading.value = true
    error.value = null
    try {
      const service = getTandoorService(integrationId)
      if (!service) {
        error.value = 'Tandoor integration not configured'
        return
      }
      const response = await service.getShoppingListEntries()
      // Filter out completed items
      tandoorEntries.value = response.filter(entry => !entry.checked)
    } catch (err) {
      error.value = 'Failed to fetch Tandoor entries'
      console.error('Error fetching Tandoor entries:', err)
    } finally {
      loading.value = false
    }
  }

  const createTandoorEntry = async (data: {
    food: { name: string }
    unit?: { name: string }
    amount: string
    list_recipe?: number
  }, integrationId?: string) => {
    const service = getTandoorService(integrationId)
    if (!service) {
      throw new Error('Tandoor integration not configured')
    }

    try {
      console.log('DEBUG: Creating Tandoor entry:', data)
      
      // Create a temporary entry with a temporary ID
      const tempEntry: TandoorShoppingListEntry = {
        id: -Date.now(), // Temporary negative ID
        food: {
          id: -1,
          name: data.food.name,
          plural_name: data.food.name
        },
        unit: data.unit ? {
          id: -1,
          name: data.unit.name,
          plural_name: data.unit.name
        } : null,
        amount: parseFloat(data.amount),
        order: 0,
        checked: false,
        list_recipe: data.list_recipe || null
      }
      
      // Add to local state immediately
      tandoorEntries.value.unshift(tempEntry)
      
      // Make the API request
      const newEntry = await service.createShoppingListEntry(data)
      
      // Update the temporary entry with the real data
      const index = tandoorEntries.value.findIndex(entry => entry.id === tempEntry.id)
      if (index !== -1) {
        tandoorEntries.value[index] = newEntry
      }
      
      return newEntry
    } catch (err) {
      // Remove the temporary entry if the API call fails
      tandoorEntries.value = tandoorEntries.value.filter(entry => entry.id !== -Date.now())
      error.value = 'Failed to create Tandoor shopping list entry'
      console.error('Error creating Tandoor entry:', err)
      throw err
    }
  }

  const updateTandoorEntry = async (id: number, data: {
    amount?: string
    checked?: boolean
    order?: number
  }, integrationId?: string) => {
    const service = getTandoorService(integrationId)
    if (!service) {
      throw new Error('Tandoor integration not configured')
    }

    try {
      const updatedEntry = await service.updateShoppingListEntry(id, data)
      
      // If the item is marked as checked, remove it from the list
      if (data.checked) {
        tandoorEntries.value = tandoorEntries.value.filter(entry => entry.id !== id)
      } else {
        // Otherwise update the entry in the local state
        const entryIndex = tandoorEntries.value.findIndex((entry: TandoorShoppingListEntry) => entry.id === id)
        if (entryIndex !== -1) {
          tandoorEntries.value[entryIndex] = updatedEntry
        }
      }
      
      return updatedEntry
    } catch (err) {
      error.value = 'Failed to update Tandoor shopping list entry'
      console.error('Error updating Tandoor entry:', err)
      throw err
    }
  }

  const deleteTandoorEntry = async (id: number, integrationId?: string) => {
    const service = getTandoorService(integrationId)
    if (!service) {
      throw new Error('Tandoor integration not configured')
    }

    try {
      await service.deleteShoppingListEntry(id)
      tandoorEntries.value = tandoorEntries.value.filter((entry: TandoorShoppingListEntry) => entry.id !== id)
    } catch (err) {
      error.value = 'Failed to delete Tandoor shopping list entry'
      console.error('Error deleting Tandoor entry:', err)
      throw err
    }
  }

  const isTandoorAvailable = computed(() => {
    const tandoorIntegrations = getIntegrationsByType('shopping').filter(i => i.service === 'tandoor')
    return tandoorIntegrations.length > 0 && tandoorIntegrations.some(i => i.enabled && i.apiKey && i.baseUrl)
  })

  // Group entries by status for display
  const groupedEntries = computed(() => {
    // Only show unchecked items
    const unchecked = tandoorEntries.value.filter((entry: TandoorShoppingListEntry) => !entry.checked)
    return { checked: [], unchecked }
  })

  return {
    tandoorEntries,
    loading,
    error,
    selectedIntegrationId,
    initialize,
    fetchTandoorEntries,
    createTandoorEntry,
    updateTandoorEntry,
    deleteTandoorEntry,
    isTandoorAvailable,
    groupedEntries
  }
} 