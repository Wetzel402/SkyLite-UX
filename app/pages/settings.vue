<script setup lang="ts">
import { consola } from "consola";

import type { AppSettings, CreateIntegrationInput, CreateUserInput, Integration, User } from "~/types/database";
import type { ConnectionTestResult } from "~/types/ui";

import SettingsCalendarSelectDialog from "~/components/settings/settingsCalendarSelectDialog.vue";
import SettingsIntegrationDialog from "~/components/settings/settingsIntegrationDialog.vue";
import SettingsUserDialog from "~/components/settings/settingsUserDialog.vue";
import { integrationServices } from "~/plugins/02.appInit";
import { getSlogan } from "~/types/global";
import { createIntegrationService, integrationRegistry } from "~/types/integrations";

const { users, loading, error, createUser, deleteUser, updateUser } = useUsers();

const logoLoaded = ref(true);
const { integrations, loading: integrationsLoading, servicesInitializing, createIntegration, updateIntegration, deleteIntegration } = useIntegrations();
const { checkIntegrationCache, purgeIntegrationCache, triggerImmediateSync, purgeCalendarEvents } = useSyncManager();

const colorMode = useColorMode();

// Fetch database info
const { data: databaseInfo } = await useFetch("/api/system/database");

const isDark = computed({
  get() {
    return colorMode.value === "dark";
  },
  set() {
    colorMode.preference = colorMode.value === "dark" ? "light" : "dark";
  },
});

const { showError, showInfo } = useAlertToast();

const { settings, updateSettings, getSettings } = useAppSettings();
const { homeSettings, fetchHomeSettings, updateHomeSettings: updateHomeSettingsComposable } = useHomeSettings();
const { selectedAlbums, fetchSelectedAlbums, openPicker } = usePhotosPicker();

// Photo management state
const selectedPhotoIds = ref<Set<string>>(new Set());
const currentPage = ref(1);
const photosPerPage = 20;
const selectAllPhotos = ref(false);

// Pagination
const paginatedPhotos = computed(() => {
  const start = (currentPage.value - 1) * photosPerPage;
  const end = start + photosPerPage;
  return selectedAlbums.value.slice(start, end);
});

const totalPages = computed(() => Math.ceil(selectedAlbums.value.length / photosPerPage));

// Toggle individual photo selection
function togglePhotoSelection(photoId: string) {
  if (selectedPhotoIds.value.has(photoId)) {
    selectedPhotoIds.value.delete(photoId);
  }
  else {
    selectedPhotoIds.value.add(photoId);
  }
  // Update select all checkbox state
  selectAllPhotos.value = paginatedPhotos.value.every(p => selectedPhotoIds.value.has(p.id));
}

// Toggle select all on current page
function toggleSelectAllOnPage() {
  if (selectAllPhotos.value) {
    // Deselect all on current page
    paginatedPhotos.value.forEach((photo) => {
      selectedPhotoIds.value.delete(photo.id);
    });
    selectAllPhotos.value = false;
  }
  else {
    // Select all on current page
    paginatedPhotos.value.forEach((photo) => {
      selectedPhotoIds.value.add(photo.id);
    });
    selectAllPhotos.value = true;
  }
}

// Bulk delete selected photos
async function handleBulkDeletePhotos() {
  if (selectedPhotoIds.value.size === 0)
    return;

  try {
    const idsToDelete = Array.from(selectedPhotoIds.value);
    await Promise.all(idsToDelete.map(id => $fetch(`/api/selected-albums/${id}`, { method: "DELETE" })));
    await fetchSelectedAlbums();
    selectedPhotoIds.value.clear();
    selectAllPhotos.value = false;

    // Adjust current page if needed
    if (paginatedPhotos.value.length === 0 && currentPage.value > 1) {
      currentPage.value--;
    }
  }
  catch (error) {
    consola.error("Failed to delete photos:", error);
    showError("Delete Failed", "Failed to delete selected photos");
  }
}

// Delete all photos
async function handleDeleteAllPhotos() {
  try {
    await Promise.all(selectedAlbums.value.map(album => $fetch(`/api/selected-albums/${album.id}`, { method: "DELETE" })));
    await fetchSelectedAlbums();
    selectedPhotoIds.value.clear();
    selectAllPhotos.value = false;
    currentPage.value = 1;
  }
  catch (error) {
    consola.error("Failed to delete all photos:", error);
    showError("Delete Failed", "Failed to delete all photos");
  }
}

// Watch for page changes to update select all state
watch(currentPage, () => {
  selectAllPhotos.value = paginatedPhotos.value.every(p => selectedPhotoIds.value.has(p.id));
});
const showMeals = computed({
  get() {
    return settings.value?.showMealsOnCalendar ?? false;
  },
  set(value: boolean) {
    // Get mutable cached settings for optimistic update
    const { data: cachedSettings } = useNuxtData<AppSettings>("app-settings");

    // Capture previous state for rollback
    const previousValue = cachedSettings.value?.showMealsOnCalendar ?? false;

    // Optimistic update - apply immediately to cached data
    if (cachedSettings.value) {
      cachedSettings.value.showMealsOnCalendar = value;
    }

    // Update server and handle errors with rollback
    (async () => {
      try {
        await updateSettings({ showMealsOnCalendar: value });
      }
      catch (error) {
        // Rollback optimistic update on failure
        if (cachedSettings.value) {
          cachedSettings.value.showMealsOnCalendar = previousValue;
        }
        // Refresh from server to ensure consistency
        await getSettings();

        consola.error("Settings: Failed to update meal calendar setting:", error);
        showError("Settings Update Failed", "Failed to update meal calendar visibility setting.");
      }
    })();
  },
});

