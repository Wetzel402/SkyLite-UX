import { MealieService } from '~/lib/mealie'
import type { MealieShoppingList, MealieShoppingListItem, MealieBulkUpdateResponse } from '~/lib/mealie'
import { useIntegrations } from '~/composables/useIntegrations'
import type { Integration } from '~/types/database'

interface MealieBulkResponse {
  createdItems: MealieShoppingListItem[]
  updatedItems: MealieShoppingListItem[]
  deletedItems: MealieShoppingListItem[]
}

export const useMealieShoppingLists = () => {
  const mealieLists = ref<MealieShoppingList[]>([])
  const selectedList = ref<MealieShoppingList | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const selectedIntegrationId = ref<string | null>(null)

  const { integrations, getIntegrationsByType, fetchIntegrations } = useIntegrations()
  
  // Fetch integrations first
  const initialize = async () => {
    await fetchIntegrations()
  }
  
  function getMealieService() {
    const integration = integrations.value.find((i: Integration) => i.id === selectedIntegrationId.value)
    if (!integration) {
      throw new Error('No Mealie integration selected')
    }
    return new MealieService(integration.id)
  }

  const fetchMealieLists = async (integrationId?: string) => {
    console.log('DEBUG: fetchMealieLists', integrationId)
    loading.value = true
    error.value = null
    try {
      if (integrationId) {
        selectedIntegrationId.value = integrationId
      }
      const service = getMealieService()
      console.log('DEBUG: service', service)
      const response = await service.getShoppingLists()
      // Store the first list's items since we're displaying them directly
      if (response.items && response.items.length > 0) {
        mealieLists.value = response.items
        // Select the first list by default
        selectedList.value = response.items[0]
      } else {
        mealieLists.value = []
        selectedList.value = null
      }
    } catch (err) {
      error.value = 'Failed to fetch Mealie lists'
      console.error('Error fetching Mealie lists:', err)
    } finally {
      loading.value = false
    }
  }

  const fetchMealieList = async (listId: string, integrationId?: string) => {
    loading.value = true
    error.value = null
    try {
      if (integrationId) {
        selectedIntegrationId.value = integrationId
      }
      const service = getMealieService()
      const response = await service.getShoppingList(listId)
      selectedList.value = response
      
      // Update the list in mealieLists array
      const index = mealieLists.value.findIndex(list => list.id === listId)
      if (index !== -1) {
        mealieLists.value[index] = response
      }
      
      return response
    } catch (err) {
      error.value = 'Failed to fetch Mealie list'
      console.error('Error fetching Mealie list:', err)
    } finally {
      loading.value = false
    }
  }

  const createMealieList = async (data: { name: string }, integrationId?: string) => {
    if (integrationId) {
      selectedIntegrationId.value = integrationId
    }
    const service = getMealieService()

    try {
      const response = await service.createShoppingList(data)
      mealieLists.value.push(response)
      return response
    } catch (err) {
      error.value = 'Failed to create Mealie list'
      console.error('Error creating Mealie list:', err)
      throw err
    }
  }

  const updateMealieList = async (id: string, data: { name: string }, integrationId?: string) => {
    if (integrationId) {
      selectedIntegrationId.value = integrationId
    }
    const service = getMealieService()

    try {
      const response = await service.updateShoppingList(id, data)
      const index = mealieLists.value.findIndex(list => list.id === id)
      if (index !== -1) {
        mealieLists.value[index] = response
      }
      if (selectedList.value?.id === id) {
        selectedList.value = response
      }
      return response
    } catch (err) {
      error.value = 'Failed to update Mealie list'
      console.error('Error updating Mealie list:', err)
      throw err
    }
  }

  const deleteMealieList = async (id: string, integrationId?: string) => {
    if (integrationId) {
      selectedIntegrationId.value = integrationId
    }
    const service = getMealieService()

    try {
      await service.deleteShoppingList(id)
      mealieLists.value = mealieLists.value.filter(list => list.id !== id)
      if (selectedList.value?.id === id) {
        selectedList.value = null
      }
    } catch (err) {
      error.value = 'Failed to delete Mealie list'
      console.error('Error deleting Mealie list:', err)
      throw err
    }
  }

  const createMealieItems = async (items: Partial<MealieShoppingListItem>[], integrationId?: string) => {
    if (integrationId) {
      selectedIntegrationId.value = integrationId
    }
    const service = getMealieService()

    try {
      const response = await service.createShoppingListItems(items) as unknown as MealieBulkResponse
      
      // Update the list in mealieLists
      const listIndex = mealieLists.value.findIndex(list => list.id === selectedList.value?.id)
      if (listIndex !== -1 && mealieLists.value[listIndex]?.listItems) {
        mealieLists.value[listIndex].listItems = [...mealieLists.value[listIndex].listItems, ...response.createdItems]
        // Update selectedList to reference the updated list
        selectedList.value = mealieLists.value[listIndex]
      }
      
      return response.createdItems
    } catch (error) {
      console.error('Error creating Mealie items:', error)
      throw error
    }
  }

  const deleteMealieItems = async (ids: string[], integrationId?: string) => {
    if (integrationId) {
      selectedIntegrationId.value = integrationId
    }
    const service = getMealieService()

    try {
      await service.deleteShoppingListItems(ids)
      if (selectedList.value) {
        selectedList.value.listItems = selectedList.value.listItems.filter(item => !ids.includes(item.id))
      }
    } catch (err) {
      error.value = 'Failed to delete Mealie items'
      console.error('Error deleting Mealie items:', err)
      throw err
    }
  }

  const updateMealieItem = async (items: MealieShoppingListItem[], integrationId?: string) => {
    if (integrationId) {
      selectedIntegrationId.value = integrationId
    }
    const service = getMealieService()

    try {
      const response = await service.updateShoppingListItem(items)
      const listItems = selectedList.value?.listItems
      if (listItems && response.updatedItems) {
        // Update items from the updatedItems array in the response
        response.updatedItems.forEach(updatedItem => {
          const index = listItems.findIndex(item => item.id === updatedItem.id)
          if (index !== -1) {
            listItems[index] = updatedItem
          }
        })
      }
      return response.updatedItems
    } catch (err) {
      error.value = 'Failed to update Mealie item'
      console.error('Error updating Mealie item:', err)
      throw err
    }
  }

  const isMealieAvailable = computed(() => {
    const mealieIntegrations = getIntegrationsByType('shopping').filter(i => i.service === 'mealie')
    return mealieIntegrations.length > 0 && mealieIntegrations.some(i => i.enabled && i.apiKey && i.baseUrl)
  })

  return {
    mealieLists,
    selectedList,
    loading,
    error,
    selectedIntegrationId,
    initialize,
    fetchMealieLists,
    fetchMealieList,
    createMealieList,
    updateMealieList,
    deleteMealieList,
    createMealieItems,
    deleteMealieItems,
    updateMealieItem,
    isMealieAvailable
  }
} 