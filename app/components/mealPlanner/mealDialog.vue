<script setup lang="ts">
import { ref, watch } from "vue";

import type { CreateMealInput, Meal, MealType } from "~/types/database";

const props = defineProps<{
  isOpen: boolean;
  meal?: Meal | null;
  dayOfWeek: number;
  mealType: MealType;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", meal: CreateMealInput): void;
  (e: "delete"): void;
}>();

const name = ref("");
const description = ref("");
const daysInAdvance = ref(0);
const error = ref<string | null>(null);

// Mobile detection - use Capacitor detection for reliability
// @ts-ignore - Capacitor is added via script tag in Capacitor builds
const isMobile = typeof window !== "undefined" && "Capacitor" in window;

const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const mealTypeLabels: Record<MealType, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
};

watch(() => [props.isOpen, props.meal], ([isOpen, meal]) => {
  if (isOpen) {
    resetForm();
    if (meal && typeof meal === "object") {
      name.value = meal.name || "";
      description.value = meal.description || "";
      daysInAdvance.value = meal.daysInAdvance || 0;
    }
    // Prevent body scroll when dialog is open
    document.body.style.overflow = "hidden";
  }
  else {
    // Restore body scroll when dialog is closed
    document.body.style.overflow = "";
  }
}, { immediate: true });

function resetForm() {
  name.value = "";
  description.value = "";
  daysInAdvance.value = 0;
  error.value = null;
}

function handleSave() {
  if (!name.value.trim()) {
    error.value = "Meal name is required";
    return;
  }

  emit("save", {
    name: name.value.trim(),
    description: description.value.trim() || undefined,
    mealType: props.mealType,
    dayOfWeek: props.dayOfWeek,
    daysInAdvance: daysInAdvance.value,
    completed: false,
    order: 0,
  });
}

function handleDelete() {
  emit("delete");
}
</script>

<template>
  <!-- Mobile: Full-screen overlay -->
  <div
    v-if="isOpen && isMobile"
    class="fixed inset-0 z-[100] bg-default flex flex-col overflow-hidden"
    style="width: 100vw; height: 100vh; max-width: 100vw; max-height: 100vh;"
  >
    <!-- Header -->
    <div class="flex-shrink-0 flex items-center justify-between p-4 border-b border-default bg-default">
      <h3 class="text-lg font-semibold">
        {{ meal ? 'Edit Meal' : 'Add Meal' }}
      </h3>
      <UButton
        color="neutral"
        variant="ghost"
        icon="i-lucide-x"
        size="lg"
        aria-label="Close"
        @click="emit('close')"
      />
    </div>

    <!-- Scrollable content -->
    <div class="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-3 space-y-3">
      <div v-if="error" class="bg-error/10 text-error rounded-md px-3 py-2 text-sm">
        {{ error }}
      </div>

      <div class="text-sm text-muted">
        <span class="font-medium">{{ dayNames[dayOfWeek] }}</span> -
        <span class="font-medium">{{ mealTypeLabels[mealType] }}</span>
      </div>

      <div class="space-y-1.5">
        <label class="block text-sm font-medium text-highlighted">Meal Name</label>
        <UInput
          v-model="name"
          placeholder="e.g., Grilled Chicken Salad"
          class="w-full max-w-full"
          size="lg"
          @keydown.enter="handleSave"
        />
      </div>

      <div class="space-y-1.5">
        <label class="block text-sm font-medium text-highlighted">Description (optional)</label>
        <UTextarea
          v-model="description"
          placeholder="Notes about the meal..."
          class="w-full max-w-full text-base resize-none"
          :rows="3"
        />
      </div>

      <div class="space-y-1.5">
        <label class="block text-sm font-medium text-highlighted">
          Prep Days in Advance
        </label>
        <UInput
          v-model.number="daysInAdvance"
          type="number"
          :min="0"
          :max="7"
          class="w-full max-w-full"
          size="lg"
        />
        <p class="text-xs text-muted">
          Days before to start prep (e.g., defrosting)
        </p>
      </div>
    </div>

    <!-- Fixed footer with actions -->
    <div class="flex-shrink-0 border-t border-default bg-default px-4 py-3 space-y-2.5">
      <div class="flex gap-3">
        <UButton
          color="neutral"
          variant="outline"
          size="lg"
          class="flex-1"
          @click="emit('close')"
        >
          Cancel
        </UButton>
        <UButton
          color="primary"
          size="lg"
          class="flex-1"
          @click="handleSave"
        >
          {{ meal ? 'Update' : 'Add' }}
        </UButton>
      </div>

      <UButton
        v-if="meal"
        color="error"
        variant="ghost"
        icon="i-lucide-trash"
        size="lg"
        class="w-full"
        @click="handleDelete"
      >
        Delete Meal
      </UButton>
    </div>
  </div>

  <!-- Desktop: Modal dialog -->
  <div
    v-else-if="isOpen && !isMobile"
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
    @click="emit('close')"
  >
    <div
      class="w-[500px] max-w-[90vw] max-h-[90vh] overflow-y-auto bg-default rounded-lg border border-default shadow-lg"
      @click.stop
    >
      <div class="flex items-center justify-between p-4 border-b border-default">
        <h3 class="text-base font-semibold leading-6">
          {{ meal ? 'Edit Meal' : 'Add Meal' }}
        </h3>
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-x"
          size="md"
          class="-my-1"
          aria-label="Close dialog"
          @click="emit('close')"
        />
      </div>

      <div class="p-4 space-y-4">
        <div v-if="error" class="bg-error/10 text-error rounded-md px-3 py-2 text-sm">
          {{ error }}
        </div>

        <div class="text-sm text-muted">
          <span class="font-medium">{{ dayNames[dayOfWeek] }}</span> -
          <span class="font-medium">{{ mealTypeLabels[mealType] }}</span>
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Meal Name</label>
          <UInput
            v-model="name"
            placeholder="e.g., Grilled Chicken Salad"
            class="w-full"
            @keydown.enter="handleSave"
          />
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">Description (optional)</label>
          <UTextarea
            v-model="description"
            placeholder="Notes about the meal..."
            class="w-full text-base"
            :rows="3"
          />
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">
            Days in Advance to Prepare
          </label>
          <UInput
            v-model.number="daysInAdvance"
            type="number"
            :min="0"
            :max="7"
            class="w-full"
          />
          <p class="text-xs text-muted">
            How many days before you need to start preparing this meal (e.g., for defrosting, marinating)
          </p>
        </div>
      </div>

      <div class="flex justify-between gap-2 p-4 border-t border-default">
        <div class="flex gap-2">
          <UButton
            v-if="meal"
            color="error"
            variant="ghost"
            icon="i-lucide-trash"
            @click="handleDelete"
          >
            Delete Meal
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
            {{ meal ? 'Update Meal' : 'Add Meal' }}
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
