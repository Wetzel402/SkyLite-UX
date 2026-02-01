<script setup lang="ts">
import type { TodoColumnBasic } from "~/types/database";

const props = defineProps<{
  isOpen: boolean;
  column?: TodoColumnBasic;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", column: { name: string }): void;
  (e: "delete", columnId: string): void;
}>();

const columnName = ref("");
const columnError = ref<string | null>(null);

const watchSource = computed(() => ({ isOpen: props.isOpen, column: props.column }));
watch(watchSource, ({ isOpen, column }) => {
  if (isOpen) {
    resetForm();
    if (column) {
      columnName.value = column.name || "";
    }
  }
}, { immediate: true });

function resetForm() {
  columnName.value = "";
  columnError.value = null;
}

function handleSave() {
  if (!columnName.value.trim()) {
    columnError.value = "Column name is required";
    return;
  }

  emit("save", { name: columnName.value.trim() });
  resetForm();
  emit("close");
}

function handleDelete() {
  if (props.column?.id) {
    emit("delete", props.column.id);
    emit("close");
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
      class="w-full mx-4 sm:w-[425px] sm:mx-0 max-h-[90vh] overflow-y-auto bg-default rounded-lg border border-default shadow-lg"
      @click.stop
    >
      <div class="flex items-center justify-between p-4 border-b border-default">
        <h3 class="text-base font-semibold leading-6">
          {{ column?.id ? 'Edit Column' : 'Create Column' }}
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
        <div v-if="columnError" class="bg-error/10 text-error rounded-md px-3 py-2 text-sm">
          {{ columnError }}
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Column Name</label>
          <UInput
            v-model="columnName"
            placeholder="Enter column name"
            class="w-full"
            :ui="{ base: 'w-full' }"
            @keyup.enter="handleSave"
          />
        </div>
      </div>

      <div class="flex justify-between p-4 border-t border-default">
        <UButton
          v-if="column?.id"
          color="error"
          variant="ghost"
          icon="i-lucide-trash"
          @click="handleDelete"
        >
          Delete
        </UButton>
        <div class="flex gap-2" :class="{ 'ml-auto': !column?.id }">
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
            {{ column?.id ? 'Update Column' : 'Create Column' }}
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
