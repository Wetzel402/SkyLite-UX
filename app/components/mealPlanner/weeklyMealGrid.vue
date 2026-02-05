<script setup lang="ts">
import { format } from "date-fns";
import { computed, nextTick, onMounted, ref, watch } from "vue";

import type { Meal, MealType } from "~/types/database";

import { useStableDate } from "~/composables/useStableDate";

import MealFormInline from "./mealFormInline.vue";

type MealWithPending = Meal & { _isPending?: boolean };

const props = defineProps<{
  weekStart: Date;
  meals: MealWithPending[];
}>();

const emit = defineEmits<{
  (e: "addMeal", dayOfWeek: number, mealType: MealType, data?: { name: string; description: string; daysInAdvance: number }): void;
  (e: "editMeal", meal: Meal): void;
  (e: "deleteMeal", meal: Meal): void;
  (e: "moveMeal", data: { mealId: string; newDayOfWeek: number; newMealType: MealType }): void;
}>();

const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const mealTypes: MealType[] = ["BREAKFAST", "LUNCH", "DINNER"];
const mealTypeLabels: Record<MealType, string> = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
};

// Mobile detection - use Capacitor detection for reliability on high DPI devices
// Use ref to avoid SSR/hydration mismatch
const isMobile = ref(false);
const movingMeal = ref<MealWithPending | null>(null);

// Accordion state
const expandedDay = ref<number | null>(null);

// Inline form state
const inlineFormState = ref<{
  isOpen: boolean;
  dayOfWeek: number;
  mealType: MealType;
  editingMeal: any | null;
} | null>(null);

// Helper to check if form is active for specific slot
function isFormActive(dayOfWeek: number, mealType: MealType): boolean {
  return inlineFormState.value?.isOpen === true
    && inlineFormState.value?.dayOfWeek === dayOfWeek
    && inlineFormState.value?.mealType === mealType;
}

