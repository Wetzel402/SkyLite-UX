<script setup lang="ts">
import type { CreateUserInput, CreateIntegrationInput } from '~/types/database'

const { users, loading, error, fetchUsers, createUser, deleteUser } = useUsers()
const { integrations, loading: integrationsLoading, fetchIntegrations, createIntegration, updateIntegration, deleteIntegration } = useIntegrations()

// Form state
const showNewUserForm = ref(false)
const newUser = reactive<CreateUserInput>({
  name: '',
  email: ''
})

const handleCreateUser = async () => {
  if (!newUser.name.trim()) return
  
  try {
    await createUser({ 
      name: newUser.name.trim(),
      email: newUser.email.trim() || ''  // Send empty string if no email
    })
    
    // Reset form
    Object.assign(newUser, { name: '', email: '' })
    showNewUserForm.value = false
  } catch (error) {
    console.error('Failed to create user:', error)
  }
}

const handleDeleteUser = async (userId: string, userName: string) => {
  if (!confirm(`Are you sure you want to delete user "${userName}"? Their todos will be moved to the Unassigned column.`)) {
    return
  }
  
  try {
    await deleteUser(userId)
  } catch (error) {
    console.error('Failed to delete user:', error)
  }
}

// Integration form state
const showNewIntegrationForm = ref(false)
const newIntegration = reactive<CreateIntegrationInput>({
  name: '',
  type: 'calendar',
  service: '',
  apiKey: '',
  baseUrl: '',
  enabled: true
})

const integrationTypes = [
  { 
    label: 'Calendar',
    value: 'calendar',
    services: [
      { label: 'Google Calendar', value: 'google' },
      { label: 'Outlook', value: 'outlook' }
    ]
  },
  { 
    label: 'Todo',
    value: 'todo',
    services: [
      { label: 'Todoist', value: 'todoist' },
      { label: 'Microsoft To Do', value: 'mstodo' }
    ]
  },
  { 
    label: 'Shopping List',
    value: 'shopping',
    services: [
      { label: 'Tandoor', value: 'tandoor' },
      { label: 'Mealie', value: 'mealie' }
    ]
  },
  { 
    label: 'Meal Planner',
    value: 'meal',
    services: [
      { label: 'Tandoor', value: 'tandoor' },
      { label: 'Mealie', value: 'mealie' }
    ]
  }
]

// Add active tab state
const activeIntegrationTab = ref('calendar')

// Add computed property to filter integrations by type
const filteredIntegrations = computed(() => {
  return integrations.value.filter(integration => integration.type === activeIntegrationTab.value)
})

// Add computed property to get available services for current type
const availableServices = computed(() => {
  const type = integrationTypes.find(t => t.value === activeIntegrationTab.value)
  return type ? type.services : []
})

// Watch for tab changes to update the form
watch(activeIntegrationTab, (newType) => {
  if (showNewIntegrationForm.value) {
    newIntegration.type = newType
    const type = integrationTypes.find(t => t.value === newType)
    if (type && type.services.length > 0) {
      newIntegration.service = type.services[0].value
    }
  }
})

const handleCreateIntegration = async () => {
  if (!newIntegration.name.trim() || !newIntegration.service || !newIntegration.apiKey.trim() || !newIntegration.baseUrl.trim()) return
  
  try {
    await createIntegration({
      name: newIntegration.name.trim(),
      type: activeIntegrationTab.value,
      service: newIntegration.service,
      apiKey: newIntegration.apiKey.trim(),
      baseUrl: newIntegration.baseUrl.trim(),
      enabled: newIntegration.enabled
    })
    
    // Reset form
    Object.assign(newIntegration, { 
      name: '', 
      type: activeIntegrationTab.value,
      service: availableServices.value[0]?.value || '',
      apiKey: '', 
      baseUrl: '', 
      enabled: true 
    })
    showNewIntegrationForm.value = false
  } catch (error) {
    console.error('Failed to create integration:', error)
  }
}

