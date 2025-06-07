<script setup lang="ts">
import type { CreateShoppingListInput } from '~/types/database'

const props = defineProps<{
  isOpen: boolean
  list?: any | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', list: CreateShoppingListInput): void
}>()

// Form state
const name = ref('')
const error = ref<string | null>(null)

// Watch for modal open/close and list changes
watch(() => [props.isOpen, props.list], ([isOpen, list]) => {
  if (isOpen) {
    resetForm()
    if (list) {
      name.value = list.name || ''
    }
  }
}, { immediate: true })

function resetForm() {
  name.value = ''
  error.value = null
}

function handleSave() {
  if (!name.value.trim()) {
    error.value = 'List name is required'
    return
  }

  emit('save', {
    name: name.value.trim()
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
          {{ list ? 'Edit Shopping List' : 'Create Shopping List' }}
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
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">List Name</label>
          <UInput
            v-model="name"
            placeholder="e.g., Weekly Groceries, Hardware Store"
            class="w-full"
            :ui="{ base: 'w-full' }"
            @keydown.enter="handleSave"
          />
        </div>

        <div class="text-sm text-gray-600 dark:text-gray-400">
          You can add items to the list after creating it.
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
          {{ list ? 'Update List' : 'Create List' }}
        </UButton>
      </div>
    </div>
  </div>
</template> 