<script setup lang="ts">
import type { CreateTodoInput, Priority } from '~/types/database'
import TodoDialog from '~/components/todos/TodoDialog.vue'
import AddItemModal from '~/components/AddItemModal.vue'

const { todos, loading: todosLoading, error: todosError, fetchTodos, createTodo, updateTodo, toggleTodo, deleteTodo, reorderTodo } = useTodos()
const { todoColumns, loading: columnsLoading, fetchTodoColumns, createTodoColumn, updateTodoColumn, deleteTodoColumn, reorderTodoColumns } = useTodoColumns()

// Modal state
const addItemModal = ref(false)
const todoDialog = ref(false)
const editingTodo = ref<any>(null)
const editingColumn = ref<any>(null)
const columnEditDialog = ref(false)

const priorityOptions = [
  { label: 'Low', value: 'LOW' },
  { label: 'Medium', value: 'MEDIUM' },
  { label: 'High', value: 'HIGH' },
  { label: 'Urgent', value: 'URGENT' }
]

const getPriorityColor = (priority: Priority) => {
  switch (priority) {
    case 'LOW': return 'text-green-600 bg-green-50 dark:bg-green-950'
    case 'MEDIUM': return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950'
    case 'HIGH': return 'text-orange-600 bg-orange-50 dark:bg-orange-950'
    case 'URGENT': return 'text-red-600 bg-red-50 dark:bg-red-950'
    default: return 'text-gray-600 bg-gray-50 dark:bg-gray-950'
  }
}

// Group todos by column and completion status
const todosByColumn = computed(() => {
  const grouped: Record<string, { active: any[], completed: any[] }> = {}
  
  todoColumns.value.forEach(column => {
    const columnTodos = todos.value.filter(todo => todo.todoColumnId === column.id)
    
    grouped[column.id] = {
      active: columnTodos.filter(todo => !todo.completed).sort((a, b) => (a.order || 0) - (b.order || 0)),
      completed: columnTodos.filter(todo => todo.completed).sort((a, b) => (a.order || 0) - (b.order || 0))
    }
  })
  
  return grouped
})

const openCreateTodo = (todoColumnId?: string) => {
  editingTodo.value = { todoColumnId: todoColumnId || null }
  todoDialog.value = true
}

const openEditTodo = (todo: any) => {
  editingTodo.value = { ...todo }
  todoDialog.value = true
}

const handleTodoSave = async (todoData: any) => {
  try {
    if (todoData.id) {
      await updateTodo(todoData.id, todoData)
    } else {
      await createTodo(todoData)
    }
    todoDialog.value = false
    editingTodo.value = null
  } catch (error) {
    console.error('Failed to save todo:', error)
  }
}

const handleTodoDelete = async (todoId: string) => {
  try {
    await deleteTodo(todoId)
    todoDialog.value = false
    editingTodo.value = null
  } catch (error) {
    console.error('Failed to delete todo:', error)
  }
}

const handleColumnSave = async (columnData: { name: string }) => {
  try {
    if (editingColumn.value?.id) {
      await updateTodoColumn(editingColumn.value.id, columnData)
    } else {
      await createTodoColumn(columnData)
    }
    columnEditDialog.value = false
    editingColumn.value = null
  } catch (error) {
    console.error('Failed to save column:', error)
  }
}

const openEditColumn = (column: any) => {
  editingColumn.value = { ...column }
  columnEditDialog.value = true
}

const handleColumnDelete = async () => {
  if (!editingColumn.value?.id) return
  
  const columnName = editingColumn.value.name
  const todoCount = (todosByColumn.value[editingColumn.value.id]?.active?.length || 0) + 
                   (todosByColumn.value[editingColumn.value.id]?.completed?.length || 0)
  
  const message = todoCount > 0 
    ? `Are you sure you want to delete "${columnName}"? Its ${todoCount} todo(s) will be moved to the Unassigned column.`
    : `Are you sure you want to delete "${columnName}"?`
  
  if (!confirm(message)) return
  
  try {
    await deleteTodoColumn(editingColumn.value.id)
    columnEditDialog.value = false
    editingColumn.value = null
  } catch (error) {
    console.error('Failed to delete column:', error)
  }
}

const handleToggleTodo = async (todoId: string, completed: boolean) => {
  try {
    await toggleTodo(todoId, completed)
  } catch (error) {
    console.error('Failed to toggle todo:', error)
  }
}

const reorderingTodos = ref(new Set<string>())
const reorderingColumns = ref(new Set<string>())