// Color mode initialization is now handled globally by the colorMode plugin

const selectedUser = ref<User | null>(null);
const isUserDialogOpen = ref(false);
const selectedIntegration = ref<Integration | null>(null);
const isIntegrationDialogOpen = ref(false);
const isCalendarSelectDialogOpen = ref(false);
const calendarSelectIntegration = ref<Integration | null>(null);

const connectionTestResult = ref<ConnectionTestResult>(null);

const route = useRoute();

const activeIntegrationTab = ref<string>("");

const availableIntegrationTypes = computed(() => {
  const types = new Set<string>();
  integrationRegistry.forEach(config => types.add(config.type));
  return Array.from(types);
});

onMounted(async () => {
  if (availableIntegrationTypes.value.length > 0) {
    activeIntegrationTab.value = availableIntegrationTypes.value[0] || "";
  }

  await refreshNuxtData("integrations");
  await fetchHomeSettings();
  await fetchSelectedAlbums();
});

watch(() => route.query, (query) => {
  if (query.success === "google_calendar_added" && query.integrationId) {
    nextTick(() => {
      const allIntegrations = integrations.value as Integration[];
      const integration = allIntegrations.find(i => i.id === query.integrationId);
      if (integration) {
        calendarSelectIntegration.value = integration;
        isCalendarSelectDialogOpen.value = true;
      }
    });
  }
  if (query.success === "google_tasks_added" && query.integrationId) {
    nextTick(async () => {
      await refreshNuxtData("integrations");
      // Optionally show a success message
      consola.success("Google Tasks integration added successfully");
    });
  }
}, { immediate: true });

const filteredIntegrations = computed(() => {
  return (integrations.value as Integration[]).filter(integration => integration.type === activeIntegrationTab.value);
});

async function handleUserSave(userData: CreateUserInput) {
  try {
    if (selectedUser.value?.id) {
      const { data: cachedUsers } = useNuxtData("users");
      const previousUsers = cachedUsers.value ? [...cachedUsers.value] : [];

      if (cachedUsers.value && Array.isArray(cachedUsers.value)) {
        const userIndex = cachedUsers.value.findIndex((u: User) => u.id === selectedUser.value!.id);
        if (userIndex !== -1) {
          cachedUsers.value[userIndex] = { ...cachedUsers.value[userIndex], ...userData };
        }
      }

      try {
        await updateUser(selectedUser.value.id, userData);
        consola.debug("Settings: User updated successfully");
      }
      catch (error) {
        if (cachedUsers.value && previousUsers.length > 0) {
          cachedUsers.value.splice(0, cachedUsers.value.length, ...previousUsers);
        }
        throw error;
      }
    }
    else {
      await createUser(userData);
      consola.debug("Settings: User created successfully");
    }

    isUserDialogOpen.value = false;
    selectedUser.value = null;
  }
  catch (error) {
    consola.error("Settings: Failed to save user:", error);
  }
}

async function handleUserDelete(userId: string) {
  try {
    const { data: cachedUsers } = useNuxtData("users");
    const previousUsers = cachedUsers.value ? [...cachedUsers.value] : [];

    if (cachedUsers.value && Array.isArray(cachedUsers.value)) {
      cachedUsers.value.splice(0, cachedUsers.value.length, ...cachedUsers.value.filter((u: User) => u.id !== userId));
    }

    try {
      await deleteUser(userId);
      consola.debug("Settings: User deleted successfully");
    }
    catch (error) {
      if (cachedUsers.value && previousUsers.length > 0) {
        cachedUsers.value.splice(0, cachedUsers.value.length, ...previousUsers);
      }
      throw error;
    }

    isUserDialogOpen.value = false;
    selectedUser.value = null;
  }
  catch (error) {
    consola.error("Settings: Failed to delete user:", error);
  }
}

function openUserDialog(user: User | null = null) {
  selectedUser.value = user;
  isUserDialogOpen.value = true;
}