const handleDeleteIntegration = async (integrationId: string, integrationName: string) => {
  if (!confirm(`Are you sure you want to delete the "${integrationName}" integration?`)) {
    return
  }
  
  try {
    await deleteIntegration(integrationId)
  } catch (error) {
    console.error('Failed to delete integration:', error)
  }
}

const handleToggleIntegration = async (integrationId: string, enabled: boolean) => {
  try {
    await updateIntegration(integrationId, { enabled })
  } catch (error) {
    console.error('Failed to toggle integration:', error)
  }
}

// Load users and integrations on mount
onMounted(async () => {
  await Promise.all([
    fetchUsers(),
    fetchIntegrations()
  ])
})

// Add this function before the return statement in the script setup
const getIntegrationIcon = (type: string) => {
  switch (type) {
    case 'calendar':
      return 'i-lucide-calendar-days'
    case 'todo':
      return 'i-lucide-list-todo'
    case 'shopping':
      return 'i-lucide-shopping-cart'
    case 'meal':
      return 'i-lucide-utensils'
    default:
      return 'i-lucide-plug'
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Settings
        </h1>
        <p class="text-gray-600 dark:text-gray-400">
          Manage your application preferences and users
        </p>
      </div>

      <!-- User Management -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              User Management
            </h2>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Create and manage users for the application
            </p>
          </div>
          <UButton
            icon="i-lucide-user-plus"
            @click="showNewUserForm = !showNewUserForm"
          >
            Add User
          </UButton>
        </div>

        <!-- New User Form -->
        <div v-if="showNewUserForm" class="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h3 class="text-md font-medium text-gray-900 dark:text-white mb-4">Create New User</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Name *
              </label>
              <UInput
                v-model="newUser.name"
                placeholder="Enter user name"
                :required="true"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email (optional)
              </label>
              <UInput
                v-model="newUser.email"
                placeholder="Enter email address"
                type="email"
              />
            </div>
          </div>
          <div class="flex justify-end gap-2 mt-4">
            <UButton
              variant="ghost"
              @click="showNewUserForm = false"
            >
              Cancel
            </UButton>
            <UButton
              @click="handleCreateUser"
              :disabled="!newUser.name.trim()"
            >
              Create User
            </UButton>
          </div>
        </div>

        <!-- Users List -->
        <div v-if="loading" class="text-center py-8">
          <UIcon name="i-lucide-loader-2" class="animate-spin h-8 w-8 mx-auto" />
          <p class="text-gray-500 dark:text-gray-400 mt-2">Loading users...</p>
        </div>
        
        <div v-else-if="error" class="text-center py-8 text-red-600 dark:text-red-400">
          {{ error }}
        </div>
        
        <div v-else-if="users.length === 0" class="text-center py-8">
          <UIcon name="i-lucide-users" class="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <p class="text-gray-500 dark:text-gray-400 text-lg">No users found</p>
          <p class="text-gray-400 dark:text-gray-500 mb-6">Create your first user to get started</p>
        </div>
        
        <div v-else>
          <h3 class="text-md font-medium text-gray-900 dark:text-white mb-4">
            Existing Users ({{ users.length }})
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="user in users"
              :key="user.id"
              class="flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700"
            >
              <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
                {{ user.name.charAt(0).toUpperCase() }}
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-medium text-gray-900 dark:text-white truncate">{{ user.name }}</p>
                <p v-if="user.email" class="text-sm text-gray-500 dark:text-gray-400 truncate">{{ user.email }}</p>
                <p v-else class="text-sm text-gray-500 dark:text-gray-400">No email</p>
              </div>
              <UButton
                variant="ghost"
                color="red"
                size="sm"
                icon="i-lucide-trash-2"
                @click="handleDeleteUser(user.id, user.name)"
                :title="`Delete ${user.name}`"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Integrations -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              Integrations
            </h2>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Connect external services to enhance your experience
            </p>
          </div>
          <UButton
            icon="i-lucide-plug"
            @click="showNewIntegrationForm = !showNewIntegrationForm"
          >
            Add Integration
          </UButton>
        </div>

        <!-- Integration Type Tabs -->
        <div class="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav class="-mb-px flex space-x-8">
            <button
              v-for="type in integrationTypes"
              :key="type.value"
              @click="activeIntegrationTab = type.value"
              :class="[
                activeIntegrationTab === type.value
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300',
                'whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm'
              ]"
            >
              {{ type.label }}
            </button>
          </nav>
        </div>

        <!-- New Integration Form -->
        <div v-if="showNewIntegrationForm" class="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h3 class="text-md font-medium text-gray-900 dark:text-white mb-4">Add New Integration</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Integration Name *
              </label>
              <UInput
                v-model="newIntegration.name"
                placeholder="e.g., My Calendar Integration"
                :required="true"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Service *
              </label>
              <USelect
                v-model="newIntegration.service"
                :items="availableServices"
                value-attribute="value"
                option-attribute="label"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                API Key *
              </label>
              <UInput
                v-model="newIntegration.apiKey"
                placeholder="Enter API key"
                type="password"
                :required="true"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Base URL *
              </label>
              <UInput
                v-model="newIntegration.baseUrl"
                placeholder="https://your-integration-instance.com"
                :required="true"
              />
            </div>
          </div>
          <div class="flex justify-end gap-2 mt-4">
            <UButton
              variant="ghost"
              @click="showNewIntegrationForm = false"
            >
              Cancel
            </UButton>
            <UButton
              @click="handleCreateIntegration"
              :disabled="!newIntegration.name.trim() || !newIntegration.service || !newIntegration.apiKey.trim() || !newIntegration.baseUrl.trim()"
            >
              Add Integration
            </UButton>
          </div>
        </div>

        <!-- Integrations List -->
        <div v-if="integrationsLoading" class="text-center py-8">
          <UIcon name="i-lucide-loader-2" class="animate-spin h-8 w-8 mx-auto" />
          <p class="text-gray-500 dark:text-gray-400 mt-2">Loading integrations...</p>
        </div>
        
        <div v-else-if="filteredIntegrations.length === 0" class="text-center py-8">
          <UIcon name="i-lucide-plug" class="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <p class="text-gray-500 dark:text-gray-400 text-lg">No {{ integrationTypes.find(t => t.value === activeIntegrationTab)?.label }} integrations configured</p>
          <p class="text-gray-400 dark:text-gray-500 mb-6">Connect external services to enhance your experience</p>
        </div>
        
        <div v-else>
          <h3 class="text-md font-medium text-gray-900 dark:text-white mb-4">
            Active {{ integrationTypes.find(t => t.value === activeIntegrationTab)?.label }} Integrations ({{ filteredIntegrations.length }})
          </h3>
          <div class="space-y-4">
            <div
              v-for="integration in filteredIntegrations"
              :key="integration.id"
              class="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700"
            >
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-green-600 flex items-center justify-center text-white text-sm font-medium">
                  <UIcon 
                    :name="getIntegrationIcon(integration.service)" 
                    class="h-5 w-5"
                  />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-gray-900 dark:text-white">{{ integration.name }}</p>
                  <p class="text-sm text-gray-500 dark:text-gray-400 capitalize">{{ integrationTypes.find(t => t.value === integration.type)?.services.find(s => s.value === integration.service)?.label }}</p>
                  <p class="text-xs text-gray-400 dark:text-gray-500 truncate">{{ integration.baseUrl }}</p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <USwitch
                  :model-value="integration.enabled"
                  @update:model-value="handleToggleIntegration(integration.id, $event)"
                />
                <UButton
                  variant="ghost"
                  color="red"
                  size="sm"
                  icon="i-lucide-trash-2"
                  @click="handleDeleteIntegration(integration.id, integration.name)"
                  :title="`Delete ${integration.name}`"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- App Settings -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Application Settings
        </h2>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium text-gray-900 dark:text-white">Dark Mode</p>
              <p class="text-sm text-gray-600 dark:text-gray-400">Toggle between light and dark themes</p>
            </div>
            <USwitch />
          </div>
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium text-gray-900 dark:text-white">Notifications</p>
              <p class="text-sm text-gray-600 dark:text-gray-400">Enable push notifications</p>
            </div>
            <USwitch />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
