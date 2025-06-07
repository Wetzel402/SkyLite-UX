<script setup lang="ts">
import type { MealieShoppingListItem, MealieLabel, MealieUnit, MealieFood } from '~/lib/mealie'

// Simple debounce function if not available
function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timeoutId: ReturnType<typeof setTimeout>
  return function (this: any, ...args: Parameters<T>) {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn.apply(this, args), delay)
  }
}

const props = defineProps<{
  isOpen: boolean
  entry?: MealieShoppingListItem | null
  listId?: string
  selectedIntegrationId?: string
}>()

// Add validation for required props
if (props.isOpen) {
  if (!props.listId) {
    console.warn('MealieEntryDialog: listId prop is required when dialog is open')
  }
  if (!props.selectedIntegrationId) {
    console.warn('MealieEntryDialog: selectedIntegrationId prop is required when dialog is open')
  }
}

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', entry: { 
    food: MealieFood | null
    quantity: number
    unit: MealieUnit | null
    note: string
    isFood: boolean
    labelId: string | null
    foodId: string | null
    unitId: string | null
    disableAmount: boolean
    display: string
    shoppingListId: string
    checked: boolean
    position: number
    extras: Record<string, any>
    recipeReferences: any[]
  }): void
}>()

// Form state
const food = ref<MealieFood | null>(null)
const quantity = ref(1)
const unit = ref<MealieUnit | null>(null)
const note = ref('')
const isFood = ref(true)
const labelId = ref<string | null>(null)
const error = ref<string | null>(null)

// API data
const labels = ref<MealieLabel[]>([])
const units = ref<MealieUnit[]>([])
const foods = ref<MealieFood[]>([])
const loading = ref(false)
const foodSearch = ref('')

// Transform data for select menus
const formattedFoods = computed(() => foods.value.map(food => ({
  label: food.name,
  value: food,
  type: 'item'
})))

const formattedUnits = computed(() => units.value.map(unit => ({
  label: unit.name,
  value: unit,
  type: 'item'
})))

const formattedLabels = computed(() => labels.value.map(label => ({
  label: label.name,
  value: label,
  type: 'item',
  icon: 'i-lucide-circle',
  ui: {
    icon: {
      class: 'w-3 h-3 rounded-full',
      style: { backgroundColor: label.color }
    }
  }
})))

// Debounced search function
const debouncedFetchFoods = debounce(fetchFoods, 300)

// Watch for search changes
watch(foodSearch, () => {
  debouncedFetchFoods()
})

// Fetch data
async function fetchLabels() {
  try {
    const response = await fetch(`/api/mealie/api/groups/labels?integrationId=${props.selectedIntegrationId}`)
    const data = await response.json()
    labels.value = data.items || []
  } catch (error) {
    console.error('Failed to fetch labels:', error)
    labels.value = []
  }
}

async function fetchUnits() {
  try {
    const response = await fetch(`/api/mealie/api/units?integrationId=${props.selectedIntegrationId}`)
    const data = await response.json()
    units.value = data.items || []
  } catch (error) {
    console.error('Failed to fetch units:', error)
    units.value = []
  }
}

async function fetchFoods() {
  try {
    loading.value = true
    try {
      const response = await fetch(`/api/mealie/api/foods?${foodSearch?.value ? `query=${foodSearch.value}&` : ''}integrationId=${props.selectedIntegrationId}`)
      const data = await response.json()
      foods.value = data.items || []
    } catch (error) {
      console.error('Failed to fetch foods:', error)
      foods.value = []
    }
  } finally {
    loading.value = false
  }
}

// Watch for modal open/close and entry changes
watch(() => [props.isOpen, props.entry], async ([isOpen, entry]) => {
  if (isOpen) {
    resetForm()
    if (entry) {
      console.log('Setting entry values:', entry)
      food.value = entry.food || null
      quantity.value = entry.quantity
      unit.value = entry.unit || null
      note.value = entry.note
      isFood.value = entry.isFood
      labelId.value = entry.labelId
    }
    // Fetch initial data
    await Promise.all([
      fetchLabels(),
      fetchUnits(),
      fetchFoods()
    ])
  }
}, { immediate: true })

// Add watchers for debugging
watch(food, (newVal) => {
  console.log('Food changed:', newVal)
})

watch(unit, (newVal) => {
  console.log('Unit changed:', newVal)
})

watch(labelId, (newVal) => {
  console.log('Label changed:', newVal)
})

function resetForm() {
  food.value = null
  quantity.value = 1
  unit.value = null
  note.value = ''
  isFood.value = true
  labelId.value = null
  error.value = null
}

