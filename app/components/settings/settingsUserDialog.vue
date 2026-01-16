<script setup lang="ts">
import { computed, ref, watch } from "vue";

import type { CreateUserInput, User } from "~/types/database";

const props = defineProps<{
  user: User | null;
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", user: CreateUserInput): void;
  (e: "delete", userId: string): void;
}>();

const name = ref("");
const email = ref("");
const color = ref("#3b82f6");
const avatar = ref("");
const error = ref<string | null>(null);

const chip = computed(() => ({ backgroundColor: color.value }));

const textColor = computed(() => {
  const hex = color.value.replace("#", "");
  if (hex.length !== 6)
    return "374151";

  const r = Number.parseInt(hex.substring(0, 2), 16);
  const g = Number.parseInt(hex.substring(2, 4), 16);
  const b = Number.parseInt(hex.substring(4, 6), 16);

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "374151" : "FFFFFF";
});

watch(() => props.user, (newUser) => {
  if (newUser) {
    name.value = newUser.name || "";
    email.value = newUser.email || "";
    color.value = newUser.color || "#06b6d4";
    avatar.value = newUser.avatar && !newUser.avatar.startsWith("https://ui-avatars.com/api/") ? newUser.avatar : "";
    error.value = null;
  }
  else {
    resetForm();
  }
}, { immediate: true });

watch(() => props.isOpen, (isOpen) => {
  if (!isOpen) {
    resetForm();
  }
});

function resetForm() {
  name.value = "";
  email.value = "";
  color.value = "#06b6d4";
  avatar.value = "";
  error.value = null;
}

function getDefaultAvatarUrl() {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name.value)}&background=${color.value.replace("#", "") || "E5E7EB"}&color=${textColor.value}&size=96`;
}

function handleSave() {
  if (!name.value.trim()) {
    error.value = "Name is required";
    return;
  }

  emit("save", {
    name: name.value.trim(),
    email: email.value?.trim() || "",
    color: color.value,
    avatar: avatar.value || getDefaultAvatarUrl(),
    todoOrder: 0,
  } as CreateUserInput);
}

function handleDelete() {
  if (props.user?.id) {
    emit("delete", props.user.id);
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
      class="w-full max-w-[425px] mx-4 max-h-[90vh] overflow-y-auto bg-default rounded-lg border border-default shadow-lg"
      @click.stop
    >
      <div class="flex items-center justify-between p-4 border-b border-default">
        <h3 class="text-base font-semibold leading-6">
          {{ user?.id ? 'Edit User' : 'Create User' }}
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

      <div class="p-4 space-y-6">
        <div
          v-if="error"
          role="alert"
          class="bg-error/10 text-error rounded-md px-3 py-2 text-sm"
        >
          {{ error }}
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Name *</label>
          <UInput
            v-model="name"
            placeholder="Enter user name"
            class="w-full"
            :ui="{ base: 'w-full' }"
          />
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Email (optional)</label>
          <UInput
            v-model="email"
            placeholder="Enter email address"
            type="email"
            class="w-full"
            :ui="{ base: 'w-full' }"
          />
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Profile Color</label>
          <UPopover>
            <UButton
              label="Choose color"
              color="neutral"
              variant="outline"
            >
              <template #leading>
                <span :style="chip" class="size-3 rounded-full" />
              </template>
            </UButton>
            <template #content>
              <UColorPicker v-model="color" class="p-2" />
            </template>
          </UPopover>
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Avatar</label>
          <div class="flex items-center gap-4">
            <img
              :src="avatar || getDefaultAvatarUrl()"
              :alt="name ? `${name}'s avatar preview` : 'Avatar preview'"
              class="w-12 h-12 rounded-full border border-default"
            >
            <UInput
              v-model="avatar"
              placeholder="Optional: Paste image URL"
              type="url"
              class="w-full"
              :ui="{ base: 'w-full' }"
            />
          </div>
        </div>
      </div>

      <div class="flex justify-between p-4 border-t border-default">
        <UButton
          v-if="user?.id"
          color="error"
          variant="ghost"
          icon="i-lucide-trash"
          aria-label="Delete user"
          @click="handleDelete"
        >
          Delete
        </UButton>
        <div class="flex gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            @click="emit('close')"
          >
            Cancel
          </UButton>
          <UButton
            color="primary"
            :disabled="!name.trim()"
            @click="handleSave"
          >
            Save
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