// Helper to determine default expanded day
function getDefaultExpandedDay(): number {
  const { getStableDate } = useStableDate();
  const today = getStableDate();

  // Normalize weekStart to Date object (may be serialized string)
  const weekStart = new Date(props.weekStart);
  if (Number.isNaN(weekStart.getTime())) {
    // Invalid date, fallback to Monday
    return 0;
  }

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  if (today >= weekStart && today <= weekEnd) {
    // Current week - expand today
    return (today.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0
  }
  // Other weeks - expand Monday
  return 0;
}

onMounted(() => {
  // Set mobile detection after client-side hydration
  isMobile.value = typeof window !== "undefined" && "Capacitor" in window;

  // Set default expanded day
  expandedDay.value = getDefaultExpandedDay();
});

// Track if we should preserve the expanded day across data reloads
const preserveExpandedDay = ref(false);
const preservedDay = ref<number | null>(null);

// Watch for week changes
watch(() => props.weekStart, () => {
  // Reset expanded day when week changes
  expandedDay.value = getDefaultExpandedDay();
  preserveExpandedDay.value = false;
  preservedDay.value = null;

  // Close any open forms when week changes
  closeInlineForm();
});

// Watch for meals changes to preserve accordion state
watch(() => props.meals, () => {
  if (preserveExpandedDay.value && preservedDay.value !== null) {
    expandedDay.value = preservedDay.value;
    // Reset the preserve flag after applying
    preserveExpandedDay.value = false;
    preservedDay.value = null;
  }
});

const mealGrid = computed(() => {
  const grid: Record<number, Record<MealType, MealWithPending[]>> = {};

  for (let day = 0; day < 7; day++) {
    grid[day] = {
      BREAKFAST: [],
      LUNCH: [],
      DINNER: [],
    };
  }

  props.meals.forEach((meal) => {
    if (grid[meal.dayOfWeek]?.[meal.mealType]) {
      grid[meal.dayOfWeek]![meal.mealType]!.push(meal);
    }
  });

  return grid;
});

function getDayDate(dayOfWeek: number): string {
  const date = new Date(props.weekStart);
  date.setDate(date.getDate() + dayOfWeek);
  return format(date, "MMM d");
}

function startMoveMode(meal: MealWithPending) {
  movingMeal.value = meal;
}

function cancelMoveMode() {
  movingMeal.value = null;
}

function moveMealToSlot(dayOfWeek: number, mealType: MealType) {
  if (!movingMeal.value)
    return;

  emit("moveMeal", {
    mealId: movingMeal.value.id,
    newDayOfWeek: dayOfWeek,
    newMealType: mealType,
  });

  cancelMoveMode();
}

// Toggle day expansion
function toggleDay(dayOfWeek: number) {
  if (expandedDay.value === dayOfWeek) {
    expandedDay.value = null;
  }
  else {
    expandedDay.value = dayOfWeek;
  }
}

// Open inline form
function openInlineForm(dayOfWeek: number, mealType: MealType, meal?: any) {
  // Ensure day is expanded
  if (expandedDay.value !== dayOfWeek) {
    expandedDay.value = dayOfWeek;
  }

  // Update form state if slot is different OR meal is different
  const isDifferentSlot = inlineFormState.value?.dayOfWeek !== dayOfWeek
    || inlineFormState.value?.mealType !== mealType;
  const isDifferentMeal = inlineFormState.value?.editingMeal?.id !== meal?.id;

  if (isDifferentSlot || isDifferentMeal || !inlineFormState.value?.isOpen) {
    inlineFormState.value = {
      isOpen: true,
      dayOfWeek,
      mealType,
      editingMeal: meal || null,
    };
  }
}

// Close inline form
function closeInlineForm() {
  inlineFormState.value = null;
}

// Handle form save
async function handleInlineFormSave(data: { name: string; description: string; daysInAdvance: number }) {
  if (!inlineFormState.value)
    return;

  const { dayOfWeek, mealType, editingMeal } = inlineFormState.value;

  // Store the day we're on before closing the form
  const currentDay = dayOfWeek;

  // Set preservation flags BEFORE emitting to parent
  // This ensures the watch on meals will restore this day after reload
  preserveExpandedDay.value = true;
  preservedDay.value = currentDay;

  if (editingMeal) {
    // Emit edit event to parent
    emit("editMeal", {
      ...editingMeal,
      ...data,
    });
  }
  else {
    // Emit add event to parent with data
    emit("addMeal", dayOfWeek, mealType, data);
  }

  closeInlineForm();
}

// Handle form delete
async function handleInlineFormDelete() {
  if (!inlineFormState.value?.editingMeal)
    return;

  // Store the day before closing
  const currentDay = inlineFormState.value.dayOfWeek;

  // Set preservation flags BEFORE emitting to parent
  // This ensures the watch on meals will restore this day after reload
  preserveExpandedDay.value = true;
  preservedDay.value = currentDay;

  emit("deleteMeal", inlineFormState.value.editingMeal);
  closeInlineForm();
}

// Accordion animation hooks
function onAccordionEnter(el: Element) {
  const element = el as HTMLElement;
  // Start with height 0 and opacity 0
  element.style.height = "0";
  element.style.opacity = "0";

  // Force reflow to ensure initial state is applied
  void element.offsetHeight;

  // Measure the full height and animate to it
  const targetHeight = element.scrollHeight;
  element.style.height = `${targetHeight}px`;
  element.style.opacity = "1";
}

function onAccordionAfterEnter(el: Element) {
  const element = el as HTMLElement;
  // Clear inline styles to use auto height
  element.style.height = "";
  element.style.opacity = "";
}

function onAccordionLeave(el: Element) {
  const element = el as HTMLElement;
  const height = getComputedStyle(element).height;
  element.style.height = height;

  // Force reflow
  void getComputedStyle(element).height;

  element.style.height = "0";
  element.style.opacity = "0";
}
</script>

<template>
  <div>
    <!-- Move mode overlay (mobile) -->
    <div
      v-if="movingMeal && isMobile"
      class="fixed top-0 left-[50px] right-0 bottom-0 z-40 bg-black/80 overflow-y-auto p-4"
    >
      <div class="w-full max-w-full">
        <!-- Header -->
        <div class="bg-default rounded-lg p-4 mb-4 sticky top-0 z-10 shadow-lg">
          <div class="flex items-center justify-between mb-2">
            <h3 class="font-semibold text-lg truncate pr-2">
              Move "{{ movingMeal.name }}"
            </h3>
            <UButton
              icon="i-lucide-x"
              variant="ghost"
              size="lg"
              aria-label="Cancel move"
              class="flex-shrink-0"
              @click="cancelMoveMode"
            />
          </div>
          <p class="text-sm text-muted">
            Tap a destination slot below
          </p>
        </div>

        <!-- Destination picker (scrollable list of days) -->
        <div class="space-y-4 pb-4">
          <div
            v-for="dayOfWeek in 7"
            :key="dayOfWeek - 1"
            class="bg-default rounded-lg overflow-hidden shadow-md"
          >
            <!-- Day header -->
            <div class="p-3 bg-muted/10 font-semibold text-sm border-b border-default">
              {{ dayNames[dayOfWeek - 1] }} - {{ getDayDate(dayOfWeek - 1) }}
            </div>

            <!-- Meal type buttons -->
            <div class="p-3 space-y-2">
              <button
                v-for="mealType in mealTypes"
                :key="mealType"
                :disabled="dayOfWeek - 1 === movingMeal.dayOfWeek && mealType === movingMeal.mealType"
                class="w-full p-3 border-2 rounded-lg text-left active:bg-primary/5 transition-colors"
                :class="[
                  dayOfWeek - 1 === movingMeal.dayOfWeek && mealType === movingMeal.mealType
                    ? 'border-default bg-muted/10 text-muted cursor-not-allowed'
                    : 'border-primary/30 hover:bg-primary/5 hover:border-primary',
                ]"
                @click="moveMealToSlot(dayOfWeek - 1, mealType)"
              >
                <span class="text-sm font-medium">{{ mealTypeLabels[mealType] }}</span>
                <span
                  v-if="dayOfWeek - 1 === movingMeal.dayOfWeek && mealType === movingMeal.mealType"
                  class="text-xs text-muted ml-2"
                >
                  (current)
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Mobile Layout: Vertical day-by-day layout with ACCORDION -->
    <div v-if="isMobile" class="space-y-3 overflow-x-hidden">
      <div
        v-for="dayOfWeek in 7"
        :key="dayOfWeek - 1"
        class="day-card bg-default rounded-lg shadow-sm border border-default overflow-hidden"
      >
        <!-- Clickable day header -->
        <button
          class="w-full p-3 bg-muted/5 flex items-center justify-between active:bg-muted/10 transition-colors"
          :aria-expanded="expandedDay === dayOfWeek - 1"
          @click="toggleDay(dayOfWeek - 1)"
        >
          <div class="text-left">
            <h3 class="font-semibold text-base">
              {{ dayNames[dayOfWeek - 1] }}
            </h3>
            <p class="text-xs text-muted">
              {{ getDayDate(dayOfWeek - 1) }}
            </p>
          </div>
          <UIcon
            :name="expandedDay === dayOfWeek - 1 ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
            class="h-5 w-5 text-muted transition-transform"
            aria-hidden="true"
          />
        </button>

        <!-- Expandable content with Vue Transition -->
        <Transition
          name="accordion"
          @enter="onAccordionEnter"
          @after-enter="onAccordionAfterEnter"
          @leave="onAccordionLeave"
        >
          <div v-show="expandedDay === dayOfWeek - 1" class="day-content">
            <div class="p-3 space-y-3">
              <!-- Meal type section -->
              <div
                v-for="mealType in mealTypes"
                :key="mealType"
                class="meal-type-section"
              >
                <!-- Meal type label -->
                <div class="text-xs text-muted font-medium mb-2 uppercase">
                  {{ mealTypeLabels[mealType] }}
                </div>

                <!-- Existing meals -->
                <div v-if="mealGrid[dayOfWeek - 1]?.[mealType]?.length" class="space-y-2 mb-2">
                  <div
                    v-for="meal in (mealGrid[dayOfWeek - 1]?.[mealType] || [])"
                    :key="meal.id"
                    class="meal-card p-3 rounded-lg border border-default bg-muted/5 active:bg-muted/10 transition-colors"
                    @click="openInlineForm(dayOfWeek - 1, mealType, meal)"
                  >
                    <!-- Existing meal display -->
                    <div class="flex items-start justify-between gap-2">
                      <div class="flex-1 min-w-0">
                        <div class="font-medium text-sm">
                          {{ meal.name }}
                        </div>
                        <div v-if="meal.description" class="text-xs text-muted mt-1">
                          {{ meal.description }}
                        </div>
                        <div v-if="meal.daysInAdvance > 0" class="text-xs text-muted mt-1">
                          Prep: {{ meal.daysInAdvance }}d before
                        </div>
                      </div>
                      <!-- Quick actions (move) -->
                      <div class="flex items-center gap-2 flex-shrink-0">
                        <button
                          class="p-2 rounded hover:bg-muted/10 active:bg-muted/20"
                          aria-label="Move meal"
                          @click.stop="startMoveMode(meal)"
                        >
                          <UIcon name="i-lucide-move" class="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <!-- Pending sync indicator -->
                    <div v-if="(meal as any)._isPending" class="flex items-center gap-1 text-xs text-warning mt-2">
                      <UIcon name="i-lucide-cloud-off" class="h-3 w-3" />
                      <span>Pending sync</span>
                    </div>
                  </div>
                </div>

                <!-- Add meal button (hide when form is open) -->
                <button
                  v-if="!isFormActive(dayOfWeek - 1, mealType)"
                  class="w-full p-2 border border-dashed border-default rounded-lg text-xs text-muted hover:bg-muted/5 active:bg-muted/10 transition-colors"
                  @click="openInlineForm(dayOfWeek - 1, mealType)"
                >
                  + Add meal
                </button>

                <!-- Inline form (appears here with transition) -->
                <Transition name="slide-fade">
                  <MealFormInline
                    v-if="isFormActive(dayOfWeek - 1, mealType)"
                    :day-of-week="dayOfWeek - 1"
                    :meal-type="mealType"
                    :editing-meal="inlineFormState?.editingMeal"
                    @save="handleInlineFormSave"
                    @delete="handleInlineFormDelete"
                    @close="closeInlineForm"
                  />
                </Transition>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <!-- Desktop Layout -->
    <div v-else class="overflow-x-auto">
      <div class="min-w-[900px]">
        <!-- Header Row -->
        <div class="grid grid-cols-8 gap-2 mb-2">
          <div class="font-medium text-sm text-muted">
            <!-- Empty cell for meal type column -->
          </div>
          <div
            v-for="(day, index) in dayNames"
            :key="index"
            class="text-center"
          >
            <div class="font-semibold text-sm">
              {{ day }}
            </div>
            <div class="text-xs text-muted">
              {{ getDayDate(index) }}
            </div>
          </div>
        </div>

        <!-- Meal Type Rows -->
        <div
          v-for="mealType in mealTypes"
          :key="mealType"
          class="mb-4"
        >
          <div class="grid grid-cols-8 gap-2">
            <!-- Meal Type Label -->
            <div class="flex items-center">
              <span class="font-medium text-sm text-muted">
                {{ mealTypeLabels[mealType] }}
              </span>
            </div>

            <!-- Day Cells -->
            <div
              v-for="dayOfWeek in 7"
              :key="dayOfWeek"
              class="border border-default rounded-md p-2 min-h-[100px] bg-default hover:bg-muted/5 transition-colors cursor-pointer"
              @click="emit('addMeal', dayOfWeek - 1, mealType)"
            >
              <div class="space-y-1">
                <div
                  v-for="meal in mealGrid[dayOfWeek - 1]?.[mealType] || []"
                  :key="meal.id"
                  class="relative text-sm bg-primary/10 hover:bg-primary/20 rounded px-2 py-1 transition-colors cursor-pointer"
                  @click.stop="emit('editMeal', meal)"
                >
                  <div class="font-medium truncate">
                    {{ meal.name }}
                  </div>
                  <div v-if="meal.daysInAdvance > 0" class="text-xs text-muted">
                    Prep: {{ meal.daysInAdvance }}d before
                  </div>

                  <!-- Pending sync indicator -->
                  <div
                    v-if="(meal as any)._isPending"
                    class="absolute top-1 right-1 w-2 h-2 bg-yellow-500 rounded-full"
                    title="Waiting to sync"
                  />
                </div>

                <div v-if="(mealGrid[dayOfWeek - 1]?.[mealType]?.length || 0) === 0" class="text-xs text-muted text-center py-2">
                  + Add meal
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Accordion transitions */
.accordion-enter-active,
.accordion-leave-active {
  transition:
    height 0.3s ease,
    opacity 0.3s ease;
  overflow: hidden;
}

/* Inline form slide-fade transitions */
.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.2s ease-in;
}

.slide-fade-enter-from {
  transform: translateY(-10px);
  opacity: 0;
}

.slide-fade-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}
</style>
