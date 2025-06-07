<script setup lang="ts">

interface TodoColumn {
  id: string
  name: string
  user?: {
    id: string
    name: string
    avatar?: string
  }
}

const props = defineProps<{
  isOpen: boolean
  todoColumns: TodoColumn[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'todo-save', todo: any): void
  (e: 'todo-delete', todoId: string): void
  (e: 'column-save', column: { name: string }): void
}>()

const activeTab = ref<'todo' | 'column'>('todo')

// Todo form state
const todoTitle = ref('')
const todoDescription = ref('')
const todoPriority = ref<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM')
const todoDueDate = ref('')
const todoColumnId = ref<string | null>(null)
const todoError = ref<string | null>(null)

// Column form state
const columnName = ref('')
const columnError = ref<string | null>(null)

const priorityOptions = [
  { label: 'Low', value: 'LOW' },
  { label: 'Medium', value: 'MEDIUM' },
  { label: 'High', value: 'HIGH' },
  { label: 'Urgent', value: 'URGENT' }
]

// Watch for modal open/close
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    activeTab.value = 'todo'
    resetTodoForm()
    resetColumnForm()
  } else {
    resetTodoForm()
    resetColumnForm()
  }
})

function resetTodoForm() {
  todoTitle.value = ''
  todoDescription.value = ''
  todoPriority.value = 'MEDIUM'
  todoDueDate.value = ''
  todoColumnId.value = null
  todoError.value = null
}

function resetColumnForm() {
  columnName.value = ''
  columnError.value = null
}

function handleTodoSave() {
  if (!todoTitle.value.trim()) {
    todoError.value = 'Title is required'
    return
  }

  if (!todoColumnId.value && props.todoColumns.length > 0) {
    todoError.value = 'Please select a column'
    return
  }

  const todoData = {
    title: todoTitle.value.trim(),
    description: todoDescription.value.trim() || null,
    priority: todoPriority.value,
    dueDate: todoDueDate.value ? new Date(todoDueDate.value) : null,
    todoColumnId: todoColumnId.value || (props.todoColumns.length > 0 ? props.todoColumns[0].id : null)
  }

  emit('todo-save', todoData)
  resetTodoForm()
  emit('close')
}

function handleColumnSave() {
  if (!columnName.value.trim()) {
    columnError.value = 'Column name is required'
    return
  }

  emit('column-save', { name: columnName.value.trim() })
  resetColumnForm()
  emit('close')
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
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 class="text-base font-semibold leading-6">
          Add New Item
        </h3>
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-x"
          class="-my-1"
          @click="emit('close')"
        />
      </div>

      <!-- Tabs -->
      <div class="border-b border-gray-200 dark:border-gray-700">
        <nav class="flex space-x-8 px-4" aria-label="Tabs">
          <button
            @click="activeTab = 'todo'"
            :class="[
              'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors',
              activeTab === 'todo'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            ]"
          >
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-check-square" class="h-4 w-4" />
              Todo
            </div>
          </button>
          <button
            @click="activeTab = 'column'"
            :class="[
              'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors',
              activeTab === 'column'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            ]"
          >
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-columns" class="h-4 w-4" />
              Column
            </div>
          </button>
        </nav>
      </div>

      <!-- Tab Content -->
      <div class="p-4">
        <!-- Todo Tab -->
        <div v-if="activeTab === 'todo'" class="space-y-4">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Create a new todo task
          </p>
          
          <div v-if="todoError" class="bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-md px-3 py-2 text-sm">
            {{ todoError }}
          </div>

          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Title</label>
            <UInput
              v-model="todoTitle"
              placeholder="Todo title"
              class="w-full"
            />
          </div>

          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Description</label>
            <UTextarea
              v-model="todoDescription"
              placeholder="Todo description (optional)"
              :rows="3"
              class="w-full"
            />
          </div>

          <div class="flex gap-4">
            <div class="w-1/2 space-y-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Priority</label>
              <USelect
                v-model="todoPriority"
                :items="priorityOptions"
                option-attribute="label"
                value-attribute="value"
                class="w-full"
              />
            </div>

            <div class="w-1/2 space-y-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Due Date</label>
              <UInput
                v-model="todoDueDate"
                type="datetime-local"
                class="w-full"
              />
            </div>
          </div>

          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Column</label>
            <USelect
              v-model="todoColumnId"
              :items="todoColumns.map(column => ({ 
                label: column.name, 
                value: column.id 
              }))"
              option-attribute="label"
              value-attribute="value"
              class="w-full"
            />
          </div>

          <div class="flex gap-2 pt-2">
            <UButton
              color="neutral"
              variant="ghost"
              @click="emit('close')"
              class="flex-1"
            >
              Cancel
            </UButton>
            <UButton
              color="primary"
              @click="handleTodoSave"
              class="flex-1"
            >
              Create Todo
            </UButton>
          </div>
        </div>

        <!-- Column Tab -->
        <div v-if="activeTab === 'column'" class="space-y-4">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Create a new todo column
          </p>
          
          <div v-if="columnError" class="bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-md px-3 py-2 text-sm">
            {{ columnError }}
          </div>

          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">
              Column Name
            </label>
            <UInput
              v-model="columnName"
              placeholder="Enter column name"
              class="w-full"
              @keyup.enter="handleColumnSave"
            />
          </div>

          <div class="flex gap-2 pt-2">
            <UButton
              color="neutral"
              variant="ghost"
              @click="emit('close')"
              class="flex-1"
            >
              Cancel
            </UButton>
            <UButton
              color="primary"
              @click="handleColumnSave"
              class="flex-1"
            >
              Create Column
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </div>


</template> 