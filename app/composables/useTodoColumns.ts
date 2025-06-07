interface TodoColumn {
  id: string
  name: string
  order: number
  isDefault: boolean
  userId?: string
  user?: {
    id: string
    name: string
    avatar?: string
  }
  todos?: any[]
  _count?: {
    todos: number
  }
  createdAt: string
  updatedAt: string
}

export const useTodoColumns = () => {
  const todoColumns = ref<TodoColumn[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Fetch all todo columns
  const fetchTodoColumns = async () => {
    loading.value = true
    try {
      const data = await $fetch('/api/todo-columns')
      todoColumns.value = data
      error.value = null
    } catch (err: any) {
      error.value = err?.message || 'Failed to fetch todo columns'
      console.error('Failed to fetch todo columns:', err)
    } finally {
      loading.value = false
    }
  }

  // Create a new todo column
  const createTodoColumn = async (columnData: {
    name: string
    userId?: string
    isDefault?: boolean
  }) => {
    loading.value = true
    try {
      const newColumn = await $fetch('/api/todo-columns', {
        method: 'POST',
        body: columnData
      })
      
      todoColumns.value.push(newColumn)
      error.value = null
      return newColumn
    } catch (err: any) {
      error.value = err?.message || 'Failed to create todo column'
      console.error('Failed to create todo column:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Update a todo column
  const updateTodoColumn = async (columnId: string, updates: { name?: string }) => {
    try {
      const updatedColumn = await $fetch(`/api/todo-columns/${columnId}`, {
        method: 'PUT',
        body: updates
      })
      
      // Update the column in the local state
      const columnIndex = todoColumns.value.findIndex(column => column.id === columnId)
      if (columnIndex !== -1) {
        todoColumns.value[columnIndex] = { ...todoColumns.value[columnIndex], ...updatedColumn }
      }
      
      error.value = null
      return updatedColumn
    } catch (err: any) {
      error.value = err?.message || 'Failed to update todo column'
      console.error('Failed to update todo column:', err)
      throw err
    }
  }

  // Delete a todo column
  const deleteTodoColumn = async (columnId: string) => {
    try {
      await $fetch(`/api/todo-columns/${columnId}`, {
        method: 'DELETE' as const
      })
      
      // Remove the column from the local state
      todoColumns.value = todoColumns.value.filter(column => column.id !== columnId)
      
      error.value = null
      return true
    } catch (err: any) {
      error.value = err?.message || 'Failed to delete todo column'
      console.error('Failed to delete todo column:', err)
      throw err
    }
  }

  // Reorder todo columns
  const reorderTodoColumns = async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return

    // Optimistic update
    const columns = [...todoColumns.value]
    const movedColumn = columns.splice(fromIndex, 1)[0]
    if (movedColumn) {
      columns.splice(toIndex, 0, movedColumn)
    }
    
    // Update order values
    const reorders = columns.map((column, index) => ({
      id: column.id,
      order: index
    }))
    
    // Apply optimistic update
    todoColumns.value = columns.map((column, index) => ({
      ...column,
      order: index
    }))

    try {
      const updatedColumns = await $fetch('/api/todo-columns/reorder', {
        method: 'PUT',
        body: { reorders }
      })
      
      todoColumns.value = updatedColumns
      error.value = null
    } catch (err: any) {
      // Rollback on error
      await fetchTodoColumns()
      error.value = err?.message || 'Failed to reorder todo columns'
      console.error('Failed to reorder todo columns:', err)
      throw err
    }
  }

  return {
    todoColumns: readonly(todoColumns),
    loading: readonly(loading),
    error: readonly(error),
    fetchTodoColumns,
    createTodoColumn,
    updateTodoColumn,
    deleteTodoColumn,
    reorderTodoColumns
  }
} 