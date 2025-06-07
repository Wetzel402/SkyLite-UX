<script setup lang="ts">
import type { CreateShoppingListInput, CreateShoppingListItemInput } from '~/types/database'
import ShoppingListDialog from '~/components/shopping/ShoppingListDialog.vue'
import ShoppingListItemDialog from '~/components/shopping/ShoppingListItemDialog.vue'
import TandoorEntryDialog from '~/components/shopping/TandoorEntryDialog.vue'
import MealieEntryDialog from '~/components/shopping/MealieEntryDialog.vue'
import MealieListDialog from '~/components/shopping/MealieListDialog.vue'

const { 
  shoppingLists, 
  loading, 
  createShoppingList, 
  updateShoppingList,
  deleteShoppingList, 
  addItemToList, 
  updateShoppingListItem,
  fetchShoppingLists,
  reorderItem,
  reorderShoppingList
} = useShoppingLists()

const { fetchIntegrations, getEnabledIntegrations, getIntegrationByType, getIntegrationsByType, initialized: integrationsInitialized } = useIntegrations()
const { 
  tandoorEntries,
  groupedEntries,
  loading: tandoorLoading, 
  initialize: initializeTandoor,
  fetchTandoorEntries, 
  createTandoorEntry,
  updateTandoorEntry,
  deleteTandoorEntry,
  isTandoorAvailable 
} = useTandoorShoppingLists()

const {
  mealieLists,
  selectedList,
  loading: mealieLoading,
  initialize: initializeMealie,
  fetchMealieLists,
  fetchMealieList,
  createMealieList,
  updateMealieList,
  deleteMealieList,
  createMealieItems,
  deleteMealieItems,
  updateMealieItem,
  isMealieAvailable
} = useMealieShoppingLists()

// Modal state
const listDialog = ref(false)
const itemDialog = ref(false)
const tandoorEntryDialog = ref(false)
const mealieEntryDialog = ref(false)
const mealieListDialog = ref(false)
const selectedListId = ref<string>('')
const editingList = ref<any>(null)
const editingItem = ref<any>(null)
const editingTandoorEntry = ref<any>(null)
const editingMealieEntry = ref<any>(null)
const editingMealieList = ref<any>(null)

// Inline editing state
const editingListNames = ref(new Set<string>())
const editingItemData = ref(new Set<string>())

// Tab state
const activeTab = ref<'native' | string>('native')
const selectedIntegrationId = ref<string | null>(null)

// Check if we have any enabled integrations to show tabs
const hasEnabledIntegrations = computed(() => {
  return getEnabledIntegrations.value.length > 0
})

// Get enabled integrations by type
const enabledIntegrationsByType = computed(() => {
  return getIntegrationsByType('shopping')
})

// Get the current integration
const currentIntegration = computed(() => {
  if (!selectedIntegrationId.value) return null
  return enabledIntegrationsByType.value.find(i => i.id === selectedIntegrationId.value)
})

// Watch for integration changes
watch([activeTab, selectedIntegrationId], async ([newTab, newIntegrationId]) => {
  if (newTab === 'native') {
    // Clear any integration-specific state
    tandoorEntries.value = []
    mealieLists.value = []
    selectedList.value = null
  } else if (newIntegrationId) {
    const integration = enabledIntegrationsByType.value.find(i => i.id === newIntegrationId)
    console.log('DEBUG: Integration:', integration)
    if (integration?.service === 'tandoor') {
      await fetchTandoorEntries(newIntegrationId)
    } else if (integration?.service === 'mealie') {
      // First fetch all lists
      await fetchMealieLists(newIntegrationId)
      // Then fetch items for each list and update the list data
      for (const list of mealieLists.value) {
        if (!list?.id) continue
        try {
          const listWithItems = await fetchMealieList(list.id, newIntegrationId)
          // Update the list in mealieLists with the items
          const index = mealieLists.value.findIndex(l => l?.id === list.id)
          if (index !== -1 && listWithItems) {
            mealieLists.value[index] = listWithItems
          }
        } catch (error) {
          console.error(`Failed to fetch items for list ${list.id}:`, error)
        }
      }
    }
  }
})

