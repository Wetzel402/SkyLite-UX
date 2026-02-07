<script setup lang="ts">
import type { JsonValue } from "type-fest";

import type { CreateIntegrationInput, Integration } from "~/types/database";
import type {
  ConnectionTestResult,
  IntegrationSettingsField,
} from "~/types/ui";

import { useUsers } from "~/composables/useUsers";
import { integrationRegistry } from "~/types/integrations";

const props = defineProps<{
  integration: Integration | null;
  isOpen: boolean;
  existingIntegrations: Integration[];
  connectionTestResult: ConnectionTestResult;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", integration: CreateIntegrationInput): void;
  (e: "delete", integrationId: string): void;
  (e: "testConnection", integration: CreateIntegrationInput): void;
  (e: "selectCalendars", integrationId: string): void;
}>();

const show = ref(false);

const name = ref("");
const type = ref<string>("");
const service = ref("");
const enabled = ref(true);
const error = ref<string | null>(null);
const isSaving = ref(false);

const settingsData = ref<Record<string, string | string[] | boolean>>({});

const isTestingConnection = computed(() => {
  return (
    props.connectionTestResult?.isLoading
    || (isSaving.value && !props.connectionTestResult)
  );
});

const integrationNeedsReauth = computed(() => {
  const settings = props.integration?.settings as
    | { needsReauth?: boolean }
    | undefined;
  return Boolean(settings?.needsReauth);
});

const currentIntegrationConfig = computed(() => {
  if (!type.value || !service.value)
    return null;
  return integrationRegistry.get(`${type.value}:${service.value}`);
});

const settingsFields = computed((): IntegrationSettingsField[] => {
  const config = currentIntegrationConfig.value;
  if (!config)
    return [];

  const hasCalendarSelect = config.capabilities.includes("select_calendars");

  if (hasCalendarSelect) {
    return config.settingsFields.filter(
      field => !["user", "eventColor", "useUserColors"].includes(field.key),
    );
  }

  return config.settingsFields;
});

const availableTypes = computed(() => {
  const types = new Set<string>();
  integrationRegistry.forEach((config) => {
    types.add(config.type);
  });

  return Array.from(types).map(type => ({
    label: type.charAt(0).toUpperCase() + type.slice(1),
    value: type,
  }));
});

const availableServices = computed(() => {
  if (!type.value)
    return [];

  const services = new Set<string>();
  integrationRegistry.forEach((config) => {
    if (config.type === type.value) {
      services.add(config.service);
    }
  });

  return Array.from(services).map(service => ({
    label: service.charAt(0).toUpperCase() + service.slice(1),
    value: service,
  }));
});

const { users, fetchUsers } = useUsers();

onMounted(() => {
  fetchUsers();
});

watch(
  () => props.isOpen,
  async (isOpen) => {
    if (isOpen) {
      await fetchUsers();
    }
  },
);

function initializeSettingsData() {
  const initialData: Record<string, string | string[] | boolean> = {};
  settingsFields.value.forEach((field: IntegrationSettingsField) => {
    if (field.type === "color") {
      initialData[field.key] = field.placeholder || "#06b6d4";
    }
    else if (field.type === "boolean") {
      if (field.key === "useUserColors") {
        initialData[field.key] = false;
      }
      else {
        initialData[field.key] = false;
      }
    }
    else if (field.key === "user") {
      initialData[field.key] = [];
    }
    else {
      initialData[field.key] = "";
    }
  });
  settingsData.value = initialData;
}

watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      if (availableTypes.value.length > 0) {
        const firstType = availableTypes.value[0];
        if (firstType) {
          type.value = firstType.value;
        }
      }
    }
    else {
      resetForm();
    }
  },
);

watch(type, (_newType) => {
  if (props.integration?.id) {
    return;
  }

  service.value = "";

  if (availableServices.value.length > 0) {
    const firstService = availableServices.value[0];
    if (firstService) {
      service.value = firstService.value;
    }
  }
});

watch(service, () => {
  if (!props.integration?.id || Object.keys(settingsData.value).length === 0) {
    initializeSettingsData();
  }
});

