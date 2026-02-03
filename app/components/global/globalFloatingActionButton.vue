<script setup lang="ts">
import type { GlobalFloatingActionButtonProps } from "~/types/ui";

const props = withDefaults(defineProps<GlobalFloatingActionButtonProps>(), {
  icon: "i-lucide-plus",
  label: "Add",
  color: "primary",
  size: "lg",
  position: "bottom-right",
  disabled: false,
});

const emit = defineEmits<{
  (e: "click"): void;
}>();

const positionClasses = computed(() => {
  const baseClasses
    = "fixed z-50 rounded-full shadow-lg transition-all duration-200 hover:shadow-xl flex items-center justify-center";

  switch (props.position) {
    case "bottom-left":
      return `${baseClasses} bottom-6 left-6`;
    case "top-right":
      return `${baseClasses} top-6 right-6`;
    case "top-left":
      return `${baseClasses} top-6 left-6`;
    case "bottom-right":
    default:
      return `${baseClasses} bottom-6 right-6`;
  }
});

const sizeClasses = computed(() => {
  switch (props.size) {
    case "sm":
      return "h-10 w-10";
    case "md":
      return "h-12 w-12";
    case "lg":
    default:
      return "h-14 w-14";
  }
});

const iconSizeClasses = computed(() => {
  switch (props.size) {
    case "sm":
      return "h-7 w-7";
    case "md":
      return "h-8 w-8";
    case "lg":
    default:
      return "h-9 w-9";
  }
});

function handleClick() {
  if (!props.disabled) {
    emit("click");
  }
}
</script>

<template>
  <UButton
    :class="[positionClasses, sizeClasses]"
    :color="color"
    :disabled="disabled"
    :aria-label="label"
    class="p-0"
    @click="handleClick"
  >
    <UIcon :name="icon" :class="iconSizeClasses" />
  </UButton>
</template>