// Load shopping lists and integrations on mount
onMounted(async () => {
  try {
    // Fetch integrations first
    await fetchIntegrations()
    
    // Initialize integrations if available
    await initializeTandoor()
    await initializeMealie()
    
    // Then fetch shopping lists
    await fetchShoppingLists()
    
    // Finally fetch integration entries if available and selected
    if (isTandoorAvailable.value && currentIntegration.value?.service === 'tandoor') {
      await fetchTandoorEntries(selectedIntegrationId.value)
    } else if (isMealieAvailable.value && currentIntegration.value?.service === 'mealie') {
      // First fetch all lists
      await fetchMealieLists(selectedIntegrationId.value)
      // Then fetch items for each list and update the list data
      for (const list of mealieLists.value) {
        if (!list?.id) continue
        try {
          const listWithItems = await fetchMealieList(list.id, selectedIntegrationId.value)
          // Update the list in mealieLists with the items
          const index = mealieLists.value.findIndex(l => l?.id === list.id)
          if (index !== -1 && listWithItems) {
            mealieLists.value[index] = listWithItems
          }
        } catch (error) {
          console.error(`Failed to fetch items for list ${list.id}:`, error)
        }
      }
    }
  } catch (error) {
    console.error('Failed to initialize shopping lists:', error)
  }
})

const getProgressPercentage = (list: any) => {
  if (!list.items || list.items.length === 0) return 0
  const checkedItems = list.items.filter((item: any) => item.checked).length
  return Math.round((checkedItems / list.items.length) * 100)
}

const getProgressColor = (percentage: number) => {
  if (percentage === 100) return 'bg-green-500'
  if (percentage >= 75) return 'bg-blue-500'
  if (percentage >= 50) return 'bg-yellow-500'
  if (percentage >= 25) return 'bg-orange-500'
  return 'bg-red-500'
}

const openCreateList = () => {
  editingList.value = null
  listDialog.value = true
}

const openAddItem = (listId: string) => {
  selectedListId.value = listId
  editingItem.value = null
  itemDialog.value = true
}

const openEditItem = (item: any) => {
  editingItem.value = { ...item }
  itemDialog.value = true
}

const handleListSave = async (listData: CreateShoppingListInput) => {
  try {
    if (editingList.value?.id) {
      await updateShoppingList(editingList.value.id, listData)
    } else {
      await createShoppingList(listData)
    }
    listDialog.value = false
    editingList.value = null
  } catch (error) {
    console.error('Failed to save shopping list:', error)
  }
}

const handleItemSave = async (itemData: CreateShoppingListItemInput) => {
  try {
    if (editingItem.value?.id) {
      await updateShoppingListItem(editingItem.value.id, itemData)
    } else if (selectedListId.value) {
      await addItemToList(selectedListId.value, itemData)
    }
    itemDialog.value = false
    selectedListId.value = ''
    editingItem.value = null
  } catch (error) {
    console.error('Failed to save item:', error)
  }
}

const handleToggleItem = async (itemId: string, checked: boolean) => {
  try {
    await updateShoppingListItem(itemId, { checked })
  } catch (error) {
    console.error('Failed to toggle item:', error)
  }
}

const handleDeleteList = async (listId: string) => {
  if (confirm('Are you sure you want to delete this shopping list?')) {
    try {
      await deleteShoppingList(listId)
    } catch (error) {
      console.error('Failed to delete list:', error)
    }
  }
}

const reorderingItems = ref(new Set<string>())

const handleReorderItem = async (itemId: string, direction: 'up' | 'down') => {
  // Prevent multiple simultaneous reorders of the same item
  if (reorderingItems.value.has(itemId)) return
  
  reorderingItems.value.add(itemId)
  
  try {
    await reorderItem(itemId, direction)
  } catch (error) {
    console.error('Failed to reorder item:', error)
    // Show error to user
    alert('Failed to reorder item. Please try again.')
  } finally {
    reorderingItems.value.delete(itemId)
  }
}

// Computed property to ensure proper reactivity for sorted shopping lists
const sortedShoppingLists = computed(() => {
  return shoppingLists.value
    .sort((a, b) => ((a as any).order || 0) - ((b as any).order || 0))
    .map(list => ({
      ...list,
      sortedItems: list.items ? [...list.items].sort((a, b) => ((a as any).order || 0) - ((b as any).order || 0)) : []
    }))
})

