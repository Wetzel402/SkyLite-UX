<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

function handleUpdate(value: boolean | string) {
  emit("update:modelValue", Boolean(value));
}

function toggleCheckbox() {
  emit("update:modelValue", !props.modelValue);
}
</script>

<template>
  <div class="flex items-center gap-2">
    <UCheckbox
      :model-value="modelValue"
      @update:model-value="handleUpdate"
    />
    <label class="text-sm font-medium cursor-pointer" @click="toggleCheckbox">
      Mark as Countdown Event
    </label>
  </div>
</template>