watch(
  () => props.integration,
  (newIntegration) => {
    if (newIntegration) {
      nextTick(() => {
        name.value = newIntegration.name || "";
        type.value = newIntegration.type || "";
        service.value = newIntegration.service || "";
        enabled.value = newIntegration.enabled;
        error.value = null;

        initializeSettingsData();
        if (newIntegration.settings && newIntegration.settings.user) {
          settingsData.value.user = newIntegration.settings.user as string[];
        }
        if (newIntegration.settings && newIntegration.settings.eventColor) {
          settingsData.value.eventColor = newIntegration.settings
            .eventColor as string;
        }
        if (
          newIntegration.settings
          && typeof newIntegration.settings.useUserColors === "boolean"
        ) {
          settingsData.value.useUserColors = newIntegration.settings
            .useUserColors as boolean;
        }
        if (newIntegration.settings && newIntegration.settings.clientId) {
          settingsData.value.clientId = newIntegration.settings
            .clientId as string;
        }
        if (newIntegration.settings && newIntegration.settings.clientSecret) {
          settingsData.value.clientSecret = newIntegration.settings
            .clientSecret as string;
        }
      });
    }
    else {
      resetForm();
    }
  },
  { immediate: true },
);

watch(
  () => settingsData.value.user,
  (userSelection) => {
    const hasUsers = Array.isArray(userSelection) && userSelection.length > 0;
    if (hasUsers) {
      settingsData.value.useUserColors = true;
    }
    else {
      settingsData.value.useUserColors = false;
    }
  },
  { deep: true },
);

function resetForm() {
  name.value = "";
  const firstType = availableTypes.value[0];
  type.value = firstType ? firstType.value : "";
  service.value = "";
  enabled.value = true;
  error.value = null;
  isSaving.value = false;
  show.value = false;
  initializeSettingsData();
}

function generateUniqueName(
  serviceName: string,
  existingIntegrations: Integration[],
): string {
  const baseName = serviceName.charAt(0).toUpperCase() + serviceName.slice(1);

  const existingNames = existingIntegrations.map(
    integration => integration.name,
  );
  if (!existingNames.includes(baseName)) {
    return baseName;
  }

  let counter = 2;
  while (existingNames.includes(`${baseName}${counter}`)) {
    counter++;
  }

  return `${baseName}${counter}`;
}

function getFieldPlaceholder(field: IntegrationSettingsField): string {
  if (props.integration?.id) {
    if (field.key === "apiKey") {
      return "Leave empty to keep current API key, or enter new key";
    }
    if (field.key === "baseUrl") {
      return "Leave empty to keep current URL, or enter new URL";
    }
  }

  return field.placeholder || "";
}

async function handleSave() {
  if (!type.value || !service.value) {
    error.value = "Integration type and service are required";
    return;
  }

  const config = currentIntegrationConfig.value;
  if (!config) {
    error.value = "Invalid integration type or service";
    return;
  }

  if (!props.integration?.id) {
    const missingFields = settingsFields.value
      .filter(
        field =>
          field.required && !settingsData.value[field.key]?.toString().trim(),
      )
      .map(field => field.label);

    if (missingFields.length > 0) {
      error.value = `Missing required fields: ${missingFields.join(", ")}`;
      return;
    }
  }

  isSaving.value = true;
  error.value = null;

  try {
    const integrationName
      = name.value.trim()
        || generateUniqueName(service.value, props.existingIntegrations);

    const userSelection = settingsData.value.user || [];
    const hasUsers = Array.isArray(userSelection) && userSelection.length > 0;
    const useUserColors = hasUsers
      ? Boolean(settingsData.value.useUserColors)
      : false;

    const integrationData: CreateIntegrationInput = {
      name: integrationName,
      type: type.value,
      service: service.value,
      apiKey: null as string | null,
      baseUrl: null as string | null,
      icon: null,
      enabled: enabled.value,
      settings: {
        user: userSelection,
        eventColor: settingsData.value.eventColor || "#06b6d4",
        useUserColors,
        clientId: settingsData.value.clientId || "",
        clientSecret: settingsData.value.clientSecret || "",
        ...(props.integration?.id
          && currentIntegrationConfig.value?.capabilities.includes(
            "select_calendars",
          )
          && !settingsData.value.clientSecret
          ? {
              calendars:
                ((props.integration.settings as { calendars?: unknown })
                  ?.calendars as JsonValue) || [],
            }
          : {}),
      },
    };

    const config = currentIntegrationConfig.value;

    if (config?.customSaveHandler) {
      const handled = await config.customSaveHandler(
        { ...integrationData, id: props.integration?.id },
        settingsData.value,
        !!props.integration?.id,
        props.integration,
      );

      if (handled) {
        return;
      }
    }

    if (!props.integration?.id) {
      integrationData.apiKey
        = settingsData.value.apiKey?.toString().trim() || "";
      integrationData.baseUrl
        = settingsData.value.baseUrl?.toString().trim() || "";
    }
    else {
      const apiKeyValue = settingsData.value.apiKey?.toString().trim();
      const baseUrlValue = settingsData.value.baseUrl?.toString().trim();

      if (apiKeyValue) {
        integrationData.apiKey = apiKeyValue;
      }
      if (baseUrlValue) {
        integrationData.baseUrl = baseUrlValue;
      }
    }

    emit("save", integrationData);
  }
  catch (err) {
    error.value
      = err instanceof Error ? err.message : "Failed to save integration";
  }
  finally {
    isSaving.value = false;
  }
}

