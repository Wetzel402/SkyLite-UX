<script setup lang="ts">
import { consola } from "consola";

import type { Integration } from "~/types/database";
import type { CalendarConfig } from "~/types/integrations";

type GoogleCalendarListItem = {
  id: string;
  summary: string;
  description?: string;
  backgroundColor: string;
  foregroundColor: string;
  primary?: boolean;
  accessRole: "read" | "write";
};

const props = defineProps<{
  integration: Integration | null;
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save"): void;
  (e: "calendarsDisabled", calendarIds: string[]): void;
}>();

const { users, fetchUsers } = useUsers();

const pending = ref(false);
const availableCalendars = ref<GoogleCalendarListItem[]>([]);
const calendarConfigs = ref<CalendarConfig[]>([]);
const originalCalendarConfigs = ref<CalendarConfig[]>([]);
const error = ref<string | null>(null);

watch(
  () => props.isOpen,
  async (isOpen) => {
    if (isOpen) {
      await fetchUsers();
      await loadCalendars();
      originalCalendarConfigs.value = JSON.parse(
        JSON.stringify(calendarConfigs.value),
      );
    }
  },
);

watch(
  () => props.integration,
  (integration) => {
    if (integration?.settings) {
      const settings = integration.settings as { calendars?: CalendarConfig[] };
      calendarConfigs.value = JSON.parse(
        JSON.stringify(settings.calendars || []),
      );
    }
  },
  { immediate: true },
);

watch(
  () => calendarConfigs.value.map((config) => config.user),
  (userArrays) => {
    calendarConfigs.value.forEach((config, index) => {
      const userArray = userArrays[index];
      const hasUsers = Array.isArray(userArray) && userArray.length > 0;
      if (hasUsers) {
        config.useUserColors = true;
      } else {
        config.useUserColors = false;
      }
    });
  },
  { deep: true },
);

async function loadCalendars() {
  if (!props.integration?.id) return;

  try {
    pending.value = true;
    error.value = null;

    const result = await $fetch<{ calendars: GoogleCalendarListItem[] }>(
      `/api/integrations/google_calendar/calendars`,
      { query: { integrationId: props.integration.id } },
    );

    availableCalendars.value = result.calendars || [];

    result.calendars.forEach((cal) => {
      const existing = calendarConfigs.value.find((c) => c.id === cal.id);
      if (!existing) {
        calendarConfigs.value.push({
          id: cal.id,
          name: cal.summary,
          enabled: calendarConfigs.value.length === 0 && cal.id === "primary",
          user: [],
          eventColor: cal.backgroundColor || "#06b6d4",
          useUserColors: false,
          accessRole: cal.accessRole,
        });
      }
    });
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : "Failed to load calendars";
  } finally {
    pending.value = false;
  }
}

async function handleSave() {
  if (!props.integration?.id) return;

  try {
    pending.value = true;
    error.value = null;

    const validatedCalendarConfigs = calendarConfigs.value.map((config) => {
      const hasUsers = Array.isArray(config.user) && config.user.length > 0;
      return {
        ...config,
        useUserColors: hasUsers ? config.useUserColors : false,
      };
    });

    const currentSettings =
      (props.integration.settings as Record<string, unknown>) || {};

    await $fetch(`/api/integrations/${props.integration.id}`, {
      method: "PUT",
      body: {
        settings: {
          ...currentSettings,
          calendars: validatedCalendarConfigs,
        },
      },
    });

    await refreshNuxtData("integrations");

    const disabledCalendars = originalCalendarConfigs.value
      .filter((original) => {
        const updated = validatedCalendarConfigs.find(
          (c) => c.id === original.id,
        );
        return original.enabled && updated && !updated.enabled;
      })
      .map((c) => c.id);

    if (disabledCalendars.length > 0) {
      consola.debug(
        `Settings Calendar Select: Detected ${disabledCalendars.length} disabled calendar(s)`,
        disabledCalendars,
      );
      emit("calendarsDisabled", disabledCalendars);
    }

    emit("save");
    emit("close");
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : "Failed to save calendar selection";
  } finally {
    pending.value = false;
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
      class="w-[600px] max-h-[90vh] overflow-y-auto bg-default rounded-lg border border-default shadow-lg"
      @click.stop
    >
      <div
        class="flex items-center justify-between p-4 border-b border-default"
      >
        <h3 class="text-base font-semibold leading-6">Select Calendars</h3>
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-x"
          class="-my-1"
          aria-label="Close dialog"
          @click="emit('close')"
        />
      </div>

      <div class="p-4 space-y-4">
        <div
          v-if="error"
          class="bg-error/10 text-error rounded-md px-3 py-2 text-sm"
        >
          {{ error }}
        </div>

        <div
          v-if="pending"
          class="bg-info/10 text-info rounded-md px-3 py-2 text-sm flex items-center gap-2"
        >
          <UIcon name="i-lucide-loader-2" class="animate-spin h-4 w-4" />
          Loading calendars...
        </div>

        <div
          v-if="!pending && calendarConfigs.length === 0"
          class="bg-warning/10 text-warning rounded-md px-3 py-2 text-sm"
        >
          No calendars found
        </div>

        <div
          v-for="config in calendarConfigs"
          :key="config.id"
          class="border border-default rounded-lg p-4 space-y-3"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <UCheckbox v-model="config.enabled" :label="config.name" />
            </div>
          </div>

          <div
            v-if="config.accessRole === 'read'"
            class="bg-warning/10 text-warning rounded-md px-3 py-2 text-sm flex items-center gap-2"
          >
            <UIcon name="i-lucide-alert-triangle" class="h-4 w-4" />
            <span>Read only: events cannot be created or edited</span>
          </div>

          <template v-if="config.enabled">
            <div class="space-y-2">
              <label class="block text-sm font-medium text-highlighted"
                >Assigned Users</label
              >
              <USelect
                v-model="config.user"
                :items="users.map((u) => ({ label: u.name, value: u.id }))"
                placeholder="Optional: Select user(s)"
                class="w-full"
                multiple
              />
            </div>

            <div class="space-y-2">
              <label class="block text-sm font-medium text-highlighted"
                >Event Color</label
              >
              <UPopover>
                <UButton label="Choose color" color="neutral" variant="outline">
                  <template #leading>
                    <span
                      :style="{
                        backgroundColor: config.eventColor || '#06b6d4',
                      }"
                      class="size-3 rounded-full"
                    />
                  </template>
                </UButton>
                <template #content>
                  <UColorPicker v-model="config.eventColor" class="p-2" />
                </template>
              </UPopover>
            </div>

            <div class="flex items-center gap-2">
              <UCheckbox
                v-model="config.useUserColors"
                label="Use User Profile Colors"
              />
            </div>
          </template>
        </div>
      </div>

      <div class="flex justify-end gap-2 p-4 border-t border-default">
        <UButton color="neutral" variant="ghost" @click="emit('close')">
          Cancel
        </UButton>
        <UButton
          color="primary"
          :loading="pending"
          :disabled="
            pending || calendarConfigs.filter((c) => c.enabled).length === 0
          "
          @click="handleSave"
        >
          {{ pending ? "Saving..." : "Save" }}
        </UButton>
      </div>
    </div>
  </div>
</template>