const reorderingLists = ref(new Set<string>())

const handleReorderList = async (listId: string, direction: 'up' | 'down') => {
  // Prevent multiple simultaneous reorders of the same list
  if (reorderingLists.value.has(listId)) return
  
  reorderingLists.value.add(listId)
  
  try {
    await reorderShoppingList(listId, direction)
  } catch (error) {
    console.error('Failed to reorder shopping list:', error)
    // Show error to user
    alert('Failed to reorder shopping list. Please try again.')
  } finally {
    reorderingLists.value.delete(listId)
  }
}

const handleToggleTandoorItem = async (entry: any) => {
  try {
    // Update UI immediately
    const index = tandoorEntries.value.findIndex(e => e.id === entry.id)
    if (index !== -1) {
      tandoorEntries.value[index] = {
        ...tandoorEntries.value[index],
        checked: !entry.checked
      }
    }
    
    // Then update on the server
    await updateTandoorEntry(entry.id, { checked: !entry.checked }, selectedIntegrationId.value)
  } catch (error) {
    // Revert the UI change if the server update fails
    const index = tandoorEntries.value.findIndex(e => e.id === entry.id)
    if (index !== -1) {
      tandoorEntries.value[index] = {
        ...tandoorEntries.value[index],
        checked: entry.checked
      }
    }
    console.error('Failed to toggle Tandoor item:', error)
  }
}

const handleDeleteTandoorEntry = async (id: string) => {
  if (confirm('Are you sure you want to delete this item?')) {
    try {
      // Remove from UI immediately
      tandoorEntries.value = tandoorEntries.value.filter(entry => entry.id !== id)
      // Then delete from server
      await deleteTandoorEntry(id, selectedIntegrationId.value)
    } catch (error) {
      console.error('Failed to delete Tandoor entry:', error)
      // Refresh the list to ensure UI is in sync
      await fetchTandoorEntries(selectedIntegrationId.value)
    }
  }
}

const handleTandoorEntrySave = async (entryData: { food: { name: string }, amount: string, unit: string | null }) => {
  try {
    const data = {
      food: { name: entryData.food.name },
      amount: entryData.amount,
      unit: entryData.unit ? { name: entryData.unit } : undefined
    }

    if (editingTandoorEntry.value?.id) {
      await updateTandoorEntry(editingTandoorEntry.value.id, data, selectedIntegrationId.value)
    } else {
      await createTandoorEntry(data, selectedIntegrationId.value)
    }
    
    tandoorEntryDialog.value = false
    editingTandoorEntry.value = null
  } catch (error) {
    console.error('Failed to save Tandoor entry:', error)
    // Show error to user
    alert('Failed to save item. Please try again.')
  }
}

const getIntegrationIcon = (service: string) => {
  switch (service) {
    case 'tandoor':
      return 'i-lucide-chef-hat'
    case 'mealie':
      return 'i-lucide-utensils'
    default:
      return 'i-lucide-plug'
  }
}

const handleMealieListSave = async (listData: { name: string }) => {
  try {
    if (editingMealieList.value?.id) {
      await updateMealieList(editingMealieList.value.id, listData, selectedIntegrationId.value)
    } else {
      await createMealieList(listData, selectedIntegrationId.value)
    }
    
    mealieListDialog.value = false
    editingMealieList.value = null
  } catch (error) {
    console.error('Failed to save Mealie list:', error)
    alert('Failed to save list. Please try again.')
  }
}

const handleMealieEntrySave = async (entryData: { 
  food: MealieFood | null
  quantity: number
  unit: MealieUnit | null
  note: string
  isFood: boolean
  labelId: string | null
  label: MealieLabel | null
  foodId: string | null
  unitId: string | null
  disableAmount: boolean
  display: string
  shoppingListId: string
  checked: boolean
  position: number
  extras: Record<string, any>
  recipeReferences: any[]
}) => {
  try {
    if (!selectedList.value) {
      throw new Error('No list selected')
    }

    const data = {
      ...entryData,
      shoppingListId: selectedList.value.id,
      position: selectedList.value.listItems?.length || 0
    }

    if (editingMealieEntry.value?.id) {
      // TODO: Implement update
      // await updateMealieEntry(editingMealieEntry.value.id, data, selectedIntegrationId.value)
    } else {
      await createMealieItems([data], selectedIntegrationId.value)
    }
    
    mealieEntryDialog.value = false
    editingMealieEntry.value = null
  } catch (error) {
    console.error('Failed to save Mealie entry:', error)
    alert('Failed to save item. Please try again.')
  }
}