async function handleIntegrationSave(integrationData: CreateIntegrationInput) {
  try {
    connectionTestResult.value = {
      success: false,
      message: "Testing connection...",
      isLoading: true,
    };

    if (selectedIntegration.value?.id) {
      const { data: cachedIntegrations } = useNuxtData("integrations");
      const previousIntegrations = cachedIntegrations.value ? [...cachedIntegrations.value] : [];

      if (cachedIntegrations.value && Array.isArray(cachedIntegrations.value)) {
        const integrationIndex = cachedIntegrations.value.findIndex((i: Integration) => i.id === selectedIntegration.value!.id);
        if (integrationIndex !== -1) {
          cachedIntegrations.value[integrationIndex] = {
            ...cachedIntegrations.value[integrationIndex],
            ...integrationData,
            updatedAt: new Date(),
          };
        }
      }

      try {
        connectionTestResult.value = {
          success: false,
          message: "Updating integration...",
          isLoading: true,
        };

        await updateIntegration(selectedIntegration.value.id, {
          ...integrationData,
          createdAt: selectedIntegration.value.createdAt,
          updatedAt: new Date(),
        });

        connectionTestResult.value = {
          success: true,
          message: "Integration updated successfully!",
          isLoading: false,
        };
      }
      catch (error) {
        if (cachedIntegrations.value && previousIntegrations.length > 0) {
          cachedIntegrations.value.splice(0, cachedIntegrations.value.length, ...previousIntegrations);
        }
        throw error;
      }
    }
    else {
      const { data: cachedIntegrations } = useNuxtData("integrations");
      const previousIntegrations = cachedIntegrations.value ? [...cachedIntegrations.value] : [];
      const newIntegration = {
        id: `temp-${Date.now()}`,
        ...integrationData,
        createdAt: new Date(),
        updatedAt: new Date(),
        enabled: false,
      };

      if (cachedIntegrations.value && Array.isArray(cachedIntegrations.value)) {
        cachedIntegrations.value.push(newIntegration);
      }

      try {
        connectionTestResult.value = {
          success: false,
          message: "Creating integration...",
          isLoading: true,
        };

        const createdIntegration = await createIntegration({
          ...integrationData,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        if (cachedIntegrations.value && Array.isArray(cachedIntegrations.value)) {
          const tempIndex = cachedIntegrations.value.findIndex((i: Integration) => i.id === newIntegration.id);
          if (tempIndex !== -1) {
            cachedIntegrations.value[tempIndex] = createdIntegration;
          }
        }

        connectionTestResult.value = {
          success: true,
          message: "Integration created successfully!",
          isLoading: false,
        };
      }
      catch (error) {
        if (cachedIntegrations.value && previousIntegrations.length > 0) {
          cachedIntegrations.value.splice(0, cachedIntegrations.value.length, ...previousIntegrations);
        }
        throw error;
      }
    }

    await refreshNuxtData("integrations");

    const { refreshIntegrations } = useIntegrations();
    await refreshIntegrations();

    // Close dialog immediately after successful operation
    isIntegrationDialogOpen.value = false;
    selectedIntegration.value = null;
    connectionTestResult.value = null;
  }
  catch (error) {
    consola.error("Settings: Failed to save integration:", error);
    connectionTestResult.value = {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save integration",
      isLoading: false,
    };
  }
}

function handleSelectCalendars(integrationId: string) {
  const integration = (integrations.value as Integration[]).find(i => i.id === integrationId);
  if (integration) {
    calendarSelectIntegration.value = integration;
    isCalendarSelectDialogOpen.value = true;
  }
}

async function handleCalendarsSaved() {
  if (calendarSelectIntegration.value) {
    await triggerImmediateSync(
      calendarSelectIntegration.value.type,
      calendarSelectIntegration.value.id,
    );

    await new Promise(resolve => setTimeout(resolve, 2500));

    await refreshNuxtData("calendar-events");
  }

  isCalendarSelectDialogOpen.value = false;
  calendarSelectIntegration.value = null;
}

function handleCalendarsDisabled(calendarIds: string[]) {
  if (!calendarSelectIntegration.value?.id) {
    return;
  }

  const integrationId = calendarSelectIntegration.value.id;

  consola.debug(
    `Settings: Purging events from ${calendarIds.length} disabled calendar(s) in integration ${integrationId}:`,
    calendarIds,
  );

  purgeCalendarEvents(integrationId, calendarIds);
}

async function handleIntegrationDelete(integrationId: string) {
  try {
    const { data: cachedIntegrations } = useNuxtData("integrations");
    const previousIntegrations = cachedIntegrations.value ? [...cachedIntegrations.value] : [];

    if (cachedIntegrations.value && Array.isArray(cachedIntegrations.value)) {
      cachedIntegrations.value.splice(0, cachedIntegrations.value.length, ...cachedIntegrations.value.filter((i: Integration) => i.id !== integrationId));
    }

    try {
      await deleteIntegration(integrationId);
      consola.debug("Settings: Integration deleted successfully");
    }
    catch (error) {
      if (cachedIntegrations.value && previousIntegrations.length > 0) {
        cachedIntegrations.value.splice(0, cachedIntegrations.value.length, ...previousIntegrations);
      }
      throw error;
    }

    await refreshNuxtData("integrations");

    const { refreshIntegrations } = useIntegrations();
    await refreshIntegrations();

    isIntegrationDialogOpen.value = false;
    selectedIntegration.value = null;
  }
  catch (error) {
    consola.error("Settings: Failed to delete integration:", error);
  }
}

function openIntegrationDialog(integration: Integration | null = null) {
  if (!activeIntegrationTab.value && availableIntegrationTypes.value.length > 0) {
    activeIntegrationTab.value = availableIntegrationTypes.value[0] || "";
  }

  selectedIntegration.value = integration;
  isIntegrationDialogOpen.value = true;
}

async function handleToggleIntegration(integrationId: string, enabled: boolean) {
  try {
    const integration = (integrations.value as Integration[]).find((i: Integration) => i.id === integrationId);
    if (!integration) {
      throw new Error("Integration not found");
    }

    const { data: cachedIntegrations } = useNuxtData("integrations");
    const previousIntegrations = cachedIntegrations.value ? [...cachedIntegrations.value] : [];

    if (cachedIntegrations.value && Array.isArray(cachedIntegrations.value)) {
      const integrationIndex = cachedIntegrations.value.findIndex((i: Integration) => i.id === integrationId);
      if (integrationIndex !== -1) {
        cachedIntegrations.value[integrationIndex] = {
          ...cachedIntegrations.value[integrationIndex],
          enabled,
        };
      }
    }

    if (enabled) {
      try {
        const service = await createIntegrationService(integration);
        if (service) {
          integrationServices.set(integrationId, service);
          service.initialize().catch((error) => {
            consola.warn(`Background service initialization failed for ${integration.name}:`, error);
          });
        }
      }
      catch (serviceError) {
        consola.warn(`Failed to create integration service for ${integration.name}:`, serviceError);
      }
    }
    else {
      try {
        integrationServices.delete(integrationId);
      }
      catch (serviceError) {
        consola.warn(`Failed to remove integration service for ${integration.name}:`, serviceError);
      }
    }

    try {
      if (enabled) {
        await updateIntegration(integrationId, { enabled });

        const hasCache = checkIntegrationCache(integration.type, integrationId);

        if (!hasCache) {
          consola.debug(`Settings: No cache found for ${integration.type} integration ${integrationId}, triggering immediate sync`);

          await triggerImmediateSync(integration.type, integrationId);
        }
      }
      else {
        await updateIntegration(integrationId, { enabled });

        purgeIntegrationCache(integration.type, integrationId);
        consola.debug(`Settings: Purged cache for disabled ${integration.type} integration ${integrationId}`);
      }

      consola.debug(`Settings: Integration ${enabled ? "enabled" : "disabled"} successfully`);
    }
    catch (error) {
      consola.warn(`Settings: Rolling back optimistic update for integration ${integrationId} due to error:`, error);

      if (cachedIntegrations.value && previousIntegrations.length > 0) {
        cachedIntegrations.value.splice(0, cachedIntegrations.value.length, ...previousIntegrations);
      }

      if (enabled) {
        try {
          integrationServices.delete(integrationId);
        }
        catch (rollbackError) {
          consola.warn(`Failed to rollback service creation for ${integration.name}:`, rollbackError);
        }
      }
      else {
        try {
          const service = await createIntegrationService(integration);
          if (service) {
            integrationServices.set(integrationId, service);
            service.initialize().catch((error) => {
              consola.warn(`Background service initialization failed for ${integration.name}:`, error);
            });
          }
        }
        catch (rollbackError) {
          consola.warn(`Failed to rollback service removal for ${integration.name}:`, rollbackError);
        }
      }

      throw error;
    }
  }
  catch (error) {
    consola.error("Settings: Failed to toggle integration:", error);
  }
}

function getIntegrationIcon(type: string) {
  switch (type) {
    case "calendar":
      return "i-lucide-calendar-days";
    case "todo":
      return "i-lucide-list-todo";
    case "shopping":
      return "i-lucide-shopping-cart";
    case "meal":
      return "i-lucide-utensils";
    default:
      return "i-lucide-plug";
  }
}

function getIntegrationTypeLabel(type: string) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function getIntegrationIconUrl(integration: Integration) {
  if (integration.icon) {
    return integration.icon;
  }

  const config = integrationRegistry.get(`${integration.type}:${integration.service}`);
  return config?.icon || null;
}

function integrationNeedsReauth(integration?: Integration | null): boolean {
  if (!integration)
    return false;
  const settings = integration.settings as { needsReauth?: boolean } | undefined;
  return Boolean(settings?.needsReauth);
}

async function handleOpenPhotosPicker() {
  try {
    const result = await openPicker();
    // result is null if user closed picker without selecting anything - this is fine
    if (result === null) {
      showInfo("No Photos Selected", "You closed the picker without selecting any photos.");
    }
  }
  catch (error) {
    consola.error("Failed to open picker:", error);
    showError("Picker Error", "Failed to open Google Photos picker");
  }
}
</script>

<template>
  <div class="flex w-full flex-col rounded-lg">
    <div class="py-5 sm:px-4 sticky top-0 z-40 bg-default border-b border-default">
      <GlobalDateHeader />
    </div>

    <div class="flex-1 bg-default p-6">
      <div class="max-w-4xl mx-auto">
        <div class="bg-default rounded-lg shadow-sm border border-default p-6 mb-6">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h2 class="text-lg font-semibold text-highlighted">
                Users
              </h2>
            </div>
            <UButton
              icon="i-lucide-user-plus"
              @click="openUserDialog()"
            >
              Add User
            </UButton>
          </div>

          <div v-if="loading" class="text-center py-8">
            <UIcon name="i-lucide-loader-2" class="animate-spin h-8 w-8 mx-auto" />
            <p class="text-default mt-2">
              Loading users...
            </p>
          </div>

          <div v-else-if="error" class="text-center py-8 text-error">
            {{ error }}
          </div>

          <div v-else-if="users.length === 0" class="text-center py-8">
            <div class="flex items-center justify-center gap-2 text-default">
              <UIcon name="i-lucide-frown" class="h-10 w-10" />
              <div class="text-center">
                <p class="text-lg">
                  No users found
                </p>
                <p class="text-dimmed">
                  Create your first user to get started
                </p>
              </div>
            </div>
          </div>

          <div v-else>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div
                v-for="user in users"
                :key="user.id"
                class="flex items-center gap-3 p-4 rounded-lg border border-default bg-muted"
              >
                <img
                  :src="user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=${(user.color || '#06b6d4').replace('#', '')}&color=374151&size=96`"
                  class="w-10 h-10 rounded-full object-cover border border-muted"
                  :alt="user.name"
                >
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-highlighted truncate">
                    {{ user.name }}
                  </p>
                  <p v-if="user.email" class="text-sm text-muted truncate">
                    {{ user.email }}
                  </p>
                  <p v-else class="text-sm text-muted">
                    No email
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <UButton
                    variant="ghost"
                    size="sm"
                    icon="i-lucide-edit"
                    :aria-label="`Edit ${user.name}`"
                    @click="openUserDialog(user)"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-default rounded-lg shadow-sm border border-default p-6 mb-6">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h2 class="text-lg font-semibold text-highlighted">
                Integrations
              </h2>
            </div>
            <UButton
              icon="i-lucide-plug"
              @click="openIntegrationDialog()"
            >
              Add Integration
            </UButton>
          </div>

          <div class="border-b border-default mb-6">
            <nav class="-mb-px flex space-x-8">
              <button
                v-for="type in availableIntegrationTypes"
                :key="type"
                type="button"
                class="whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm"
                :class="[
                  activeIntegrationTab === type
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted hover:text-toned hover:border-muted',
                ]"
                @click="activeIntegrationTab = type"
              >
                {{ getIntegrationTypeLabel(type) }}
              </button>
            </nav>
          </div>

          <div v-if="integrationsLoading" class="text-center py-8">
            <UIcon name="i-lucide-loader-2" class="animate-spin h-8 w-8 mx-auto" />
            <p class="text-default mt-2">
              Loading integrations...
            </p>
          </div>

          <div v-else-if="servicesInitializing" class="text-center py-8">
            <UIcon name="i-lucide-loader-2" class="animate-spin h-8 w-8 mx-auto" />
            <p class="text-default mt-2">
              Initializing integration services...
            </p>
          </div>

          <div v-else-if="filteredIntegrations.length === 0" class="text-center py-8">
            <div class="flex items-center justify-center gap-2 text-default">
              <UIcon name="i-lucide-frown" class="h-10 w-10" />
              <div class="text-center">
                <p class="text-lg">
                  No {{ getIntegrationTypeLabel(activeIntegrationTab) }} integrations configured
                </p>
                <p class="text-dimmed">
                  Connect external services to enhance your experience
                </p>
              </div>
            </div>
          </div>

          <div v-else>
            <div class="space-y-4">
              <div
                v-for="integration in filteredIntegrations"
                :key="integration.id"
                class="flex items-center justify-between p-4 rounded-lg border"
                :class="[
                  integration.enabled
                    ? 'border-primary bg-primary/10'
                    : 'border-default bg-default',
                ]"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="w-10 h-10 rounded-full flex items-center justify-center text-inverted"
                    :class="[
                      integration.enabled
                        ? 'bg-accented'
                        : 'bg-muted',
                    ]"
                  >
                    <img
                      v-if="getIntegrationIconUrl(integration)"
                      :src="getIntegrationIconUrl(integration) || undefined"
                      :alt="`${integration.service} icon`"
                      class="h-5 w-5"
                      style="object-fit: contain"
                    >
                    <UIcon
                      v-else
                      :name="getIntegrationIcon(integration.type)"
                      class="h-5 w-5"
                    />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <p class="font-medium text-highlighted">
                        {{ integration.name }}
                      </p>
                      <UBadge
                        v-if="integrationNeedsReauth(integration)"
                        color="warning"
                        variant="soft"
                        size="sm"
                      >
                        <UIcon name="i-lucide-alert-triangle" class="h-4 w-4 mr-1" />
                        Re-auth Required!
                      </UBadge>
                    </div>
                    <p class="text-sm text-muted capitalize">
                      {{ integration.service }}
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <USwitch
                    :model-value="integration.enabled"
                    color="primary"
                    unchecked-icon="i-lucide-x"
                    checked-icon="i-lucide-check"
                    size="xl"
                    :aria-label="`Toggle ${integration.name} integration`"
                    @update:model-value="handleToggleIntegration(integration.id, $event)"
                  />
                  <UButton
                    variant="ghost"
                    size="sm"
                    icon="i-lucide-edit"
                    :aria-label="`Edit ${integration.name}`"
                    @click="openIntegrationDialog(integration)"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-default rounded-lg shadow-sm border border-default p-6 mb-6">
          <h2 class="text-lg font-semibold text-highlighted mb-4">
            Application Settings
          </h2>
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium text-highlighted">
                  Dark Mode
                </p>
                <p class="text-sm text-muted">
                  Toggle between light and dark themes (Coming Soon™)
                </p>
              </div>
              <USwitch
                v-model="isDark"
                color="primary"
                checked-icon="i-lucide-moon"
                unchecked-icon="i-lucide-sun"
                size="xl"
                aria-label="Toggle dark mode"
              />
            </div>
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium text-highlighted">
                  Show Meals on Calendar
                </p>
                <p class="text-sm text-muted">
                  Display meals from meal planner on the calendar view
                </p>
              </div>
              <USwitch
                v-model="showMeals"
                color="primary"
                checked-icon="i-lucide-utensils"
                unchecked-icon="i-lucide-x"
                size="xl"
                aria-label="Toggle meal display on calendar"
              />
            </div>
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium text-highlighted">
                  Notifications
                </p>
                <p class="text-sm text-muted">
                  Enable push notifications (Coming Soon™)
                </p>
              </div>
              <USwitch
                color="primary"
                checked-icon="i-lucide-alarm-clock-check"
                unchecked-icon="i-lucide-alarm-clock-off"
                size="xl"
                aria-label="Toggle notifications"
              />
            </div>
          </div>
        </div>

        <div class="bg-default rounded-lg shadow-sm border border-default p-6 mb-6">
          <h2 class="text-lg font-semibold text-highlighted mb-4">
            Home Page
          </h2>
          <div class="space-y-4">
            <!-- Enable Photos -->
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium text-highlighted">
                  Photo Slideshow
                </p>
                <p class="text-sm text-muted">
                  Display photos from Google Photos
                </p>
              </div>
              <USwitch
                :model-value="homeSettings?.photosEnabled ?? true"
                color="primary"
                checked-icon="i-lucide-image"
                unchecked-icon="i-lucide-x"
                size="xl"
                aria-label="Toggle photo slideshow"
                @update:model-value="updateHomeSettingsComposable({ photosEnabled: $event })"
              />
            </div>

            <!-- Transition Speed -->
            <div v-if="homeSettings?.photosEnabled" class="space-y-2">
              <div class="flex items-center justify-between">
                <label class="text-sm font-medium text-highlighted">Transition Speed</label>
                <span class="text-sm text-muted">{{ (homeSettings?.photoTransitionSpeed ?? 10000) / 1000 }}s</span>
              </div>
              <input
                type="range"
                :value="homeSettings?.photoTransitionSpeed ?? 10000"
                min="5000"
                max="60000"
                step="5000"
                class="w-full"
                @change="updateHomeSettingsComposable({ photoTransitionSpeed: Number(($event.target as HTMLInputElement).value) })"
              >
              <p class="text-xs text-muted">
                Time between photo transitions (5-60 seconds)
              </p>
            </div>

            <!-- Ken Burns Intensity -->
            <div v-if="homeSettings?.photosEnabled" class="space-y-2">
              <div class="flex items-center justify-between">
                <label class="text-sm font-medium text-highlighted">Ken Burns Effect</label>
                <span class="text-sm text-muted">{{ homeSettings?.kenBurnsIntensity ?? 1.0 }}x</span>
              </div>
              <input
                type="range"
                :value="homeSettings?.kenBurnsIntensity ?? 1.0"
                min="0"
                max="2"
                step="0.1"
                class="w-full"
                @change="updateHomeSettingsComposable({ kenBurnsIntensity: Number(($event.target as HTMLInputElement).value) })"
              >
              <p class="text-xs text-muted">
                Zoom and pan effect strength (0 = off, 2 = maximum)
              </p>
            </div>

            <!-- Photo Playback Mode -->
            <div v-if="homeSettings?.photosEnabled" class="space-y-2">
              <label class="text-sm font-medium text-highlighted">Photo Playback</label>
              <select
                :value="homeSettings?.photoPlayback ?? 'sequential'"
                class="w-full px-3 py-2 bg-muted border border-default rounded-md text-highlighted"
                @change="updateHomeSettingsComposable({ photoPlayback: ($event.target as HTMLSelectElement).value })"
              >
                <option value="sequential">
                  Sequential
                </option>
                <option value="random">
                  Random
                </option>
              </select>
              <p class="text-xs text-muted">
                Sequential plays photos in order, Random shuffles them
              </p>
            </div>

            <!-- Album Selection -->
            <div v-if="homeSettings?.photosEnabled" class="space-y-3 pt-4 border-t border-muted">
              <div class="flex items-center justify-between">
                <div>
                  <label class="text-sm font-medium text-highlighted">Selected Photos</label>
                  <p v-if="selectedAlbums.length > 0" class="text-xs text-muted mt-1">
                    {{ selectedAlbums.length }} photo{{ selectedAlbums.length !== 1 ? 's' : '' }} total
                    <span v-if="selectedPhotoIds.size > 0" class="text-primary">
                      • {{ selectedPhotoIds.size }} selected
                    </span>
                  </p>
                </div>
                <div class="flex gap-2">
                  <UButton
                    v-if="selectedPhotoIds.size > 0"
                    size="sm"
                    color="error"
                    icon="i-lucide-trash-2"
                    @click="handleBulkDeletePhotos"
                  >
                    Delete ({{ selectedPhotoIds.size }})
                  </UButton>
                  <UButton
                    size="sm"
                    icon="i-lucide-plus"
                    @click="handleOpenPhotosPicker"
                  >
                    Add Photos
                  </UButton>
                </div>
              </div>

              <!-- Selected Photos List -->
              <div v-if="selectedAlbums.length > 0" class="space-y-3">
                <!-- Bulk actions toolbar -->
                <div class="flex items-center justify-between p-2 bg-muted/50 rounded-lg border border-default">
                  <div class="flex items-center gap-3">
                    <label class="flex items-center gap-2 cursor-pointer">
                      <input
                        v-model="selectAllPhotos"
                        type="checkbox"
                        class="w-4 h-4 rounded border-default"
                        @change="toggleSelectAllOnPage"
                      >
                      <span class="text-sm text-highlighted">Select all on page</span>
                    </label>
                  </div>
                  <UButton
                    v-if="selectedAlbums.length > 0"
                    size="xs"
                    variant="ghost"
                    color="error"
                    @click="handleDeleteAllPhotos"
                  >
                    Delete All {{ selectedAlbums.length }} Photos
                  </UButton>
                </div>

                <!-- Photo grid -->
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  <div
                    v-for="album in paginatedPhotos"
                    :key="album.id"
                    class="relative group"
                  >
                    <div
                      class="relative rounded-lg border overflow-hidden cursor-pointer"
                      :class="[
                        selectedPhotoIds.has(album.id)
                          ? 'border-primary ring-2 ring-primary'
                          : 'border-default hover:border-primary',
                      ]"
                      @click="togglePhotoSelection(album.id)"
                    >
                      <!-- Checkbox overlay -->
                      <div class="absolute top-2 left-2 z-10">
                        <div
                          class="w-5 h-5 rounded border-2 flex items-center justify-center"
                          :class="[
                            selectedPhotoIds.has(album.id)
                              ? 'bg-primary border-primary'
                              : 'bg-white/80 border-white/80 group-hover:bg-white',
                          ]"
                        >
                          <UIcon
                            v-if="selectedPhotoIds.has(album.id)"
                            name="i-lucide-check"
                            class="w-3 h-3 text-white"
                          />
                        </div>
                      </div>

                      <!-- Photo -->
                      <img
                        v-if="album.coverPhotoUrl"
                        :src="`/api/integrations/google_photos/proxy-image?photoId=${encodeURIComponent(album.albumId)}&width=400&height=400`"
                        class="w-full h-32 object-cover"
                        :alt="album.title"
                        loading="lazy"
                      >
                      <div v-else class="w-full h-32 bg-muted flex items-center justify-center">
                        <UIcon name="i-lucide-image" class="w-8 h-8 text-muted" />
                      </div>

                      <!-- Title overlay on hover -->
                      <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p class="text-xs text-white truncate">
                          {{ album.title }}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Pagination -->
                <div v-if="totalPages > 1" class="flex items-center justify-between pt-3 border-t border-muted">
                  <p class="text-sm text-muted">
                    Page {{ currentPage }} of {{ totalPages }}
                  </p>
                  <div class="flex gap-2">
                    <UButton
                      size="sm"
                      variant="ghost"
                      icon="i-lucide-chevron-left"
                      :disabled="currentPage === 1"
                      @click="currentPage--"
                    />
                    <UButton
                      size="sm"
                      variant="ghost"
                      icon="i-lucide-chevron-right"
                      :disabled="currentPage === totalPages"
                      @click="currentPage++"
                    />
                  </div>
                </div>
              </div>

              <div v-else class="text-sm text-muted p-3 bg-muted rounded-lg border border-default">
                No photos selected. Click "Add Photos" to choose from your Google Photos.
              </div>
            </div>

            <!-- Weather Settings -->
            <div class="pt-4 border-t border-muted">
              <div class="flex items-center justify-between mb-4">
                <div>
                  <p class="font-medium text-highlighted">
                    Weather Widget
                  </p>
                  <p class="text-sm text-muted">
                    Show current weather conditions
                  </p>
                </div>
                <USwitch
                  :model-value="homeSettings?.weatherEnabled ?? true"
                  color="primary"
                  checked-icon="i-lucide-cloud"
                  unchecked-icon="i-lucide-x"
                  size="xl"
                  aria-label="Toggle weather widget"
                  @update:model-value="updateHomeSettingsComposable({ weatherEnabled: $event })"
                />
              </div>

              <div v-if="homeSettings?.weatherEnabled" class="space-y-3 pl-4">
                <div>
                  <label class="text-sm font-medium text-highlighted">Latitude</label>
                  <input
                    type="number"
                    :value="homeSettings?.latitude ?? ''"
                    step="0.0001"
                    placeholder="41.8781"
                    class="w-full mt-1 px-3 py-2 bg-muted border border-default rounded-md text-highlighted"
                    @blur="updateHomeSettingsComposable({ latitude: Number(($event.target as HTMLInputElement).value) })"
                  >
                </div>
                <div>
                  <label class="text-sm font-medium text-highlighted">Longitude</label>
                  <input
                    type="number"
                    :value="homeSettings?.longitude ?? ''"
                    step="0.0001"
                    placeholder="-87.6298"
                    class="w-full mt-1 px-3 py-2 bg-muted border border-default rounded-md text-highlighted"
                    @blur="updateHomeSettingsComposable({ longitude: Number(($event.target as HTMLInputElement).value) })"
                  >
                </div>
                <div>
                  <label class="text-sm font-medium text-highlighted">Temperature Unit</label>
                  <select
                    :value="homeSettings?.temperatureUnit ?? 'celsius'"
                    class="w-full mt-1 px-3 py-2 bg-muted border border-default rounded-md text-highlighted"
                    @change="updateHomeSettingsComposable({ temperatureUnit: ($event.target as HTMLSelectElement).value })"
                  >
                    <option value="celsius">
                      Celsius (°C)
                    </option>
                    <option value="fahrenheit">
                      Fahrenheit (°F)
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Data Refresh Interval -->
            <div class="pt-4 border-t border-muted space-y-3">
              <div>
                <p class="font-medium text-highlighted">
                  Data Refresh Interval
                </p>
                <p class="text-sm text-muted">
                  How often widgets fetch new data (weather, events, tasks, meals)
                </p>
              </div>
              <div class="space-y-2 pl-4">
                <div class="flex items-center justify-between">
                  <label class="text-sm font-medium text-highlighted">Refresh Every</label>
                  <span class="text-sm text-muted">{{ homeSettings?.refreshInterval ?? 6.0 }} hour{{ (homeSettings?.refreshInterval ?? 6.0) !== 1 ? 's' : '' }}</span>
                </div>
                <input
                  type="range"
                  :value="homeSettings?.refreshInterval ?? 6.0"
                  min="1"
                  max="12"
                  step="1"
                  class="w-full"
                  @input="updateHomeSettingsComposable({ refreshInterval: Number(($event.target as HTMLInputElement).value) })"
                >
                <p class="text-xs text-muted">
                  Choose between 1 and 12 hours
                </p>
              </div>
            </div>

            <!-- Widget Visibility -->
            <div class="pt-4 border-t border-muted">
              <h3 class="text-sm font-medium text-highlighted mb-3">
                Visible Widgets
              </h3>
              <div class="space-y-2 pl-4">
                <div class="flex items-center justify-between">
                  <label class="text-sm text-highlighted">Clock</label>
                  <USwitch
                    :model-value="homeSettings?.clockEnabled ?? true"
                    color="primary"
                    size="lg"
                    @update:model-value="updateHomeSettingsComposable({ clockEnabled: $event })"
                  />
                </div>
                <div class="flex items-center justify-between">
                  <label class="text-sm text-highlighted">Events</label>
                  <USwitch
                    :model-value="homeSettings?.eventsEnabled ?? true"
                    color="primary"
                    size="lg"
                    @update:model-value="updateHomeSettingsComposable({ eventsEnabled: $event })"
                  />
                </div>
                <div class="flex items-center justify-between">
                  <label class="text-sm text-highlighted">Todos</label>
                  <USwitch
                    :model-value="homeSettings?.todosEnabled ?? true"
                    color="primary"
                    size="lg"
                    @update:model-value="updateHomeSettingsComposable({ todosEnabled: $event })"
                  />
                </div>
                <div class="flex items-center justify-between">
                  <label class="text-sm text-highlighted">Meals</label>
                  <USwitch
                    :model-value="homeSettings?.mealsEnabled ?? true"
                    color="primary"
                    size="lg"
                    @update:model-value="updateHomeSettingsComposable({ mealsEnabled: $event })"
                  />
                </div>
                <div class="flex items-center justify-between">
                  <div class="flex flex-col">
                    <label class="text-sm text-highlighted">Countdown</label>
                    <span class="text-xs text-muted">Display the earliest countdown event on the home screen</span>
                  </div>
                  <USwitch
                    :model-value="homeSettings?.countdownEnabled ?? false"
                    color="primary"
                    size="lg"
                    @update:model-value="updateHomeSettingsComposable({ countdownEnabled: $event })"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-default rounded-lg shadow-sm border border-default p-6">
          <h2 class="text-lg font-semibold text-highlighted mb-4">
            About
          </h2>
          <div class="flex items-center gap-4 mb-6 p-4 bg-muted/30 rounded-lg border border-muted">
            <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <img
                v-if="logoLoaded"
                src="/skylite.svg"
                alt="SkyLite UX Logo"
                class="w-8 h-8"
                style="object-fit: contain"
                @error="logoLoaded = false"
              >
              <UIcon
                v-else
                name="i-lucide-sun"
                class="w-6 h-6 text-primary"
              />
            </div>
            <div class="flex-1">
              <div class="flex items-center justify-between mb-1">
                <h3 class="text-lg font-semibold text-highlighted">
                  SkyLite UX
                </h3>
                <span class="text-xs font-mono text-primary bg-primary/10 border border-primary/20 px-2 py-1 rounded-md">
                  v{{ $config.public.skyliteVersion }}
                </span>
              </div>
              <p class="text-sm text-muted">
                {{ getSlogan() }}
              </p>
            </div>
          </div>
          <div v-if="databaseInfo" class="mt-4 p-3 bg-muted/20 rounded-lg border border-muted">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full flex items-center justify-center" :class="databaseInfo.provider === 'sqlite' ? 'bg-green-500/10' : 'bg-blue-500/10'">
                <UIcon
                  :name="databaseInfo.provider === 'sqlite' ? 'i-lucide-database' : 'i-lucide-server'"
                  :class="databaseInfo.provider === 'sqlite' ? 'text-green-600' : 'text-blue-600'"
                  class="w-4 h-4"
                />
              </div>
              <div class="flex-1">
                <p class="text-sm font-medium text-highlighted">
                  Database: {{ databaseInfo.displayName }}
                </p>
                <p class="text-xs text-muted font-mono">
                  {{ databaseInfo.location }}
                </p>
              </div>
            </div>
          </div>

          <div class="mt-6 pt-4 border-t border-muted">
            <p class="text-xs text-muted text-center">
              Built with ❤️ by the community using Nuxt {{ $config.public.nuxtVersion.replace("^", "") }} & Nuxt UI {{ $config.public.nuxtUiVersion.replace("^", "") }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <SettingsUserDialog
      :user="selectedUser"
      :is-open="isUserDialogOpen"
      @close="isUserDialogOpen = false"
      @save="handleUserSave"
      @delete="handleUserDelete"
    />

    <SettingsIntegrationDialog
      :integration="selectedIntegration"
      :is-open="isIntegrationDialogOpen"
      :active-type="activeIntegrationTab"
      :existing-integrations="integrations as Integration[]"
      :connection-test-result="connectionTestResult"
      @close="() => { isIntegrationDialogOpen = false; selectedIntegration = null; }"
      @save="handleIntegrationSave"
      @delete="handleIntegrationDelete"
      @select-calendars="handleSelectCalendars"
    />

    <SettingsCalendarSelectDialog
      :integration="calendarSelectIntegration"
      :is-open="isCalendarSelectDialogOpen"
      @close="isCalendarSelectDialogOpen = false; calendarSelectIntegration = null"
      @save="handleCalendarsSaved"
      @calendars-disabled="handleCalendarsDisabled"
    />
  </div>
</template>