const handleReorderColumn = async (columnIndex: number, direction: 'left' | 'right') => {
  const column = todoColumns.value[columnIndex]
  if (!column) return
  
  // Prevent multiple simultaneous reorders of the same column
  if (reorderingColumns.value.has(column.id)) return
  
  const targetIndex = direction === 'left' ? columnIndex - 1 : columnIndex + 1
  
  // Check bounds
  if (targetIndex < 0 || targetIndex >= todoColumns.value.length) return
  
  reorderingColumns.value.add(column.id)
  
  try {
    await reorderTodoColumns(columnIndex, targetIndex)
  } catch (error) {
    console.error('Failed to reorder column:', error)
    alert('Failed to reorder column. Please try again.')
  } finally {
    reorderingColumns.value.delete(column.id)
  }
}

const handleReorderTodo = async (todoId: string, direction: 'up' | 'down', todoColumnId: string | null) => {
  // Prevent multiple simultaneous reorders of the same todo
  if (reorderingTodos.value.has(todoId)) return
  
  reorderingTodos.value.add(todoId)
  
  try {
    await reorderTodo(todoId, direction, todoColumnId)
  } catch (error) {
    console.error('Failed to reorder todo:', error)
    alert('Failed to reorder todo. Please try again.')
  } finally {
    reorderingTodos.value.delete(todoId)
  }
}

// Load data on mount
onMounted(async () => {
  await fetchTodoColumns()
  await fetchTodos()
})
</script>