const handleDeleteMealieList = async (id: string) => {
  if (confirm('Are you sure you want to delete this list?')) {
    try {
      await deleteMealieList(id, selectedIntegrationId.value)
    } catch (error) {
      console.error('Failed to delete Mealie list:', error)
      alert('Failed to delete list. Please try again.')
    }
  }
}

const handleDeleteMealieItem = async (id: string) => {
  if (confirm('Are you sure you want to delete this item?')) {
    try {
      await deleteMealieItems([id], selectedIntegrationId.value)
    } catch (error) {
      console.error('Failed to delete Mealie item:', error)
      alert('Failed to delete item. Please try again.')
    }
  }
}

const handleMealieItemCheck = async (item: MealieShoppingListItem) => {
  try {
    // Create a copy of the item with the updated checked status
    const updatedItem = {
      ...item,
      checked: !item.checked
    }
    await updateMealieItem([updatedItem], selectedIntegrationId.value)
  } catch (error) {
    console.error('Failed to update item:', error)
    // Revert the checkbox state on error
    item.checked = !item.checked
  }
}
</script>

<template>
  <div class="flex h-[calc(100vh-2rem)] w-full flex-col rounded-lg">
    <!-- Header -->
    <div class="py-5 sm:px-4 sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div class="flex flex-col gap-1.5">
        <h1 class="font-semibold text-xl text-gray-900 dark:text-white">
          Shopping Lists
        </h1>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Organize your shopping and never forget an item
        </p>
      </div>
      
      <!-- Tabs (only show if integrations are enabled) -->
      <div v-if="hasEnabledIntegrations" class="mt-4">
        <div class="border-b border-gray-200 dark:border-gray-700">
          <nav class="-mb-px flex space-x-8">
            <button
              @click="activeTab = 'native'; selectedIntegrationId = null"
              :class="[
                activeTab === 'native'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300',
                'whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm'
              ]"
            >
              Native Lists
            </button>
            <template v-for="integration in enabledIntegrationsByType" :key="integration.id">
              <button
                @click="activeTab = integration.service; selectedIntegrationId = integration.id"
                :class="[
                  activeTab === integration.service && selectedIntegrationId === integration.id
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300',
                  'whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2'
                ]"
              >
                <UIcon 
                  :name="getIntegrationIcon(integration.service)" 
                  class="h-4 w-4" 
                />
                {{ integration.name }}
              </button>
            </template>
          </nav>
        </div>
      </div>
    </div>

    <!-- Shopping Lists Content -->
    <div class="flex-1 overflow-hidden">
      <!-- Native Lists -->
      <div v-if="activeTab === 'native'" class="flex-1 overflow-y-auto p-4">
        <div v-if="loading" class="flex items-center justify-center h-full">
          <div class="text-center">
            <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-primary-500" />
            <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading shopping lists...</p>
          </div>
        </div>
        <div v-else-if="shoppingLists.length === 0" class="flex items-center justify-center h-full">
          <div class="text-center">
            <UIcon name="i-lucide-shopping-cart" class="h-8 w-8 text-gray-400" />
            <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">No shopping lists found</p>
            <UButton
              class="mt-4"
              color="primary"
              @click="openCreateList"
            >
              Create List
            </UButton>
          </div>
        </div>
        <div v-else class="h-full">
          <div class="h-full overflow-x-auto pb-4">
            <div class="flex gap-6 min-w-max h-full">
              <div
                v-for="(list, listIndex) in sortedShoppingLists"
                :key="list.id"
                class="flex-shrink-0 w-80 h-full flex flex-col bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
              >
                <!-- List Header -->
                <div class="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-t-lg">
                  <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center gap-2 flex-1 min-w-0">
                      <h2 class="text-lg font-semibold text-gray-900 dark:text-white truncate">
                        {{ list.name }}
                      </h2>
                      <UButton
                        icon="i-lucide-pencil"
                        size="xs"
                        variant="ghost"
                        color="neutral"
                        @click="editingList = list; listDialog = true"
                        :title="`Edit ${list.name}`"
                      />
                    </div>
                    <div class="flex gap-1">
                      <!-- Column reorder buttons -->
                      <div class="flex flex-col gap-1">
                        <UButton
                          icon="i-lucide-chevron-left"
                          size="xs"
                          variant="ghost"
                          color="neutral"
                          :disabled="listIndex === 0 || reorderingLists.has(list.id)"
                          :loading="reorderingLists.has(list.id)"
                          @click="handleReorderList(list.id, 'up')"
                        />
                        <UButton
                          icon="i-lucide-chevron-right"
                          size="xs"
                          variant="ghost"
                          color="neutral"
                          :disabled="listIndex === sortedShoppingLists.length - 1 || reorderingLists.has(list.id)"
                          :loading="reorderingLists.has(list.id)"
                          @click="handleReorderList(list.id, 'down')"
                        />
                      </div>
                      <UButton
                        icon="i-lucide-plus"
                        size="sm"
                        color="neutral"
                        variant="ghost"
                        @click="openAddItem(list.id)"
                      />
                      <UButton
                        icon="i-lucide-trash"
                        size="sm"
                        color="neutral"
                        variant="ghost"
                        @click="handleDeleteList(list.id)"
                      />
                    </div>
                  </div>
                  
                  <!-- Progress Section -->
                  <div v-if="list.items && list.items.length > 0" class="space-y-2">
                    <div class="flex justify-between text-sm">
                      <span class="text-gray-600 dark:text-gray-400">
                        {{ list.items.filter(item => item.checked).length }} of {{ list.items.length }} items
                      </span>
                      <span class="text-gray-600 dark:text-gray-400 font-medium">
                        {{ getProgressPercentage(list) }}%
                      </span>
                    </div>
                    <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        class="h-2 rounded-full transition-all duration-300"
                        :class="getProgressColor(getProgressPercentage(list))"
                        :style="{ width: `${getProgressPercentage(list)}%` }"
                      />
                    </div>
                  </div>
                  <div v-else class="text-sm text-gray-500 dark:text-gray-400">
                    No items yet
                  </div>
                </div>

                <!-- Items List -->
                <div class="flex-1 p-4 overflow-y-auto">
                  <div v-if="!list.items || list.items.length === 0" class="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                    <UIcon name="i-lucide-shopping-bag" class="h-12 w-12 mb-3 opacity-30" />
                    <p class="text-sm font-medium mb-1">No items yet</p>
                    <p class="text-xs mb-4">Add your first item to get started</p>
                    <UButton size="sm" variant="outline" @click="openAddItem(list.id)">
                      Add Item
                    </UButton>
                  </div>
                  <div v-else class="space-y-2">
                    <div
                      v-for="(item, index) in list.sortedItems"
                      :key="item.id"
                      class="group flex items-start gap-3 p-3 rounded-lg transition-all hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                      :class="{ 'opacity-60 bg-gray-50 dark:bg-gray-800/50': item.checked }"
                      @click="openEditItem(item)"
                    >
                      <UCheckbox
                        :model-value="item.checked"
                        @update:model-value="handleToggleItem(item.id, $event)"
                        @click.stop
                        class="mt-0.5"
                      />
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                          <span 
                            class="text-sm font-medium text-gray-900 dark:text-white truncate"
                            :class="{ 'line-through': item.checked }"
                          >
                            {{ item.name }}
                          </span>
                          <span 
                            v-if="item.quantity > 1 || item.unit"
                            class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full"
                            :class="{ 'line-through': item.checked }"
                          >
                            {{ item.quantity }}{{ item.unit ? ` ${item.unit}` : '' }}
                          </span>
                        </div>
                        <p 
                          v-if="item.notes" 
                          class="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2"
                          :class="{ 'line-through': item.checked }"
                        >
                          {{ item.notes }}
                        </p>
                      </div>
                      <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" @click.stop>
                        <div class="flex flex-col gap-1">
                          <UButton
                            icon="i-lucide-chevron-up"
                            size="xs"
                            variant="ghost"
                            color="neutral"
                            :disabled="index === 0 || reorderingItems.has(item.id)"
                            :loading="reorderingItems.has(item.id)"
                            @click="handleReorderItem(item.id, 'up')"
                          />
                          <UButton
                            icon="i-lucide-chevron-down"
                            size="xs"
                            variant="ghost"
                            color="neutral"
                            :disabled="index === list.sortedItems.length - 1 || reorderingItems.has(item.id)"
                            :loading="reorderingItems.has(item.id)"
                            @click="handleReorderItem(item.id, 'down')"
                          />
                        </div>
                        <UButton
                          icon="i-lucide-pencil"
                          size="xs"
                          variant="ghost"
                          color="neutral"
                          @click="openEditItem(item)"
                          :title="`Edit ${item.name}`"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tandoor Lists -->
      <div v-else-if="currentIntegration?.service === 'tandoor'" class="flex-1 overflow-y-auto p-4">
        <div v-if="tandoorLoading" class="flex items-center justify-center h-full">
          <div class="text-center">
            <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-primary-500" />
            <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading Tandoor lists...</p>
          </div>
        </div>
        <div v-else-if="tandoorEntries.length === 0" class="flex items-center justify-center h-full">
          <div class="text-center">
            <UIcon name="i-lucide-shopping-cart" class="h-8 w-8 text-gray-400" />
            <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">No Tandoor shopping list items found</p>
          </div>
        </div>
        <div v-else class="h-full">
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 h-full">
            <div class="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 class="text-lg font-medium text-gray-900 dark:text-white">Tandoor Shopping List</h2>
            </div>
            <div class="divide-y divide-gray-200 dark:divide-gray-700">
              <div v-for="entry in tandoorEntries" :key="entry.id" class="p-4 hover:bg-gray-50 dark:hover:bg-gray-750">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <button
                      @click="handleToggleTandoorItem(entry)"
                      class="flex-shrink-0"
                    >
                      <UIcon
                        :name="entry.checked ? 'i-lucide-check-circle' : 'i-lucide-circle'"
                        :class="[
                          'h-5 w-5',
                          entry.checked 
                            ? 'text-green-500 dark:text-green-400' 
                            : 'text-gray-400 dark:text-gray-500'
                        ]"
                      />
                    </button>
                    <div>
                      <p 
                        :class="[
                          'text-sm font-medium',
                          entry.checked 
                            ? 'text-gray-500 line-through dark:text-gray-400' 
                            : 'text-gray-900 dark:text-white'
                        ]"
                      >
                        {{ entry.food?.name || 'Unnamed Item' }}
                      </p>
                      <p v-if="entry.amount > 0" class="text-xs text-gray-500 dark:text-gray-400">
                        {{ entry.amount }} {{ entry.unit?.name || 'units' }}
                      </p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      @click="handleDeleteTandoorEntry(entry.id)"
                      class="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
                    >
                      <UIcon name="i-lucide-trash-2" class="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Mealie Lists -->
      <div v-else-if="currentIntegration?.service === 'mealie'" class="flex-1 overflow-y-auto p-4">
        <div v-if="mealieLoading" class="flex items-center justify-center h-full">
          <div class="text-center">
            <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-primary-500" />
            <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading Mealie lists...</p>
          </div>
        </div>
        <div v-else-if="mealieLists.length === 0" class="flex items-center justify-center h-full">
          <div class="text-center">
            <UIcon name="i-lucide-utensils" class="h-8 w-8 text-gray-400" />
            <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">No Mealie shopping lists found</p>
            <UButton
              class="mt-4"
              color="primary"
              @click="editingMealieList = null; mealieListDialog = true"
            >
              Create List
            </UButton>
          </div>
        </div>
        <div v-else class="h-[calc(100vh-12rem)]">
          <div class="h-full overflow-x-auto pb-4">
            <div class="flex gap-6 min-w-max h-full">
              <div
                v-for="list in mealieLists"
                :key="list.id"
                class="flex-shrink-0 w-96 h-full flex flex-col bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
              >
                <!-- List Header -->
                <div class="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-t-lg">
                  <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center gap-2 flex-1 min-w-0">
                      <h2 class="text-lg font-semibold text-gray-900 dark:text-white truncate">
                        {{ list.name }}
                      </h2>
                      <UButton
                        icon="i-lucide-pencil"
                        size="xs"
                        variant="ghost"
                        color="neutral"
                        @click="editingMealieList = list; mealieListDialog = true"
                        :title="`Edit ${list.name}`"
                      />
                    </div>
                    <div class="flex gap-1">
                      <UButton
                        icon="i-lucide-plus"
                        size="sm"
                        color="neutral"
                        variant="ghost"
                        @click="selectedList = list; mealieEntryDialog = true"
                      />
                      <UButton
                        icon="i-lucide-trash"
                        size="sm"
                        color="neutral"
                        variant="ghost"
                        @click="handleDeleteMealieList(list.id)"
                      />
                    </div>
                  </div>
                  
                  <!-- Progress Section -->
                  <div v-if="list.listItems && list.listItems.length > 0" class="space-y-2">
                    <div class="flex justify-between text-sm">
                      <span class="text-gray-600 dark:text-gray-400">
                        {{ list.listItems.filter(item => item.checked).length }} of {{ list.listItems.length }} items
                      </span>
                      <span class="text-gray-600 dark:text-gray-400 font-medium">
                        {{ Math.round((list.listItems.filter(item => item.checked).length / list.listItems.length) * 100) }}%
                      </span>
                    </div>
                    <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        class="h-2 rounded-full transition-all duration-300"
                        :class="getProgressColor(Math.round((list.listItems.filter(item => item.checked).length / list.listItems.length) * 100))"
                        :style="{ width: `${Math.round((list.listItems.filter(item => item.checked).length / list.listItems.length) * 100)}%` }"
                      />
                    </div>
                  </div>
                  <div v-else class="text-sm text-gray-500 dark:text-gray-400">
                    No items yet
                  </div>
                </div>

                <!-- Items List -->
                <div class="flex-1 flex flex-col min-h-0">
                  <!-- Incomplete Items Section (2/3 height) -->
                  <div class="flex-[2] overflow-y-auto p-4">
                    <div v-if="!list?.listItems || list.listItems.length === 0" class="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                      <UIcon name="i-lucide-shopping-bag" class="h-12 w-12 mb-3 opacity-30" />
                      <p class="text-sm font-medium mb-1">No items yet</p>
                      <p class="text-xs mb-4">Add your first item to get started</p>
                      <UButton size="sm" variant="outline" @click="selectedList = list; mealieEntryDialog = true">
                        Add Item
                      </UButton>
                    </div>
                    <div v-else class="space-y-2">
                      <div
                        v-for="item in list.listItems.filter(i => !i.checked)"
                        :key="item?.id"
                        class="group flex items-start gap-3 p-3 rounded-lg transition-all hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                        @click="editingMealieEntry = item; mealieEntryDialog = true"
                      >
                        <UCheckbox
                          :model-value="item?.checked"
                          @update:model-value="handleMealieItemCheck(item)"
                          @click.stop
                          class="mt-0.5"
                        />
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2">
                            <span 
                              class="text-sm font-medium text-gray-900 dark:text-white truncate"
                            >
                              {{ item?.food?.name || item?.display || 'Unnamed Item' }}
                            </span>
                            <span 
                              v-if="item?.quantity > 1 || item?.unit"
                              class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full"
                            >
                              {{ item?.quantity }}{{ item?.unit ? ` ${item.unit.name}` : '' }}
                            </span>
                            <UBadge
                              v-if="item?.label"
                              :style="{ backgroundColor: item.label.color }"
                              class="text-white"
                            >
                              {{ item.label.name }}
                            </UBadge>
                          </div>
                          <p 
                            v-if="item?.note" 
                            class="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2"
                          >
                            {{ item.note }}
                          </p>
                        </div>
                        <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" @click.stop>
                          <UButton
                            icon="i-lucide-pencil"
                            size="xs"
                            variant="ghost"
                            color="neutral"
                            @click="editingMealieEntry = item; mealieEntryDialog = true"
                            :title="`Edit ${item?.food?.name || item?.display || 'Unnamed Item'}`"
                          />
                          <UButton
                            icon="i-lucide-trash-2"
                            size="xs"
                            variant="ghost"
                            color="neutral"
                            @click="handleDeleteMealieItem(item?.id)"
                            :title="`Delete ${item?.food?.name || item?.display || 'Unnamed Item'}`"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Completed Items Section (1/3 height) -->
                  <div v-if="list?.listItems?.some(item => item.checked)" class="flex-1 overflow-y-auto p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Completed Items</h3>
                    <div class="space-y-2">
                      <div
                        v-for="item in list.listItems.filter(i => i.checked)"
                        :key="item?.id"
                        class="group flex items-start gap-3 p-3 rounded-lg transition-all hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer opacity-60"
                        @click="editingMealieEntry = item; mealieEntryDialog = true"
                      >
                        <UCheckbox
                          :model-value="item?.checked"
                          @update:model-value="handleMealieItemCheck(item)"
                          @click.stop
                          class="mt-0.5"
                        />
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2">
                            <span 
                              class="text-sm font-medium text-gray-900 dark:text-white truncate line-through"
                            >
                              {{ item?.food?.name || item?.display || 'Unnamed Item' }}
                            </span>
                            <span 
                              v-if="item?.quantity > 1 || item?.unit"
                              class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full line-through"
                            >
                              {{ item?.quantity }}{{ item?.unit ? ` ${item.unit.name}` : '' }}
                            </span>
                            <UBadge
                              v-if="item?.label"
                              :style="{ backgroundColor: item.label.color }"
                              class="text-white"
                            >
                              {{ item.label.name }}
                            </UBadge>
                          </div>
                          <p 
                            v-if="item?.note" 
                            class="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2 line-through"
                          >
                            {{ item.note }}
                          </p>
                        </div>
                        <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" @click.stop>
                          <UButton
                            icon="i-lucide-pencil"
                            size="xs"
                            variant="ghost"
                            color="neutral"
                            @click="editingMealieEntry = item; mealieEntryDialog = true"
                            :title="`Edit ${item?.food?.name || item?.display || 'Unnamed Item'}`"
                          />
                          <UButton
                            icon="i-lucide-trash-2"
                            size="xs"
                            variant="ghost"
                            color="neutral"
                            @click="handleDeleteMealieItem(item?.id)"
                            :title="`Delete ${item?.food?.name || item?.display || 'Unnamed Item'}`"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Floating Action Button -->
    <UButton
      v-if="activeTab === 'native'"
      class="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg"
      color="primary"
      @click="openCreateList"
    >
      <UIcon name="i-lucide-plus" class="h-6 w-6" />
    </UButton>

    <UButton
      v-if="activeTab === 'tandoor'"
      class="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg"
      color="primary"
      @click="tandoorEntryDialog = true"
    >
      <UIcon name="i-lucide-plus" class="h-6 w-6" />
    </UButton>

    <UButton
      v-if="activeTab === 'mealie' && selectedList"
      class="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg"
      color="primary"
      @click="selectedList?.id && selectedIntegrationId && (mealieEntryDialog = true)"
    >
      <UIcon name="i-lucide-plus" class="h-6 w-6" />
    </UButton>

    <!-- Dialogs -->
    <ShoppingListDialog
      :is-open="listDialog"
      :list="editingList"
      @close="listDialog = false; editingList = null"
      @save="handleListSave"
    />

    <ShoppingListItemDialog
      :is-open="itemDialog"
      :item="editingItem"
      @close="itemDialog = false; selectedListId = ''; editingItem = null"
      @save="handleItemSave"
    />

    <TandoorEntryDialog
      :is-open="tandoorEntryDialog"
      :entry="editingTandoorEntry"
      @close="tandoorEntryDialog = false; editingTandoorEntry = null"
      @save="handleTandoorEntrySave"
    />

    <MealieEntryDialog
      :is-open="mealieEntryDialog"
      :entry="editingMealieEntry"
      :list-id="selectedList?.id"
      :selected-integration-id="selectedIntegrationId"
      @close="mealieEntryDialog = false; editingMealieEntry = null"
      @save="handleMealieEntrySave"
    />

    <MealieListDialog
      :is-open="mealieListDialog"
      :list="editingMealieList"
      @close="mealieListDialog = false; editingMealieList = null"
      @save="handleMealieListSave"
    />
  </div>
</template>