function handleDelete() {
  if (props.integration?.id) {
    emit("delete", props.integration.id);
  }
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
    @click="emit('close')"
  >
    <div
      class="w-[425px] max-h-[90vh] overflow-y-auto bg-default rounded-lg border border-default shadow-lg"
      @click.stop
    >
      <div
        class="flex items-center justify-between p-4 border-b border-default"
      >
        <h3 class="text-base font-semibold leading-6">
          {{ integration?.id ? "Edit Integration" : "Add Integration" }}
        </h3>
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-x"
          class="-my-1"
          aria-label="Close dialog"
          @click="emit('close')"
        />
      </div>

      <form class="p-4 space-y-6" @submit.prevent="handleSave">
        <div
          v-if="error"
          class="bg-error/10 text-error rounded-md px-3 py-2 text-sm"
        >
          {{ error }}
        </div>

        <div
          v-if="isTestingConnection"
          class="bg-info/10 text-info rounded-md px-3 py-2 text-sm flex items-center gap-2"
        >
          <UIcon name="i-lucide-loader-2" class="animate-spin h-4 w-4" />
          {{ props.connectionTestResult?.message || "Testing connection..." }}
        </div>

        <div
          v-if="
            props.connectionTestResult && !props.connectionTestResult.isLoading
          "
        >
          <div
            v-if="props.connectionTestResult.success"
            class="bg-success/10 text-success rounded-md px-3 py-2 text-sm flex items-center gap-2"
          >
            <UIcon name="i-lucide-check-circle" class="h-4 w-4" />
            {{
              props.connectionTestResult.message
                || "Connection test successful! Integration saved."
            }}
          </div>
          <div
            v-else
            class="bg-error/10 text-error rounded-md px-3 py-2 text-sm flex items-center gap-2"
          >
            <UIcon name="i-lucide-x-circle" class="h-4 w-4" />
            {{
              props.connectionTestResult.error
                || "Connection test failed. Check your API key and base URL."
            }}
          </div>
        </div>

        <div
          v-if="integration?.id && integrationNeedsReauth"
          class="bg-warning/10 text-warning rounded-md px-3 py-2 text-sm"
        >
          <div class="flex items-start gap-2">
            <UIcon
              name="i-lucide-alert-triangle"
              class="h-4 w-4 mt-0.5 flex-shrink-0"
            />
            <div>
              <p class="font-medium">
                Re-authorization Required
              </p>
              <p class="text-xs mt-1">
                Your {{ integration.name || service }} access has expired or
                been revoked. Click Save to re-authorize.
              </p>
            </div>
          </div>
        </div>

        <div
          v-if="integration?.id"
          class="bg-info/10 text-info rounded-md px-3 py-2 text-sm"
        >
          <div class="flex items-start gap-2">
            <UIcon name="i-lucide-info" class="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <p class="font-medium">
                Editing existing integration
              </p>
              <p class="text-xs mt-1">
                For security reasons, API keys, client secrets, etc. are not
                displayed. Leave these fields empty to keep current values, or
                enter new values to update them.
              </p>
            </div>
          </div>
        </div>

        <template v-if="!integration?.id">
          <div class="space-y-2">
            <label class="block text-sm font-medium text-highlighted">Integration Type *</label>
            <USelect
              v-model="type"
              :items="availableTypes"
              class="w-full"
            />
          </div>

          <div class="space-y-2">
            <label class="block text-sm font-medium text-highlighted">Service *</label>
            <USelect
              v-model="service"
              :items="availableServices"
              class="w-full"
            />
          </div>
        </template>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Integration Name</label>
          <UInput
            v-model="name"
            placeholder="Jane's Integration"
            class="w-full"
            :ui="{ base: 'w-full' }"
          />
          <p class="text-sm text-muted">
            Optional: If not provided, a name will be generated.
          </p>
        </div>

        <template v-if="currentIntegrationConfig">
          <div
            v-for="field in settingsFields"
            :key="field.key"
            class="space-y-2"
          >
            <template v-if="field.type === 'color'">
              <label
                :for="field.key"
                class="block text-sm font-medium text-highlighted"
              >
                {{ field.label }}{{ field.required ? " *" : "" }}
              </label>
              <p v-if="field.description" class="text-sm text-muted">
                {{ field.description }}
              </p>
              <UPopover class="mt-2">
                <UButton
                  label="Choose color"
                  color="neutral"
                  variant="outline"
                >
                  <template #leading>
                    <span
                      :style="{
                        backgroundColor:
                          typeof settingsData[field.key] === 'string'
                            ? (settingsData[field.key] as string)
                            : '#06b6d4',
                      }"
                      class="size-3 rounded-full"
                    />
                  </template>
                </UButton>
                <template #content>
                  <UColorPicker
                    v-model="settingsData[field.key] as string"
                    class="p-2"
                  />
                </template>
              </UPopover>
            </template>
            <template v-else-if="field.type === 'boolean'">
              <UCheckbox
                v-model="settingsData[field.key] as boolean"
                :label="field.label"
              />
            </template>
            <template v-else-if="field.key === 'user'">
              <USelect
                v-model="settingsData[field.key] as string[]"
                :items="users.map((u) => ({ label: u.name, value: u.id }))"
                placeholder="Optional: Select user(s)"
                class="w-full"
                multiple
              />
            </template>
            <template v-else>
              <UInput
                :id="field.key"
                v-model="settingsData[field.key] as string"
                :type="
                  field.type === 'password'
                    ? show
                      ? 'text'
                      : 'password'
                    : field.type
                "
                :placeholder="getFieldPlaceholder(field)"
                class="w-full"
                :ui="{ base: 'w-full' }"
              >
                <template v-if="field.type === 'password'" #trailing>
                  <UButton
                    color="neutral"
                    variant="ghost"
                    :icon="show ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                    :aria-label="show ? 'Hide password' : 'Show password'"
                    @click="show = !show"
                  />
                </template>
              </UInput>
            </template>
            <p v-if="field.description" class="text-sm text-muted">
              {{ field.description }}
            </p>
          </div>
        </template>

        <UButton
          v-if="
            integration?.id
              && currentIntegrationConfig?.capabilities.includes('select_calendars')
          "
          color="primary"
          variant="outline"
          icon="i-lucide-calendar"
          class="w-full"
          @click="
            emit('selectCalendars', integration.id);
            emit('close');
          "
        >
          Select Calendars
        </UButton>

        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <UCheckbox v-model="enabled" label="Enable integration" />
          </div>
        </div>
      </form>

      <div class="flex justify-between p-4 border-t border-default">
        <UButton
          v-if="integration?.id"
          color="error"
          variant="ghost"
          icon="i-lucide-trash"
          aria-label="Delete integration"
          @click="handleDelete"
        >
          Delete
        </UButton>
        <div class="flex gap-2" :class="{ 'ml-auto': !integration?.id }">
          <UButton
            color="neutral"
            variant="ghost"
            @click="emit('close')"
          >
            Cancel
          </UButton>
          <UButton
            color="primary"
            :loading="isTestingConnection"
            :disabled="isTestingConnection"
            @click="handleSave"
          >
            {{ isTestingConnection ? "Saving..." : "Save" }}
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