<template>
  <div class="flex h-[calc(100vh-2rem)] w-full flex-col rounded-lg">
    <!-- Header -->
    <div class="py-5 sm:px-4 sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div class="flex flex-col gap-1.5">
        <h1 class="font-semibold text-xl text-gray-900 dark:text-white">
          To Do Lists
        </h1>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Manage your tasks and stay organized
        </p>
      </div>
    </div>

    <!-- Todos Content -->
    <div class="flex flex-1 flex-col min-h-0 p-4">
      <div v-if="columnsLoading" class="flex-1 flex items-center justify-center">
        <div class="text-center">
          <UIcon name="i-lucide-loader-2" class="animate-spin h-8 w-8 mx-auto text-gray-400" />
          <p class="text-gray-500 dark:text-gray-400 mt-2">Loading...</p>
        </div>
      </div>
      
      <div v-else class="flex-1 overflow-hidden">
        <div class="h-full overflow-x-auto pb-4">
          <div class="flex gap-6 min-w-max h-full">
            <div 
              v-for="(column, columnIndex) in todoColumns" 
              :key="column.id"
              class="flex-shrink-0 w-80 h-full flex flex-col bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
            >
              <!-- Column Header -->
              <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-t-lg">
                <div class="flex items-center gap-3 flex-1 min-w-0">
                  <div v-if="column.user" class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
                    {{ column.user.name.charAt(0).toUpperCase() }}
                  </div>
                  <div v-else class="w-8 h-8 rounded-full bg-gray-400 dark:bg-gray-600 flex items-center justify-center text-white text-sm font-medium">
                    <UIcon name="i-lucide-user-x" class="h-4 w-4" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <h2 class="text-lg font-semibold text-gray-900 dark:text-white truncate">
                        {{ column.name }}
                      </h2>
                      <UButton
                        v-if="!column.isDefault"
                        icon="i-lucide-pencil"
                        size="xs"
                        variant="ghost"
                        color="neutral"
                        @click="openEditColumn(column)"
                        :title="`Edit ${column.name}`"
                      />
                    </div>
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                      {{ (todosByColumn[column.id]?.active?.length || 0) + (todosByColumn[column.id]?.completed?.length || 0) }} todos
                    </p>
                  </div>
                </div>
                <div class="flex gap-1">
                  <!-- Column reorder buttons -->
                  <div class="flex flex-col gap-1">
                    <UButton
                      icon="i-lucide-chevron-left"
                      size="xs"
                      variant="ghost"
                      color="neutral"
                      :disabled="columnIndex === 0 || reorderingColumns.has(column.id)"
                      :loading="reorderingColumns.has(column.id)"
                      @click="handleReorderColumn(columnIndex, 'left')"
                    />
                    <UButton
                      icon="i-lucide-chevron-right"
                      size="xs"
                      variant="ghost"
                      color="neutral"
                      :disabled="columnIndex === todoColumns.length - 1 || reorderingColumns.has(column.id)"
                      :loading="reorderingColumns.has(column.id)"
                      @click="handleReorderColumn(columnIndex, 'right')"
                    />
                  </div>
                  <UButton
                    icon="i-lucide-plus"
                    size="sm"
                    color="neutral"
                    variant="ghost"
                    @click="openCreateTodo(column.id)"
                  />
                </div>
              </div>

              <!-- Active Todos Section (2/3 height) -->
              <div class="flex-1 flex flex-col" style="flex: 2">
                <div class="px-4 py-2 bg-gray-50 dark:bg-gray-800/30 border-b border-gray-200 dark:border-gray-700">
                  <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Active ({{ todosByColumn[column.id]?.active?.length || 0 }})
                  </h3>
                </div>
                <div class="flex-1 p-4 overflow-y-auto">
                  <div v-if="todosLoading" class="flex items-center justify-center py-12">
                    <UIcon name="i-lucide-loader-2" class="animate-spin h-6 w-6 text-gray-400" />
                  </div>
                  <div v-else-if="todosError" class="text-center py-8 text-red-600 dark:text-red-400 text-sm">
                    {{ todosError }}
                  </div>
                  <div v-else-if="(todosByColumn[column.id]?.active?.length || 0) === 0" class="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                    <UIcon name="i-lucide-circle-dashed" class="h-8 w-8 mb-2 opacity-30" />
                    <p class="text-sm font-medium mb-1">No active todos</p>
                    <p class="text-xs mb-3">Create a new todo to get started</p>
                    <UButton size="sm" variant="outline" @click="openCreateTodo(column.id)">
                      Add Todo
                    </UButton>
                  </div>
                  <div v-else class="space-y-3">
                    <div
                      v-for="(todo, index) in todosByColumn[column.id]?.active"
                      :key="todo.id"
                      class="group p-3 rounded-lg border border-gray-200 dark:border-gray-700 transition-all cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm"
                      @click="openEditTodo(todo)"
                    >
                      <div class="flex items-start gap-3">
                        <UCheckbox
                          :model-value="todo.completed"
                          @update:model-value="handleToggleTodo(todo.id, $event)"
                          @click.stop
                          class="mt-0.5"
                        />
                        <div class="flex-1 min-w-0">
                          <h3 class="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {{ todo.title }}
                          </h3>
                          <p v-if="todo.description" 
                             class="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                            {{ todo.description }}
                          </p>
                          <div class="flex items-center gap-2 mt-2">
                            <span class="px-2 py-1 rounded-full text-xs font-medium"
                                  :class="getPriorityColor(todo.priority)">
                              {{ todo.priority }}
                            </span>
                            <span v-if="todo.dueDate" class="text-xs text-gray-500 dark:text-gray-400">
                              {{ new Date(todo.dueDate).toLocaleDateString() }}
                            </span>
                          </div>
                        </div>
                        <div class="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity" @click.stop>
                          <UButton
                            icon="i-lucide-chevron-up"
                            size="xs"
                            variant="ghost"
                            color="neutral"
                            :disabled="index === 0 || reorderingTodos.has(todo.id)"
                            :loading="reorderingTodos.has(todo.id)"
                            @click="handleReorderTodo(todo.id, 'up', column.id)"
                          />
                          <UButton
                            icon="i-lucide-chevron-down"
                            size="xs"
                            variant="ghost"
                            color="neutral"
                            :disabled="index === (todosByColumn[column.id]?.active?.length || 0) - 1 || reorderingTodos.has(todo.id)"
                            :loading="reorderingTodos.has(todo.id)"
                            @click="handleReorderTodo(todo.id, 'down', column.id)"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Completed Todos Section (1/3 height) -->
              <div class="flex-1 flex flex-col border-t border-gray-200 dark:border-gray-700" style="flex: 1">
                <div class="px-4 py-2 bg-gray-50 dark:bg-gray-800/30">
                  <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Completed ({{ todosByColumn[column.id]?.completed?.length || 0 }})
                  </h3>
                </div>
                <div class="flex-1 p-4 overflow-y-auto">
                  <div v-if="(todosByColumn[column.id]?.completed?.length || 0) === 0" class="flex flex-col items-center justify-center py-6 text-gray-400 dark:text-gray-500">
                    <UIcon name="i-lucide-check-circle-2" class="h-6 w-6 mb-2 opacity-30" />
                    <p class="text-xs">No completed todos</p>
                  </div>
                  <div v-else class="space-y-2">
                    <div
                      v-for="(todo, index) in todosByColumn[column.id]?.completed"
                      :key="todo.id"
                      class="group p-3 rounded-lg border border-gray-200 dark:border-gray-700 transition-all cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 opacity-60 bg-gray-50 dark:bg-gray-800/50"
                      @click="openEditTodo(todo)"
                    >
                      <div class="flex items-start gap-3">
                        <UCheckbox
                          :model-value="todo.completed"
                          @update:model-value="handleToggleTodo(todo.id, $event)"
                          @click.stop
                          class="mt-0.5"
                        />
                        <div class="flex-1 min-w-0">
                          <h3 class="text-sm font-medium text-gray-900 dark:text-white truncate line-through">
                            {{ todo.title }}
                          </h3>
                          <p v-if="todo.description" 
                             class="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2 line-through">
                            {{ todo.description }}
                          </p>
                          <div class="flex items-center gap-2 mt-2">
                            <span class="px-2 py-1 rounded-full text-xs font-medium line-through"
                                  :class="getPriorityColor(todo.priority)">
                              {{ todo.priority }}
                            </span>
                            <span v-if="todo.dueDate" class="text-xs text-gray-500 dark:text-gray-400 line-through">
                              {{ new Date(todo.dueDate).toLocaleDateString() }}
                            </span>
                          </div>
                        </div>
                        <div class="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity" @click.stop>
                          <UButton
                            icon="i-lucide-chevron-up"
                            size="xs"
                            variant="ghost"
                            color="neutral"
                            :disabled="index === 0 || reorderingTodos.has(todo.id)"
                            :loading="reorderingTodos.has(todo.id)"
                            @click="handleReorderTodo(todo.id, 'up', column.id)"
                          />
                          <UButton
                            icon="i-lucide-chevron-down"
                            size="xs"
                            variant="ghost"
                            color="neutral"
                            :disabled="index === (todosByColumn[column.id]?.completed?.length || 0) - 1 || reorderingTodos.has(todo.id)"
                            :loading="reorderingTodos.has(todo.id)"
                            @click="handleReorderTodo(todo.id, 'down', column.id)"
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
      class="fixed bottom-8 right-8 rounded-full shadow-lg z-50 p-4"
      color="primary"
      size="xl"
      icon="i-lucide-plus"
      aria-label="Add Item"
      @click="addItemModal = true"
    />

    <!-- Add Item Modal -->
    <AddItemModal
      :is-open="addItemModal"
      :todo-columns="todoColumns"
      @close="addItemModal = false"
      @todo-save="handleTodoSave"
      @todo-delete="handleTodoDelete"
      @column-save="handleColumnSave"
    />

    <!-- Todo Dialog Modal (for editing existing todos) -->
    <TodoDialog
      :todo="editingTodo"
      :is-open="todoDialog"
      :todo-columns="todoColumns"
      @close="todoDialog = false; editingTodo = null"
      @save="handleTodoSave"
      @delete="handleTodoDelete"
    />

    <!-- Column Edit Dialog -->
    <div
      v-if="columnEditDialog"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      @click="columnEditDialog = false; editingColumn = null"
    >
      <div
        class="w-[425px] bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg"
        @click.stop
      >
        <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-base font-semibold leading-6">
            {{ editingColumn?.id ? 'Edit Column' : 'Create Column' }}
          </h3>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            class="-my-1"
            @click="columnEditDialog = false; editingColumn = null"
          />
        </div>

        <div class="p-4 space-y-4">
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">Column Name</label>
            <UInput
              v-model="editingColumn.name"
              placeholder="e.g., In Progress, Review, Done"
              class="w-full"
              @keydown.enter="handleColumnSave({ name: editingColumn.name })"
            />
          </div>
        </div>

        <div class="flex justify-between p-4 border-t border-gray-200 dark:border-gray-700">
          <UButton
            v-if="editingColumn?.id && !editingColumn.userId && !editingColumn.isDefault"
            color="red"
            variant="ghost"
            icon="i-lucide-trash"
            @click="handleColumnDelete"
          >
            Delete Column
          </UButton>
          <div class="flex gap-2" :class="{ 'ml-auto': !editingColumn?.id || editingColumn.userId || editingColumn.isDefault }">
            <UButton
              color="neutral"
              variant="ghost"
              @click="columnEditDialog = false; editingColumn = null"
            >
              Cancel
            </UButton>
            <UButton
              color="primary"
              @click="handleColumnSave({ name: editingColumn.name })"
              :disabled="!editingColumn?.name?.trim()"
            >
              {{ editingColumn?.id ? 'Update Column' : 'Create Column' }}
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