function handleSave() {
  if (isFood.value && (!food.value || !food.value.value?.name.trim())) {
    error.value = 'Food name is required'
    return
  }

  if (!isFood.value && !note.value.trim()) {
    error.value = 'Note is required for non-food items'
    return
  }

  // Get the selected label object
  const selectedLabel = labels.value.find(l => l.id === labelId.value?.value?.id)

  emit('save', {
    id: crypto.randomUUID(), // Generate a new UUID for the item
    shoppingListId: props.listId,
    checked: false,
    position: 0,
    quantity: quantity.value,
    note: note.value.trim(),
    isFood: isFood.value,
    labelId: labelId.value?.value?.id || null,
    foodId: food.value?.value?.id || null,
    unitId: unit.value?.value?.id || null,
    food: isFood.value ? food.value?.value : null,
    unit: unit.value?.value,
    label: labelId.value?.value || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
    @click="emit('close')"
  >
    <div
      class="w-[425px] max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg"
      @click.stop
    >
      <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 class="text-base font-semibold leading-6">
          {{ entry ? 'Edit Item' : 'Add Item' }}
        </h3>
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-x"
          class="-my-1"
          @click="emit('close')"
        />
      </div>

      <div class="p-4 space-y-6">
        <div v-if="error" class="bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-md px-3 py-2 text-sm">
          {{ error }}
        </div>

        <div class="flex items-center gap-2">
          <UCheckbox
            v-model="isFood"
            label="Is Food Item"
          />
        </div>

        <div v-if="isFood" class="space-y-4">
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Food</label>
            <USelectMenu
              v-model="food"
              :items="formattedFoods"
              item-key="value"
              item-label="label"
              placeholder="Search for a food..."
              searchable
              v-model:search="foodSearch"
              class="w-full"
            >
              <template #item="{ item }">
                <div class="flex items-center">
                  <span>{{ item.label }}</span>
                </div>
              </template>
              <template #selected="{ item }">
                <div class="flex items-center">
                  <span>{{ item?.label }}</span>
                </div>
              </template>
              <template #empty>
                <div class="px-2 py-1 text-sm text-gray-500">
                  No foods found
                </div>
              </template>
            </USelectMenu>
          </div>

          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Note</label>
            <UInput
              v-model="note"
              placeholder="Add a note (optional)"
              class="w-full"
              :ui="{ base: 'w-full' }"
            />
          </div>
        </div>

        <div v-else class="space-y-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Note</label>
          <UInput
            v-model="note"
            placeholder="e.g., Paper towels, Dish soap"
            class="w-full"
            :ui="{ base: 'w-full' }"
          />
        </div>

        <div class="flex gap-4">
          <div class="w-1/2 space-y-2">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Quantity</label>
            <UInput
              v-model="quantity"
              type="number"
              min="0"
              step="0.01"
              class="w-full"
              :ui="{ base: 'w-full' }"
            />
          </div>

          <div class="w-1/2 space-y-2">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Unit</label>
            <USelectMenu
              v-model="unit"
              :items="formattedUnits"
              item-key="value"
              item-label="label"
              placeholder="Search for a unit..."
              searchable
              class="w-full"
            >
              <template #item="{ item }">
                <div class="flex items-center">
                  <span>{{ item.label }}</span>
                </div>
              </template>
              <template #selected="{ item }">
                <div class="flex items-center">
                  <span>{{ item?.label }}</span>
                </div>
              </template>
              <template #empty>
                <div class="px-2 py-1 text-sm text-gray-500">
                  No units found
                </div>
              </template>
            </USelectMenu>
          </div>
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Label</label>
          <USelectMenu
            v-model="labelId"
            :items="formattedLabels"
            item-key="value"
            item-label="label"
            placeholder="Select a label"
            class="w-full"
          >
            <template #item="{ item }">
              <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-full" :style="{ backgroundColor: item.value.color }"></div>
                <span>{{ item.label }}</span>
              </div>
            </template>
            <template #selected="{ item }">
              <div class="flex items-center gap-2">
                <div v-if="item" class="w-3 h-3 rounded-full" :style="{ backgroundColor: item.value.color }"></div>
                <span>{{ item?.label }}</span>
              </div>
            </template>
            <template #empty>
              <div class="px-2 py-1 text-sm text-gray-500">
                No labels found
              </div>
            </template>
          </USelectMenu>
        </div>
      </div>

      <div class="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
        <UButton
          color="neutral"
          variant="ghost"
          @click="emit('close')"
        >
          Cancel
        </UButton>
        <UButton
          color="primary"
          @click="handleSave"
        >
          {{ entry ? 'Update Item' : 'Add Item' }}
        </UButton>
      </div>
    </div>
  </div>
</template> 