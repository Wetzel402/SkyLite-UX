<script setup lang="ts">
import { consola } from "consola";

import type {
  CreateIntegrationInput,
  CreateUserInput,
  Integration,
  User,
} from "~/types/database";
import type { ConnectionTestResult, FontPreference } from "~/types/ui";

import SettingsCalendarSelectDialog from "~/components/settings/settingsCalendarSelectDialog.vue";
import SettingsIntegrationDialog from "~/components/settings/settingsIntegrationDialog.vue";
import SettingsUserDialog from "~/components/settings/settingsUserDialog.vue";
import { useClientPreferences } from "~/composables/useClientPreferences";
import { integrationServices } from "~/plugins/02.appInit";
import { getSlogan } from "~/types/global";
import {
  createIntegrationService,
  integrationRegistry,
} from "~/types/integrations";
import { FONT_OPTIONS, getFontStack } from "~/types/ui";

const { users, loading, error, createUser, deleteUser, updateUser }
  = useUsers();

const logoLoaded = ref(true);
const {
  integrations,
  loading: integrationsLoading,
  servicesInitializing,
  createIntegration,
  updateIntegration,
  deleteIntegration,
} = useIntegrations();
const {
  checkIntegrationCache,
  purgeIntegrationCache,
  triggerImmediateSync,
  purgeCalendarEvents,
} = useSyncManager();

const { preferences, updatePreferences } = useClientPreferences();

const isClient = ref(false);
onMounted(() => {
  isClient.value = true;
});

const colorMode = useColorMode();
const effectiveDark = computed(() => {
  if (!isClient.value)
    return false;
  return colorMode.value === "dark";
});

const isDark = computed({
  get: () => effectiveDark.value,
  set(value: boolean) {
    updatePreferences({ colorMode: value ? "dark" : "light" });
  },
});

const notificationsEnabled = computed({
  get: () => preferences.value?.notifications ?? false,
  set(value: boolean) {
    updatePreferences({ notifications: value });
  },
});

const selectedFont = computed({
  get: () => preferences.value?.font ?? "system",
  set(value: FontPreference) {
    updatePreferences({ font: value });
  },
});

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
});

watch(
  () => route.query,
  (query) => {
    if (query.success === "google_calendar_added" && query.integrationId) {
      nextTick(() => {
        const allIntegrations = integrations.value as Integration[];
        const integration = allIntegrations.find(
          i => i.id === query.integrationId,
        );
        if (integration) {
          calendarSelectIntegration.value = integration;
          isCalendarSelectDialogOpen.value = true;
        }
      });
    }
  },
  { immediate: true },
);

const filteredIntegrations = computed(() => {
  return (integrations.value as Integration[]).filter(
    integration => integration.type === activeIntegrationTab.value,
  );
});

