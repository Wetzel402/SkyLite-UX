<script setup lang="ts">
import type {
  CreateShoppingListItemInput,
  ShoppingListItem,
} from "~/types/database";
import type { FormData } from "~/types/forms";
import type { DialogField } from "~/types/ui";

const props = defineProps<{
  isOpen: boolean;
  item?: ShoppingListItem | null;
  fields: DialogField[];
  integrationCapabilities?: string[];
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", item: CreateShoppingListItemInput): void;
  (e: "delete", itemId: string): void;
}>();

const formData = ref<FormData>({});

function initializeFormData() {
  const initialData: FormData = {};
  props.fields.forEach((field: DialogField) => {
    switch (field.type) {
      case "number":
        initialData[field.key] = 0;
        break;
      case "textarea":
      case "text":
      default:
        initialData[field.key] = "";
        break;
    }
  });
  formData.value = initialData;
}
const error = ref<string | null>(null);

const fields = computed(() => {
  return props.fields.map((field: DialogField) => ({
    ...field,
    disabled: !field.canEdit,
  }));
});

const canDelete = computed(() => {
  if (!props.integrationCapabilities) return true;

  return props.integrationCapabilities.includes("delete_items");
});

watch(
  () => [props.isOpen, props.item],
  ([isOpen, item]) => {
    if (isOpen) {
      resetForm();
      if (item && typeof item === "object") {
        props.fields.forEach((field) => {
          const fieldKey = field.key;
          const fieldValue = (item as unknown as Record<string, unknown>)[
            fieldKey
          ];
          if (fieldValue !== undefined) {
            if (field.type === "number") {
              formData.value[fieldKey] = Number(fieldValue);
            } else {
              formData.value[fieldKey] = fieldValue ? String(fieldValue) : "";
            }
          }
        });
      }
    }
  },
  { immediate: true },
);

function resetForm() {
  initializeFormData();
  error.value = null;
}

function handleSave() {
  const requiredField = props.fields.find(
    (f: DialogField) => f.required && f.canEdit,
  );
  if (requiredField && !formData.value[requiredField.key]?.toString().trim()) {
    error.value = `${requiredField.label} is required`;
    return;
  }

  const saveData: CreateShoppingListItemInput = {
    name:
      formData.value.name?.toString().trim() ||
      formData.value.notes?.toString().trim() ||
      "Unknown",
    quantity: Number(formData.value.quantity) || 0,
    unit: formData.value.unit?.toString().trim() || "",
    notes: formData.value.notes?.toString().trim() || "",
    food: formData.value.food?.toString().trim() || "",
    checked: false,
    order: 0,
    label: null,
  };

  emit("save", saveData);
  emit("close");
}

function handleDelete() {
  if (props.item?.id) {
    emit("delete", props.item.id);
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
          {{ item ? "Edit Item" : "Add Item" }}
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
          class="bg-error/10 text-error rounded-md px-3 py-2 text-sm"
        >
          {{ error }}
        </div>

        <template v-for="field in fields" :key="field.key">
          <div v-if="field.key === 'quantity'" class="flex gap-4">
            <div class="w-1/2 space-y-2">
              <label
                class="block text-sm font-medium text-highlighted flex items-center gap-1"
              >
                {{ field.label }}
                <UIcon
                  v-if="field.disabled"
                  name="i-lucide-lock"
                  class="h-3 w-3 text-muted"
                />
              </label>
              <UInput
                v-model.number="formData[field.key]"
                type="number"
                :min="field.min"
                :disabled="field.disabled"
                class="w-full"
                :ui="{ base: 'w-full' }"
              />
            </div>

            <div
              v-if="fields.find((f: DialogField) => f.key === 'unit')"
              class="w-1/2 space-y-2"
            >
              <label
                class="block text-sm font-medium text-highlighted flex items-center gap-1"
              >
                Unit
                <UIcon
                  v-if="
                    fields.find((f: DialogField) => f.key === 'unit')?.disabled
                  "
                  name="i-lucide-lock"
                  class="h-3 w-3 text-muted"
                />
              </label>
              <UInput
                v-model="formData.unit"
                :placeholder="
                  fields.find((f: DialogField) => f.key === 'unit')
                    ?.placeholder || 'Unit'
                "
                :disabled="
                  fields.find((f: DialogField) => f.key === 'unit')?.disabled
                "
                class="w-full"
                :ui="{ base: 'w-full' }"
              />
            </div>
          </div>

          <div v-else-if="field.key !== 'unit'" class="space-y-2">
            <label
              class="block text-sm font-medium text-highlighted flex items-center gap-1"
            >
              {{ field.label }}
              <UIcon
                v-if="field.disabled"
                name="i-lucide-lock"
                class="h-3 w-3 text-muted"
              />
            </label>

            <UInput
              v-if="field.type === 'text'"
              v-model="formData[field.key]"
              :placeholder="field.placeholder"
              :disabled="field.disabled"
              class="w-full"
              :ui="{ base: 'w-full' }"
            />

            <UInput
              v-else-if="field.type === 'number'"
              v-model.number="formData[field.key]"
              type="number"
              :min="field.min"
              :disabled="field.disabled"
              class="w-full"
              :ui="{ base: 'w-full' }"
            />

            <UTextarea
              v-else-if="field.type === 'textarea'"
              v-model="formData[field.key]"
              :placeholder="field.placeholder"
              :disabled="field.disabled"
              :rows="2"
              class="w-full"
              :ui="{ base: 'w-full' }"
            />
          </div>
        </template>
      </div>

      <div class="flex justify-between p-4 border-t border-default">
        <UButton
          v-if="item?.id && canDelete"
          color="error"
          variant="ghost"
          icon="i-lucide-trash"
          @click="handleDelete"
        >
          Delete
        </UButton>
        <div class="flex gap-2" :class="{ 'ml-auto': !item?.id || !canDelete }">
          <UButton color="neutral" variant="ghost" @click="emit('close')">
            Cancel
          </UButton>
          <UButton color="primary" @click="handleSave">
            {{ item ? "Update Item" : "Add Item" }}
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
