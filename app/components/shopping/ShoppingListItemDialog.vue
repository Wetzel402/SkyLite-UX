<script setup lang="ts">
import type { CreateShoppingListItemInput } from '~/types/database'

const props = defineProps<{
  isOpen: boolean
  item?: any | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', item: CreateShoppingListItemInput): void
}>()

// Form state
const name = ref('')
const quantity = ref(1)
const unit = ref('')
const notes = ref('')
const error = ref<string | null>(null)

// Watch for modal open/close and item changes
watch(() => [props.isOpen, props.item], ([isOpen, item]) => {
  if (isOpen) {
    resetForm()
    if (item) {
      name.value = item.name || ''
      quantity.value = item.quantity || 1
      unit.value = item.unit || ''
      notes.value = item.notes || ''
    }
  }
}, { immediate: true })

function resetForm() {
  name.value = ''
  quantity.value = 1
  unit.value = ''
  notes.value = ''
  error.value = null
}

function handleSave() {
  if (!name.value.trim()) {
    error.value = 'Item name is required'
    return
  }

  emit('save', {
    name: name.value.trim(),
    quantity: quantity.value,
    unit: unit.value.trim() || undefined,
    notes: notes.value.trim() || undefined
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
          {{ item ? 'Edit Item' : 'Add Item' }}
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

        <div class="space-y-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Item Name</label>
          <UInput
            v-model="name"
            placeholder="e.g., Milk, Bread, Apples"
            class="w-full"
            :ui="{ base: 'w-full' }"
          />
        </div>

        <div class="flex gap-4">
          <div class="w-1/2 space-y-2">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Quantity</label>
            <UInput
              v-model.number="quantity"
              type="number"
              min="1"
              class="w-full"
              :ui="{ base: 'w-full' }"
            />
          </div>

          <div class="w-1/2 space-y-2">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Unit</label>
            <UInput
              v-model="unit"
              placeholder="e.g., lbs, oz, bottles"
              class="w-full"
              :ui="{ base: 'w-full' }"
            />
          </div>
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Notes</label>
          <UTextarea
            v-model="notes"
            placeholder="Additional notes (optional)"
            :rows="2"
            class="w-full"
            :ui="{ base: 'w-full' }"
          />
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
          {{ item ? 'Update Item' : 'Add Item' }}
        </UButton>
      </div>
    </div>
  </div>
</template> 