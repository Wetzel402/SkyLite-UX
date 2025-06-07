import type { TodoWithUser, CreateTodoInput, UpdateTodoInput } from '~/types/database'

export const useTodos = () => {
  const todos = ref<TodoWithUser[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchTodos = async (todoColumnId?: string) => {
    loading.value = true
    error.value = null
    try {
      const query = todoColumnId ? `?todoColumnId=${todoColumnId}` : ''
      const data = await $fetch<TodoWithUser[]>(`/api/todos${query}`)
      todos.value = data || []
    } catch (err) {
      error.value = 'Failed to fetch todos'
      console.error('Error fetching todos:', err)
    } finally {
      loading.value = false
    }
  }

  const createTodo = async (todoData: CreateTodoInput) => {
    try {
      const newTodo = await $fetch<TodoWithUser>('/api/todos', {
        method: 'POST',
        body: todoData
      })
      todos.value.unshift(newTodo)
      return newTodo
    } catch (err) {
      error.value = 'Failed to create todo'
      console.error('Error creating todo:', err)
      throw err
    }
  }

  const updateTodo = async (id: string, updates: UpdateTodoInput) => {
    try {
      const updatedTodo = await $fetch<TodoWithUser>(`/api/todos/${id}`, {
        method: 'PUT',
        body: updates
      })
      const index = todos.value.findIndex(t => t.id === id)
      if (index !== -1) {
        todos.value[index] = updatedTodo
      }
      return updatedTodo
    } catch (err) {
      error.value = 'Failed to update todo'
      console.error('Error updating todo:', err)
      throw err
    }
  }

  const toggleTodo = async (id: string, completed: boolean) => {
    return updateTodo(id, { completed })
  }

  const deleteTodo = async (id: string) => {
    try {
      await $fetch(`/api/todos/${id}`, { method: 'DELETE' })
      todos.value = todos.value.filter(t => t.id !== id)
    } catch (err) {
      error.value = 'Failed to delete todo'
      console.error('Error deleting todo:', err)
      throw err
    }
  }

  const reorderTodo = async (todoId: string, direction: 'up' | 'down', todoColumnId: string | null) => {
    // Store original state for potential rollback
    const originalTodos = [...todos.value]
    
    try {
      // Find the todo
      const currentTodo = todos.value.find(t => t.id === todoId)
      if (!currentTodo) return
      
      // Get all todos for the same column and completion state
      const sameSectionTodos = todos.value
        .filter(t => 
          t.todoColumnId === todoColumnId && 
          t.completed === currentTodo.completed
        )
        .sort((a, b) => ((a as any).order || 0) - ((b as any).order || 0))
      
      const currentIndex = sameSectionTodos.findIndex(t => t.id === todoId)
      if (currentIndex === -1) return
      
      let targetIndex
      if (direction === 'up' && currentIndex > 0) {
        targetIndex = currentIndex - 1
      } else if (direction === 'down' && currentIndex < sameSectionTodos.length - 1) {
        targetIndex = currentIndex + 1
      } else {
        return // No change needed
      }
      
      const targetTodo = sameSectionTodos[targetIndex]
      if (!targetTodo) return
      
      // Optimistically update the order values
      const currentOrder = (currentTodo as any).order
      const targetOrder = (targetTodo as any).order
      
      // Find and update the todos in the main array
      todos.value = todos.value.map(todo => {
        if (todo.id === currentTodo.id) {
          return { ...todo, order: targetOrder }
        }
        if (todo.id === targetTodo.id) {
          return { ...todo, order: currentOrder }
        }
        return todo
      })
      
      // Make API call
      await $fetch('/api/todos/reorder', {
        method: 'POST',
        body: { todoId, direction, todoColumnId }
      })
      
    } catch (err) {
      // Revert on error
      todos.value = originalTodos
      error.value = 'Failed to reorder todo'
      console.error('Error reordering todo:', err)
      throw err
    }
  }

  return {
    todos: readonly(todos),
    loading: readonly(loading),
    error: readonly(error),
    fetchTodos,
    createTodo,
    updateTodo,
    toggleTodo,
    deleteTodo,
    reorderTodo
  }
} 