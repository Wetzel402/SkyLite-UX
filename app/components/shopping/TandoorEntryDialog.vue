<script setup lang="ts">
const props = defineProps<{
  isOpen: boolean
  entry?: any | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', entry: { food: { name: string }, amount: string, unit: string | null }): void
}>()

// Form state
const foodName = ref('')
const amount = ref('100')
const unit = ref('')
const error = ref<string | null>(null)

// Watch for modal open/close and entry changes
watch(() => [props.isOpen, props.entry], ([isOpen, entry]) => {
  if (isOpen) {
    resetForm()
    if (entry) {
      foodName.value = entry.food?.name || ''
      amount.value = entry.amount?.toString() || '100'
      unit.value = entry.unit?.name || ''
    }
  }
}, { immediate: true })

function resetForm() {
  foodName.value = ''
  amount.value = '100'
  unit.value = ''
  error.value = null
}

function handleSave() {
  if (!foodName.value.trim()) {
    error.value = 'Food name is required'
    return
  }

  emit('save', {
    food: { name: foodName.value.trim() },
    amount: amount.value,
    unit: unit.value.trim() || null
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

        <div class="space-y-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Food Name</label>
          <UInput
            v-model="foodName"
            placeholder="e.g., Yams, Apples, Milk"
            class="w-full"
            :ui="{ base: 'w-full' }"
          />
        </div>

        <div class="flex gap-4">
          <div class="w-1/2 space-y-2">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Amount</label>
            <UInput
              v-model="amount"
              type="number"
              min="0"
              step="0.01"
              class="w-full"
              :ui="{ base: 'w-full' }"
            />
          </div>

          <div class="w-1/2 space-y-2">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Unit</label>
            <UInput
              v-model="unit"
              placeholder="e.g., kg, g, pieces"
              class="w-full"
              :ui="{ base: 'w-full' }"
            />
          </div>
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