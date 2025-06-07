import type { ShoppingListWithItemsAndCount, CreateShoppingListInput, CreateShoppingListItemInput, ShoppingListItem, UpdateShoppingListItemInput } from '~/types/database'

export const useShoppingLists = () => {
  const shoppingLists = ref<ShoppingListWithItemsAndCount[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchShoppingLists = async () => {
    loading.value = true
    error.value = null
    try {
      const data = await $fetch<ShoppingListWithItemsAndCount[]>('/api/shopping-lists')
      shoppingLists.value = data || []
    } catch (err) {
      error.value = 'Failed to fetch shopping lists'
      console.error('Error fetching shopping lists:', err)
    } finally {
      loading.value = false
    }
  }

  const createShoppingList = async (listData: CreateShoppingListInput) => {
    try {
      const newList = await $fetch<ShoppingListWithItemsAndCount>('/api/shopping-lists', {
        method: 'POST',
        body: listData
      })
      shoppingLists.value.unshift(newList)
      return newList
    } catch (err) {
      error.value = 'Failed to create shopping list'
      console.error('Error creating shopping list:', err)
      throw err
    }
  }

  const updateShoppingList = async (listId: string, updates: { name?: string }) => {
    try {
      const updatedList = await $fetch<ShoppingListWithItemsAndCount>(`/api/shopping-lists/${listId}`, {
        method: 'PUT',
        body: updates
      })
      
      // Update the list in the local state
      const listIndex = shoppingLists.value.findIndex(list => list.id === listId)
      if (listIndex !== -1) {
        shoppingLists.value[listIndex] = { ...shoppingLists.value[listIndex], ...updatedList }
      }
      
      return updatedList
    } catch (err) {
      error.value = 'Failed to update shopping list'
      console.error('Error updating shopping list:', err)
      throw err
    }
  }

  const updateShoppingListItem = async (itemId: string, updates: UpdateShoppingListItemInput) => {
    try {
      const updatedItem = await $fetch<ShoppingListItem>(`/api/shopping-list-items/${itemId}`, {
        method: 'PUT',
        body: updates
      })
      
      // Update the item in the local state
      shoppingLists.value.forEach(list => {
        const itemIndex = list.items.findIndex(item => item.id === itemId)
        if (itemIndex !== -1) {
          list.items[itemIndex] = updatedItem
        }
      })
      
      return updatedItem
    } catch (err) {
      error.value = 'Failed to update shopping list item'
      console.error('Error updating shopping list item:', err)
      throw err
    }
  }

  const addItemToList = async (listId: string, itemData: CreateShoppingListItemInput) => {
    try {
      const newItem = await $fetch<ShoppingListItem>(`/api/shopping-lists/${listId}/items`, {
        method: 'POST',
        body: itemData
      })
      
      // Add the item to the local state
      const list = shoppingLists.value.find(l => l.id === listId)
      if (list) {
        list.items.push(newItem)
      }
      
      return newItem
    } catch (err) {
      error.value = 'Failed to add item to shopping list'
      console.error('Error adding item to shopping list:', err)
      throw err
    }
  }

  const deleteShoppingList = async (listId: string) => {
    try {
      await $fetch(`/api/shopping-lists/${listId}`, { method: 'DELETE' })
      shoppingLists.value = shoppingLists.value.filter(l => l.id !== listId)
    } catch (err) {
      error.value = 'Failed to delete shopping list'
      console.error('Error deleting shopping list:', err)
      throw err
    }
  }

  const toggleItem = async (itemId: string, checked: boolean) => {
    return updateShoppingListItem(itemId, { checked })
  }

  const reorderShoppingList = async (listId: string, direction: 'up' | 'down') => {
    // Store original state for potential rollback
    const originalShoppingLists = [...shoppingLists.value]
    
    try {
      const sortedLists = [...shoppingLists.value].sort((a, b) => ((a as any).order || 0) - ((b as any).order || 0))
      const currentIndex = sortedLists.findIndex(list => list.id === listId)
      
      if (currentIndex === -1) return
      
      let targetIndex
      if (direction === 'up' && currentIndex > 0) {
        targetIndex = currentIndex - 1
      } else if (direction === 'down' && currentIndex < sortedLists.length - 1) {
        targetIndex = currentIndex + 1
      } else {
        return // No change needed
      }
      
      // Get the lists to swap
      const currentList = sortedLists[currentIndex]
      const targetList = sortedLists[targetIndex]
      
      if (!currentList || !targetList) return
      
      // Optimistically update the order values
      const currentOrder = (currentList as any).order || 0
      const targetOrder = (targetList as any).order || 0
      
      // Update the lists
      shoppingLists.value = shoppingLists.value.map(list => {
        if (list.id === currentList.id) {
          return { ...list, order: targetOrder } as any
        }
        if (list.id === targetList.id) {
          return { ...list, order: currentOrder } as any
        }
        return list
      })
      
      // Make API call with the new order
      const newOrder = shoppingLists.value
        .sort((a, b) => ((a as any).order || 0) - ((b as any).order || 0))
        .map(list => list.id)
      
      await $fetch('/api/shopping-lists/reorder', {
        method: 'PUT',
        body: { listIds: newOrder }
      })
      
    } catch (err) {
      // Revert on error
      shoppingLists.value = originalShoppingLists
      error.value = 'Failed to reorder shopping list'
      console.error('Error reordering shopping list:', err)
      throw err
    }
  }

  const reorderItem = async (itemId: string, direction: 'up' | 'down') => {
    // Store original state for potential rollback
    const originalShoppingLists = [...shoppingLists.value]
    
    try {
      // Find the item and its list
      const listIndex = shoppingLists.value.findIndex(list => 
        list.items?.some(item => item.id === itemId)
      )
      
      if (listIndex === -1) return
      
      const list = shoppingLists.value[listIndex]
      if (!list?.items) return
      
      const sortedItems = [...list.items].sort((a, b) => ((a as any).order || 0) - ((b as any).order || 0))
      const currentIndex = sortedItems.findIndex(item => item.id === itemId)
      
      if (currentIndex === -1) return
      
      let targetIndex
      if (direction === 'up' && currentIndex > 0) {
        targetIndex = currentIndex - 1
      } else if (direction === 'down' && currentIndex < sortedItems.length - 1) {
        targetIndex = currentIndex + 1
      } else {
        return // No change needed
      }
      
      // Get the items to swap
      const currentItem = sortedItems[currentIndex]
      const targetItem = sortedItems[targetIndex]
      
      if (!currentItem || !targetItem) return
      
      // Optimistically update the order values
      const currentOrder = (currentItem as any).order || 0
      const targetOrder = (targetItem as any).order || 0
      
      // Update the items in the list
      const updatedItems = list.items.map(item => {
        if (item.id === currentItem.id) {
          return { ...item, order: targetOrder } as any
        }
        if (item.id === targetItem.id) {
          return { ...item, order: currentOrder } as any
        }
        return item
      })
      
      // Update the list with new items
      const updatedList = {
        ...list,
        items: updatedItems
      }
      
      // Update the shopping lists array
      shoppingLists.value = [
        ...shoppingLists.value.slice(0, listIndex),
        updatedList,
        ...shoppingLists.value.slice(listIndex + 1)
      ]
      
      // Make API call
      await $fetch('/api/shopping-list-items/reorder', {
        method: 'POST',
        body: { itemId, direction }
      })
      
    } catch (err) {
      // Revert on error
      shoppingLists.value = originalShoppingLists
      error.value = 'Failed to reorder item'
      console.error('Error reordering item:', err)
      throw err
    }
  }

  return {
    shoppingLists: readonly(shoppingLists),
    loading: readonly(loading),
    error: readonly(error),
    fetchShoppingLists,
    createShoppingList,
    updateShoppingList,
    updateShoppingListItem,
    addItemToList,
    deleteShoppingList,
    toggleItem,
    reorderShoppingList,
    reorderItem
  }
} 