async function handleUserSave(userData: CreateUserInput) {
  try {
    if (selectedUser.value?.id) {
      const { data: cachedUsers } = useNuxtData("users");
      const previousUsers = cachedUsers.value ? [...cachedUsers.value] : [];

      if (cachedUsers.value && Array.isArray(cachedUsers.value)) {
        const userIndex = cachedUsers.value.findIndex(
          (u: User) => u.id === selectedUser.value!.id,
        );
        if (userIndex !== -1) {
          cachedUsers.value[userIndex] = {
            ...cachedUsers.value[userIndex],
            ...userData,
          };
        }
      }

      try {
        await updateUser(selectedUser.value.id, userData);
        consola.debug("Settings: User updated successfully");
      }
      catch (error) {
        if (cachedUsers.value && previousUsers.length > 0) {
          cachedUsers.value.splice(
            0,
            cachedUsers.value.length,
            ...previousUsers,
          );
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
      cachedUsers.value.splice(
        0,
        cachedUsers.value.length,
        ...cachedUsers.value.filter((u: User) => u.id !== userId),
      );
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
      const previousIntegrations = cachedIntegrations.value
        ? [...cachedIntegrations.value]
        : [];

      if (cachedIntegrations.value && Array.isArray(cachedIntegrations.value)) {
        const integrationIndex = cachedIntegrations.value.findIndex(
          (i: Integration) => i.id === selectedIntegration.value!.id,
        );
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
          cachedIntegrations.value.splice(
            0,
            cachedIntegrations.value.length,
            ...previousIntegrations,
          );
        }
        throw error;
      }
    }
    else {
      const { data: cachedIntegrations } = useNuxtData("integrations");
      const previousIntegrations = cachedIntegrations.value
        ? [...cachedIntegrations.value]
        : [];
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

        if (
          cachedIntegrations.value
          && Array.isArray(cachedIntegrations.value)
        ) {
          const tempIndex = cachedIntegrations.value.findIndex(
            (i: Integration) => i.id === newIntegration.id,
          );
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
          cachedIntegrations.value.splice(
            0,
            cachedIntegrations.value.length,
            ...previousIntegrations,
          );
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
      error:
        error instanceof Error ? error.message : "Failed to save integration",
      isLoading: false,
    };
  }
}

function handleSelectCalendars(integrationId: string) {
  const integration = (integrations.value as Integration[]).find(
    i => i.id === integrationId,
  );
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
    const previousIntegrations = cachedIntegrations.value
      ? [...cachedIntegrations.value]
      : [];

    if (cachedIntegrations.value && Array.isArray(cachedIntegrations.value)) {
      cachedIntegrations.value.splice(
        0,
        cachedIntegrations.value.length,
        ...cachedIntegrations.value.filter(
          (i: Integration) => i.id !== integrationId,
        ),
      );
    }

    try {
      await deleteIntegration(integrationId);
      consola.debug("Settings: Integration deleted successfully");
    }
    catch (error) {
      if (cachedIntegrations.value && previousIntegrations.length > 0) {
        cachedIntegrations.value.splice(
          0,
          cachedIntegrations.value.length,
          ...previousIntegrations,
        );
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
  if (
    !activeIntegrationTab.value
    && availableIntegrationTypes.value.length > 0
  ) {
    activeIntegrationTab.value = availableIntegrationTypes.value[0] || "";
  }

  selectedIntegration.value = integration;
  isIntegrationDialogOpen.value = true;
}

async function handleToggleIntegration(
  integrationId: string,
  enabled: boolean,
) {
  try {
    const integration = (integrations.value as Integration[]).find(
      (i: Integration) => i.id === integrationId,
    );
    if (!integration) {
      throw new Error("Integration not found");
    }

    const { data: cachedIntegrations } = useNuxtData("integrations");
    const previousIntegrations = cachedIntegrations.value
      ? [...cachedIntegrations.value]
      : [];

    if (cachedIntegrations.value && Array.isArray(cachedIntegrations.value)) {
      const integrationIndex = cachedIntegrations.value.findIndex(
        (i: Integration) => i.id === integrationId,
      );
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
            consola.warn(
              `Background service initialization failed for ${integration.name}:`,
              error,
            );
          });
        }
      }
      catch (serviceError) {
        consola.warn(
          `Failed to create integration service for ${integration.name}:`,
          serviceError,
        );
      }
    }
    else {
      try {
        integrationServices.delete(integrationId);
      }
      catch (serviceError) {
        consola.warn(
          `Failed to remove integration service for ${integration.name}:`,
          serviceError,
        );
      }
    }

    try {
      if (enabled) {
        await updateIntegration(integrationId, { enabled });

        const hasCache = checkIntegrationCache(integration.type, integrationId);

        if (!hasCache) {
          consola.debug(
            `Settings: No cache found for ${integration.type} integration ${integrationId}, triggering immediate sync`,
          );

          await triggerImmediateSync(integration.type, integrationId);
        }
      }
      else {
        await updateIntegration(integrationId, { enabled });

        purgeIntegrationCache(integration.type, integrationId);
        consola.debug(
          `Settings: Purged cache for disabled ${integration.type} integration ${integrationId}`,
        );
      }

      consola.debug(
        `Settings: Integration ${enabled ? "enabled" : "disabled"} successfully`,
      );
    }
    catch (error) {
      consola.warn(
        `Settings: Rolling back optimistic update for integration ${integrationId} due to error:`,
        error,
      );

      if (cachedIntegrations.value && previousIntegrations.length > 0) {
        cachedIntegrations.value.splice(
          0,
          cachedIntegrations.value.length,
          ...previousIntegrations,
        );
      }

      if (enabled) {
        try {
          integrationServices.delete(integrationId);
        }
        catch (rollbackError) {
          consola.warn(
            `Failed to rollback service creation for ${integration.name}:`,
            rollbackError,
          );
        }
      }
      else {
        try {
          const service = await createIntegrationService(integration);
          if (service) {
            integrationServices.set(integrationId, service);
            service.initialize().catch((error) => {
              consola.warn(
                `Background service initialization failed for ${integration.name}:`,
                error,
              );
            });
          }
        }
        catch (rollbackError) {
          consola.warn(
            `Failed to rollback service removal for ${integration.name}:`,
            rollbackError,
          );
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

  const config = integrationRegistry.get(
    `${integration.type}:${integration.service}`,
  );
  return config?.icon || null;
}

function integrationNeedsReauth(integration?: Integration | null): boolean {
  if (!integration)
    return false;
  const settings = integration.settings as
    | { needsReauth?: boolean }
    | undefined;
  return Boolean(settings?.needsReauth);
}
</script>

<template>
  <div class="flex w-full flex-col rounded-lg">
    <div
      class="py-5 sm:px-4 sticky top-0 z-40 bg-default border-b border-default"
    >
      <GlobalDateHeader />
    </div>

    <div class="flex-1 bg-default p-6">
      <div class="max-w-4xl mx-auto">
        <div
          class="bg-default rounded-lg shadow-sm border border-default p-6 mb-6"
        >
          <div class="flex items-center justify-between mb-6">
            <div>
              <h2 class="text-lg font-semibold text-highlighted">
                Users
              </h2>
            </div>
            <UButton icon="i-lucide-user-plus" @click="openUserDialog()">
              Add User
            </UButton>
          </div>

          <div v-if="loading" class="text-center py-8">
            <UIcon
              name="i-lucide-loader-2"
              class="animate-spin h-8 w-8 mx-auto"
            />
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
                  :src="
                    user.avatar
                      || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=${(user.color || '#06b6d4').replace('#', '')}&color=374151&size=96`
                  "
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

        <div
          class="bg-default rounded-lg shadow-sm border border-default p-6 mb-6"
        >
          <div class="flex items-center justify-between mb-6">
            <div>
              <h2 class="text-lg font-semibold text-highlighted">
                Integrations
              </h2>
            </div>
            <UButton icon="i-lucide-plug" @click="openIntegrationDialog()">
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
            <UIcon
              name="i-lucide-loader-2"
              class="animate-spin h-8 w-8 mx-auto"
            />
            <p class="text-default mt-2">
              Loading integrations...
            </p>
          </div>

          <div v-else-if="servicesInitializing" class="text-center py-8">
            <UIcon
              name="i-lucide-loader-2"
              class="animate-spin h-8 w-8 mx-auto"
            />
            <p class="text-default mt-2">
              Initializing integration services...
            </p>
          </div>

          <div
            v-else-if="filteredIntegrations.length === 0"
            class="text-center py-8"
          >
            <div class="flex items-center justify-center gap-2 text-default">
              <UIcon name="i-lucide-frown" class="h-10 w-10" />
              <div class="text-center">
                <p class="text-lg">
                  No
                  {{ getIntegrationTypeLabel(activeIntegrationTab) }}
                  integrations configured
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
                    :class="[integration.enabled ? 'bg-accented' : 'bg-muted']"
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
                        <UIcon
                          name="i-lucide-alert-triangle"
                          class="h-4 w-4 mr-1"
                        />
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
                    @update:model-value="
                      handleToggleIntegration(integration.id, $event)
                    "
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

        <div
          class="bg-default rounded-lg shadow-sm border border-default p-6 mb-6"
        >
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
                  Toggle between light and dark themes
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
                  Enable notifications (Coming Soon™)
                </p>
              </div>
              <USwitch
                v-model="notificationsEnabled"
                color="primary"
                checked-icon="i-lucide-alarm-clock-check"
                unchecked-icon="i-lucide-alarm-clock-off"
                size="xl"
                aria-label="Toggle notifications"
              />
            </div>
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium text-highlighted">
                  Font
                </p>
                <p class="text-sm text-muted">
                  Change the app's font
                </p>
              </div>
              <USelect
                v-model="selectedFont"
                :items="FONT_OPTIONS"
                value-attribute="value"
                option-attribute="label"
                :ui="{ content: 'min-w-fit' }"
                aria-label="Select font"
              >
                <template #default>
                  <span
                    :style="{
                      fontFamily: getFontStack(selectedFont),
                    }"
                  >
                    {{ FONT_OPTIONS.find(o => o.value === selectedFont)?.label ?? "System" }}
                  </span>
                </template>
                <template #item-label="{ item }">
                  <span :style="{ fontFamily: getFontStack(item.value) }">
                    {{ item.label }}
                  </span>
                </template>
              </USelect>
            </div>
          </div>
        </div>

        <div class="bg-default rounded-lg shadow-sm border border-default p-6">
          <h2 class="text-lg font-semibold text-highlighted mb-4">
            About
          </h2>
          <div
            class="flex items-center gap-4 mb-6 p-4 bg-muted/30 rounded-lg border border-muted"
          >
            <div
              class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center"
            >
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
                <span
                  class="text-xs font-mono text-primary bg-primary/10 border border-primary/20 px-2 py-1 rounded-md"
                >
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
              Built with ❤️ by the community using Nuxt
              {{ $config.public.nuxtVersion.replace("^", "") }} & Nuxt UI
              {{ $config.public.nuxtUiVersion.replace("^", "") }}
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
      @close="
        () => {
          isIntegrationDialogOpen = false;
          selectedIntegration = null;
        }
      "
      @save="handleIntegrationSave"
      @delete="handleIntegrationDelete"
      @select-calendars="handleSelectCalendars"
    />

    <SettingsCalendarSelectDialog
      :integration="calendarSelectIntegration"
      :is-open="isCalendarSelectDialogOpen"
      @close="
        isCalendarSelectDialogOpen = false;
        calendarSelectIntegration = null;
      "
      @save="handleCalendarsSaved"
      @calendars-disabled="handleCalendarsDisabled"
    />
  </div>
</template>
