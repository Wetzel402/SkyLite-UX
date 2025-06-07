import type { User, CreateUserInput } from '~/types/database'

export const useUsers = () => {
  const users = ref<User[]>([])
  const currentUser = ref<User | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchUsers = async () => {
    loading.value = true
    error.value = null
    try {
      const data = await $fetch<User[]>('/api/users')
      users.value = data || []
    } catch (err) {
      error.value = 'Failed to fetch users'
      console.error('Error fetching users:', err)
    } finally {
      loading.value = false
    }
  }

  const createUser = async (userData: CreateUserInput) => {
    try {
      const newUser = await $fetch<User>('/api/users', {
        method: 'POST',
        body: userData
      })
      users.value.push(newUser)
      return newUser
    } catch (err) {
      error.value = 'Failed to create user'
      console.error('Error creating user:', err)
      throw err
    }
  }

  const deleteUser = async (userId: string) => {
    try {
      await $fetch(`/api/users/${userId}`, {
        method: 'DELETE' as const
      })
      
      // Remove user from the local state
      users.value = users.value.filter(user => user.id !== userId)
      
      // Clear current user if it was the deleted user
      if (currentUser.value?.id === userId) {
        clearCurrentUser()
      }
      
      return true
    } catch (err) {
      error.value = 'Failed to delete user'
      console.error('Error deleting user:', err)
      throw err
    }
  }

  const selectUser = (user: User) => {
    currentUser.value = user
    // Store in localStorage for persistence
    if (process.client) {
      localStorage.setItem('currentUser', JSON.stringify(user))
    }
  }

  const loadCurrentUser = () => {
    if (process.client) {
      const stored = localStorage.getItem('currentUser')
      if (stored) {
        currentUser.value = JSON.parse(stored)
      }
    }
  }

  const clearCurrentUser = () => {
    currentUser.value = null
    if (process.client) {
      localStorage.removeItem('currentUser')
    }
  }

  const reorderUser = async (userId: string, direction: 'up' | 'down') => {
    // Store original state for potential rollback
    const originalUsers = [...users.value]
    
    try {
      const sortedUsers = [...users.value].sort((a, b) => ((a as any).todoOrder || 0) - ((b as any).todoOrder || 0))
      const currentIndex = sortedUsers.findIndex(user => user.id === userId)
      
      if (currentIndex === -1) return
      
      let targetIndex
      if (direction === 'up' && currentIndex > 0) {
        targetIndex = currentIndex - 1
      } else if (direction === 'down' && currentIndex < sortedUsers.length - 1) {
        targetIndex = currentIndex + 1
      } else {
        return // No change needed
      }
      
      // Get the users to swap
      const currentUser = sortedUsers[currentIndex]
      const targetUser = sortedUsers[targetIndex]
      
      if (!currentUser || !targetUser) return
      
      // Optimistically update the todoOrder values
      const currentOrder = (currentUser as any).todoOrder || 0
      const targetOrder = (targetUser as any).todoOrder || 0
      
      // Update the users
      users.value = users.value.map(user => {
        if (user.id === currentUser.id) {
          return { ...user, todoOrder: targetOrder } as any
        }
        if (user.id === targetUser.id) {
          return { ...user, todoOrder: currentOrder } as any
        }
        return user
      })
      
      // Make API call with the new order
      const newOrder = users.value
        .sort((a, b) => ((a as any).todoOrder || 0) - ((b as any).todoOrder || 0))
        .map(user => user.id)
      
      await $fetch('/api/users/reorder', {
        method: 'PUT',
        body: { userIds: newOrder }
      })
      
    } catch (err) {
      // Revert on error
      users.value = originalUsers
      error.value = 'Failed to reorder user'
      console.error('Error reordering user:', err)
      throw err
    }
  }

  return {
    users: readonly(users),
    currentUser: readonly(currentUser),
    loading: readonly(loading),
    error: readonly(error),
    fetchUsers,
    createUser,
    deleteUser,
    selectUser,
    loadCurrentUser,
    clearCurrentUser,
    reorderUser
  }
} 