<script setup lang="ts">
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
  <div
    v-if="isOpen"
    class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
    @click="emit('close')"
  >
    <div
      class="w-[500px] max-h-[90vh] overflow-y-auto bg-default rounded-lg border border-default shadow-lg"
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
            class="w-full"
            :rows="3"
          />
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium text-highlighted">
            Days in Advance to Prepare
          </label>
          <UInput
            v-model="daysInAdvance"
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
