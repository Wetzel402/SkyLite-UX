<script setup lang="ts">
import { consola } from "consola";

import type { CreateIntegrationInput, CreateUserInput, Integration, User } from "~/types/database";
import type { IntegrationStatus } from "~/types/integrations";
import type { ConnectionTestResult } from "~/types/ui";

import SettingsIntegrationDialog from "~/components/settings/settingsIntegrationDialog.vue";
import SettingsPinDialog from "~/components/settings/settingsPinDialog.vue";
import SettingsUserDialog from "~/components/settings/settingsUserDialog.vue";
import { useAlertToast } from "~/composables/useAlertToast";
import { integrationServices } from "~/plugins/02.appInit";
import { getSlogan } from "~/types/global";
import { createIntegrationService, integrationRegistry } from "~/types/integrations";

const { showError, showSuccess } = useAlertToast();

// Integration status tracking
const integrationStatuses = ref<Map<string, IntegrationStatus>>(new Map());
const statusLoading = ref<Set<string>>(new Set());

async function fetchIntegrationStatus(integrationId: string) {
  const service = integrationServices.get(integrationId);
  if (!service) {
    // Not enabled or service not available
    integrationStatuses.value.delete(integrationId);
    return;
  }

  statusLoading.value.add(integrationId);
  try {
    const status = await service.getStatus();
    integrationStatuses.value.set(integrationId, status);
  }
  catch (err) {
    consola.warn(`Settings: Failed to get status for integration ${integrationId}:`, err);
    integrationStatuses.value.set(integrationId, {
      isConnected: false,
      lastChecked: new Date(),
      error: "Failed to check status",
    });
  }
  finally {
    statusLoading.value.delete(integrationId);
  }
}

function getIntegrationStatus(integrationId: string): IntegrationStatus | null {
  return integrationStatuses.value.get(integrationId) || null;
}

function isStatusLoading(integrationId: string): boolean {
  return statusLoading.value.has(integrationId);
}
const { users, loading, error, createUser, deleteUser, updateUser } = useUsers();

// Logo loading state
const logoLoaded = ref(true);
const { integrations, loading: integrationsLoading, servicesInitializing, createIntegration, updateIntegration, deleteIntegration } = useIntegrations();
const { checkIntegrationCache, purgeIntegrationCache, triggerImmediateSync } = useSyncManager();

const colorMode = useColorMode();
const isDark = computed({
  get() {
    return colorMode.value === "dark";
  },
  set() {
    colorMode.preference = colorMode.value === "dark" ? "light" : "dark";
  },
});

onMounted(() => {
  if (!colorMode.value) {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    colorMode.preference = prefersDark ? "dark" : "light";
  }
});

const selectedUser = ref<User | null>(null);
const isUserDialogOpen = ref(false);
const selectedIntegration = ref<Integration | null>(null);
const isIntegrationDialogOpen = ref(false);

const connectionTestResult = ref<ConnectionTestResult>(null);

// PIN protection for integrations section
const isPinDialogOpen = ref(false);
const isIntegrationsSectionUnlocked = ref(false);

// Check if parent PIN is set on mount
const householdSettings = ref<any>(null);

// Check if parent PIN is set on mount
onMounted(async () => {
  try {
    const settings = await $fetch<any>("/api/household/settings");
    householdSettings.value = settings;
    // Check if there are any PARENT users
    // Actually best to rely on fetching fresh list or assuming `users` composable is source of truth.
    // The `useUsers` composable is already used in script.

    // We'll rely on the `users` computed property from `useUsers`.
    // Wait for users to load? `useUsers` fetches on mount usually if not called.
    // Let's just set unlocked to false by default.
    isIntegrationsSectionUnlocked.value = false;

    // We can auto-unlock if there are NO parent users (first install scenario?)
    // But index.post.ts forces first user to be PARENT.
    // So if there are users, there should be a parent.
  }
  catch (err) {
    consola.warn("Settings: Failed to check household settings:", err);
    isIntegrationsSectionUnlocked.value = true;
  }
});

// Watch users to determine locking state?
// If no users exist, unlock.
watch(users, (newUsers) => {
  if (newUsers.length === 0) {
    isIntegrationsSectionUnlocked.value = true;
  }
  else {
    // If locked and we have users, ensure it stays locked until verified.
    // But if we just created the first user, maybe we should auto-unlock?
    // For safety, default to locked if users exist.
  }
}, { immediate: true });

function handleUnlockIntegrations() {
  if (users.value.length > 0 && !isIntegrationsSectionUnlocked.value) {
    isPinDialogOpen.value = true;
  }
  else {
    isIntegrationsSectionUnlocked.value = true;
  }
}

function handlePinVerified() {
  isIntegrationsSectionUnlocked.value = true;
}

