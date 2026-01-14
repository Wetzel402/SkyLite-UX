<script setup lang="ts">
import type { CreateShoppingListInput, ShoppingList } from "~/types/database";

const props = defineProps<{
  isOpen: boolean;
  list?: ShoppingList | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", list: CreateShoppingListInput): void;
  (e: "delete"): void;
}>();

const name = ref("");
const error = ref<string | null>(null);

watch(() => [props.isOpen, props.list], ([isOpen, list]) => {
  if (isOpen) {
    resetForm();
    if (list && typeof list === "object" && "name" in list) {
      name.value = list.name || "";
    }
  }
}, { immediate: true });

function resetForm() {
  name.value = "";
  error.value = null;
}

function handleSave() {
  if (!name.value.trim()) {
    error.value = "List name is required";
    return;
  }

  emit("save", {
    name: name.value.trim(),
    order: 0,
  });
}

function handleDelete() {
  emit("delete");
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
          {{ list ? 'Edit Shopping List' : 'Create Shopping List' }}
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
        <div v-if="error" role="alert" class="bg-error/10 text-error rounded-md px-3 py-2 text-sm">
          {{ error }}
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">List Name</label>
          <UInput
            v-model="name"
            placeholder="Groceries, Hardware Store, etc."
            class="w-full"
            :ui="{ base: 'w-full' }"
            @keydown.enter="handleSave"
          />
        </div>

        <div v-if="!list" class="text-sm text-muted">
          You can add items to the list after creating it.
        </div>
      </div>

      <div class="flex justify-between gap-2 p-4 border-t border-default">
        <div class="flex gap-2">
          <UButton
            v-if="list"
            color="error"
            variant="ghost"
            icon="i-lucide-trash"
            @click="handleDelete"
          >
            Delete List
          </UButton>
        </div>
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
            @click="handleSave"
          >
            {{ list ? 'Update List' : 'Create List' }}
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