// Fetch integration statuses when section is unlocked
watch(isIntegrationsSectionUnlocked, async (unlocked) => {
  if (unlocked) {
    // Fetch status for all enabled integrations
    for (const integration of integrations.value as Integration[]) {
      if (integration.enabled) {
        fetchIntegrationStatus(integration.id);
      }
    }
  }
}, { immediate: true });

// Also refresh statuses when integrations change
watch(() => (integrations.value as Integration[]).filter(i => i.enabled).map(i => i.id), (enabledIds) => {
  if (isIntegrationsSectionUnlocked.value) {
    for (const id of enabledIds) {
      if (!integrationStatuses.value.has(id)) {
        fetchIntegrationStatus(id);
      }
    }
  }
}, { deep: true });

const activeIntegrationTab = ref<string>("");

const availableIntegrationTypes = computed(() => {
  const types = new Set<string>();
  integrationRegistry.forEach(config => types.add(config.type));
  return Array.from(types);
});

onMounted(() => {
  if (availableIntegrationTypes.value.length > 0) {
    activeIntegrationTab.value = availableIntegrationTypes.value[0] || "";
  }
});

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
        showSuccess("User Updated", "User profile has been updated successfully");
      }
      catch (err) {
        if (cachedUsers.value && previousUsers.length > 0) {
          cachedUsers.value.splice(0, cachedUsers.value.length, ...previousUsers);
        }
        throw err;
      }
    }
    else {
      await createUser(userData);
      consola.debug("Settings: User created successfully");
      showSuccess("User Created", "New user has been created successfully");
    }

    isUserDialogOpen.value = false;
    selectedUser.value = null;

    // Trigger explicit sync for calendar integrations to update user-event mapping
    const calendarIntegrations = (integrations.value as Integration[] || []).filter(i => i.type === "calendar" && i.enabled);
    for (const integration of calendarIntegrations) {
      if (integration.service === "google-calendar") {
        consola.debug(`Settings: Triggering sync for integration ${integration.id} to update user colors`);
        triggerImmediateSync("calendar", integration.id).catch((err) => {
          consola.warn(`Settings: Failed to trigger sync for ${integration.id}:`, err);
        });
      }
    }
  }
  catch (err) {
    consola.error("Settings: Failed to save user:", err);
    const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
    showError("Failed to Save User", errorMessage);
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
      showSuccess("User Deleted", "User has been removed successfully");
    }
    catch (err) {
      if (cachedUsers.value && previousUsers.length > 0) {
        cachedUsers.value.splice(0, cachedUsers.value.length, ...previousUsers);
      }
      throw err;
    }

    isUserDialogOpen.value = false;
    selectedUser.value = null;
  }
  catch (err) {
    consola.error("Settings: Failed to delete user:", err);
    const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
    showError("Failed to Delete User", errorMessage);
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

    setTimeout(() => {
      isIntegrationDialogOpen.value = false;
      selectedIntegration.value = null;
      connectionTestResult.value = null;
    }, 1500);
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
      showSuccess("Integration Deleted", "Integration has been removed successfully");
    }
    catch (err) {
      if (cachedIntegrations.value && previousIntegrations.length > 0) {
        cachedIntegrations.value.splice(0, cachedIntegrations.value.length, ...previousIntegrations);
      }
      throw err;
    }

    await refreshNuxtData("integrations");

    const { refreshIntegrations } = useIntegrations();
    await refreshIntegrations();

    isIntegrationDialogOpen.value = false;
    selectedIntegration.value = null;
  }
  catch (err) {
    consola.error("Settings: Failed to delete integration:", err);
    const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
    showError("Failed to Delete Integration", errorMessage);
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
  catch (err) {
    consola.error("Settings: Failed to toggle integration:", err);
    const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
    showError("Failed to Toggle Integration", errorMessage);
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

// Logic for Household Calendars
const availableCalendars = computed(() => {
  const calendars: { label: string; value: string; color?: string }[] = [];

  if (!integrations.value)
    return calendars;

  for (const integration of integrations.value) {
    if (integration.service === "google-calendar" && integration.enabled && integration.settings) {
      // Robustly handle settings
      let settings: unknown = integration.settings;
      if (typeof settings === "string") {
        try {
          settings = JSON.parse(settings);
        }
        catch (e) {
          console.error(e);
          continue;
        }
      }

      if (!settings || typeof settings !== "object")
        continue;

      const metadata = (settings as any).calendarMetadata || {};
      const selectedIds = Array.isArray((settings as any).selectedCalendars)
        ? (settings as any).selectedCalendars
        : [];

      for (const calId of selectedIds) {
        const meta = metadata[calId];
        calendars.push({
          label: meta?.summary || "Unknown Calendar",
          value: `${integration.id}:${calId}`,
          color: meta?.color,
        });
      }
    }
  }
  return calendars;
});

function getLinkedCalendarsByType(type: "HOLIDAY" | "FAMILY"): string[] {
  if (!householdSettings.value?.linkedCalendars)
    return [];

  // Clean up old string format if any (backward compatibility safety)
  if (!Array.isArray(householdSettings.value.linkedCalendars))
    return [];

  return householdSettings.value.linkedCalendars
    .filter((l: any) => l.type === type)
    .map((l: any) => `${l.integrationId}:${l.calendarId}`);
}

async function toggleHouseholdCalendar(type: "HOLIDAY" | "FAMILY", value: string, checked: boolean) {
  if (!householdSettings.value)
    return;

  const [integrationId, calendarId] = value.split(":");
  let currentLinks = Array.isArray(householdSettings.value.linkedCalendars) ? [...householdSettings.value.linkedCalendars] : [];

  if (checked) {
    // Check if already exists (shouldn't if UI is correct but safety first)
    const exists = currentLinks.some((l: any) => l.type === type && l.integrationId === integrationId && l.calendarId === calendarId);
    if (!exists) {
      currentLinks.push({ type, integrationId, calendarId });
    }
  }
  else {
    currentLinks = currentLinks.filter((l: any) => !(l.type === type && l.integrationId === integrationId && l.calendarId === calendarId));
  }

  // Update local state immediately for UI
  householdSettings.value.linkedCalendars = currentLinks;

  // Persist to server
  try {
    await $fetch("/api/household/settings", {
      method: "PUT",
      body: { linkedCalendars: currentLinks },
    });

    // Trigger Sync to update event tags
    // Retrieve ALL engaged calendar integrations to be safe
    const calendarIntegrations = (integrations.value as Integration[]).filter(i => i.type === "calendar" && i.enabled);
    calendarIntegrations.forEach(i => triggerImmediateSync("calendar", i.id));
  }
  catch (err) {
    console.error("Failed to update household calendars", err);
    showError("Failed to Save", "Could not update calendar settings.");
  }
}

const linkedHolidayCalendars = computed(() => getLinkedCalendarsByType("HOLIDAY"));
const linkedFamilyCalendars = computed(() => getLinkedCalendarsByType("FAMILY"));

async function updateHouseholdColor(type: "HOLIDAY" | "FAMILY", color: string) {
  if (!householdSettings.value)
    return;

  if (type === "HOLIDAY")
    householdSettings.value.holidayColor = color;
  if (type === "FAMILY")
    householdSettings.value.familyColor = color;

  try {
    await $fetch("/api/household/settings", {
      method: "PUT",
      body: {
        holidayColor: householdSettings.value.holidayColor,
        familyColor: householdSettings.value.familyColor,
      },
    });

    // Trigger Sync to update event tags
    const calendarIntegrations = (integrations.value as Integration[]).filter(i => i.type === "calendar" && i.enabled);
    calendarIntegrations.forEach(i => triggerImmediateSync("calendar", i.id));
  }
  catch (err) {
    console.error("Failed to update household colors", err);
    showError("Failed to Save", "Could not update color settings.");
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
            <div class="flex items-center gap-2">
              <h2 class="text-lg font-semibold text-highlighted">
                Integrations
              </h2>
              <UIcon
                v-if="users.length > 0 && !isIntegrationsSectionUnlocked"
                name="i-lucide-lock"
                class="h-4 w-4 text-muted"
              />
            </div>
            <UButton
              v-if="isIntegrationsSectionUnlocked"
              icon="i-lucide-plug"
              @click="openIntegrationDialog()"
            >
              Add Integration
            </UButton>
            <UButton
              v-else-if="users.length > 0"
              icon="i-lucide-lock"
              variant="outline"
              @click="handleUnlockIntegrations"
            >
              Unlock
            </UButton>
          </div>

          <!-- Locked state -->
          <div v-if="users.length > 0 && !isIntegrationsSectionUnlocked" class="text-center py-12">
            <div class="flex flex-col items-center gap-4">
              <div class="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
                <UIcon name="i-lucide-lock" class="h-8 w-8 text-muted" />
              </div>
              <div class="text-center">
                <p class="text-lg font-medium text-highlighted">
                  Access Restricted
                </p>
                <p class="text-muted mt-1">
                  Select an adult user to unlock integration settings
                </p>
              </div>
              <UButton
                icon="i-lucide-key"
                @click="handleUnlockIntegrations"
              >
                Enter PIN
              </UButton>
            </div>
          </div>

          <!-- Unlocked content -->
          <template v-else>
            <div class="border-b border-default mb-6">
              <nav class="-mb-px flex space-x-8" aria-label="Integration categories">
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
                      <p class="font-medium text-highlighted">
                        {{ integration.name }}
                      </p>
                      <p class="text-sm text-muted capitalize">
                        {{ integration.service }}
                      </p>
                      <!-- Connection status indicator -->
                      <div v-if="integration.enabled" class="flex items-center gap-1 mt-1">
                        <template v-if="isStatusLoading(integration.id)">
                          <UIcon name="i-lucide-loader-2" class="h-3 w-3 animate-spin text-muted" />
                          <span class="text-xs text-muted">Checking...</span>
                        </template>
                        <template v-else-if="getIntegrationStatus(integration.id)">
                          <template v-if="getIntegrationStatus(integration.id)?.isConnected">
                            <span class="inline-block w-2 h-2 rounded-full bg-success" />
                            <span class="text-xs text-success">Connected</span>
                          </template>
                          <template v-else-if="getIntegrationStatus(integration.id)?.error">
                            <span class="inline-block w-2 h-2 rounded-full bg-error" />
                            <span class="text-xs text-error truncate max-w-[150px]" :title="getIntegrationStatus(integration.id)?.error">
                              {{ getIntegrationStatus(integration.id)?.error }}
                            </span>
                          </template>
                          <template v-else>
                            <span class="inline-block w-2 h-2 rounded-full bg-warning" />
                            <span class="text-xs text-warning">Disconnected</span>
                          </template>
                        </template>
                      </div>
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
          </template>
        </div>

        <div class="bg-default rounded-lg shadow-sm border border-default p-6 mb-6">
          <h2 class="text-lg font-semibold text-highlighted mb-4">
            Household Calendars
          </h2>
          <div v-if="availableCalendars.length === 0" class="text-muted text-sm italic">
            No calendars available. Please configure a Calendar integration first.
          </div>
          <div v-else class="space-y-6">
            <!-- Holiday Calendars -->
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <div>
                  <label class="block text-sm font-medium text-highlighted">Holiday Calendars</label>
                  <p class="text-xs text-muted mb-2">
                    Events from these calendars will be tagged as Holidays.
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-muted">Color</span>
                  <input
                    type="color"
                    :value="householdSettings?.holidayColor || '#ef4444'"
                    class="h-6 w-8 p-0 border border-default rounded cursor-pointer bg-transparent"
                    aria-label="Holiday Calendar Color"
                    @change="(e) => updateHouseholdColor('HOLIDAY', (e.target as HTMLInputElement).value)"
                  >
                </div>
              </div>
              <div class="space-y-1 max-h-48 overflow-y-auto border border-default rounded-md p-2">
                <div
                  v-for="cal in availableCalendars"
                  :key="`holiday-${cal.value}`"
                  class="flex items-center gap-2"
                >
                  <UCheckbox
                    :model-value="linkedHolidayCalendars.includes(cal.value)"
                    :label="cal.label"
                    color="primary"
                    @update:model-value="(checked: any) => toggleHouseholdCalendar('HOLIDAY', cal.value, checked)"
                  />
                  <span
                    v-if="cal.color"
                    :style="{ backgroundColor: cal.color }"
                    class="size-2 rounded-full shrink-0"
                  />
                </div>
              </div>
            </div>

            <!-- Family Calendars -->
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <div>
                  <label class="block text-sm font-medium text-highlighted">Family Calendars</label>
                  <p class="text-xs text-muted mb-2">
                    Events from these calendars will be tagged as Family Events.
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-muted">Color</span>
                  <input
                    type="color"
                    :value="householdSettings?.familyColor || '#3b82f6'"
                    class="h-6 w-8 p-0 border border-default rounded cursor-pointer bg-transparent"
                    aria-label="Family Calendar Color"
                    @change="(e) => updateHouseholdColor('FAMILY', (e.target as HTMLInputElement).value)"
                  >
                </div>
              </div>
              <div class="space-y-1 max-h-48 overflow-y-auto border border-default rounded-md p-2">
                <div
                  v-for="cal in availableCalendars"
                  :key="`family-${cal.value}`"
                  class="flex items-center gap-2"
                >
                  <UCheckbox
                    :model-value="linkedFamilyCalendars.includes(cal.value)"
                    :label="cal.label"
                    color="primary"
                    @update:model-value="(checked: any) => toggleHouseholdCalendar('FAMILY', cal.value, checked)"
                  />
                  <span
                    v-if="cal.color"
                    :style="{ backgroundColor: cal.color }"
                    class="size-2 rounded-full shrink-0"
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
      :existing-integrations="integrations as Integration[]"
      :connection-test-result="connectionTestResult"
      @close="() => { isIntegrationDialogOpen = false; selectedIntegration = null; }"
      @open="isIntegrationDialogOpen = true"
      @save="handleIntegrationSave"
      @delete="handleIntegrationDelete"
    />

    <SettingsPinDialog
      :is-open="isPinDialogOpen"
      title="Access Integrations"
      @close="isPinDialogOpen = false"
      @verified="handlePinVerified"
    />
  </div>
</template>
