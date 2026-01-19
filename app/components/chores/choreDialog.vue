<script setup lang="ts">
const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "created"): void;
}>();

type User = {
  id: string;
  name: string;
  avatar: string | null;
};

const { showError, showSuccess } = useAlertToast();

const name = ref("");
const description = ref("");
const pointValue = ref(10);
const recurrence = ref("NONE");
const assignedUserId = ref<string | null>(null);
const dueDate = ref<string | null>(null);
const icon = ref<string | null>(null);

const error = ref<string | null>(null);
const isSubmitting = ref(false);

const users = ref<User[]>([]);

const recurrenceOptions = [
  { value: "NONE", label: "One-time" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
];

async function fetchUsers() {
  try {
    const data = await $fetch<User[]>("/api/users");
    users.value = data;
  }
  catch {
    // silently fail
  }
}

function resetForm() {
  name.value = "";
  description.value = "";
  pointValue.value = 10;
  recurrence.value = "NONE";
  assignedUserId.value = null;
  dueDate.value = null;
  icon.value = null;
  error.value = null;
  isSubmitting.value = false;
}

async function handleSave() {
  // Client-side validation
  if (!name.value.trim()) {
    error.value = "Chore name is required";
    return;
  }

  if (pointValue.value < 0) {
    error.value = "Point value must be a positive number";
    return;
  }

  try {
    isSubmitting.value = true;
    error.value = null;

    await $fetch("/api/chores", {
      method: "POST",
      body: {
        name: name.value.trim(),
        description: description.value.trim() || undefined,
        pointValue: pointValue.value,
        recurrence: recurrence.value,
        assignedUserId: assignedUserId.value || undefined,
        dueDate: dueDate.value || undefined,
        icon: icon.value || undefined,
      },
    });

    showSuccess("Chore Created", `"${name.value}" has been created.`);
    resetForm();
    emit("created");
    emit("close");
  }
  catch (err: unknown) {
    const fetchError = err as { data?: { message?: string } };
    error.value = fetchError.data?.message || "Failed to create chore";
    showError("Error", error.value);
  }
  finally {
    isSubmitting.value = false;
  }
}

function handleClose() {
  resetForm();
  emit("close");
}

watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    fetchUsers();
  }
});
</script>

<template>
  <UModal :open="isOpen" @update:open="(val) => !val && handleClose()">
    <template #content>
      <UCard class="w-full max-w-[425px] mx-4">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">
              Create Chore
            </h3>
            <UButton
              icon="i-lucide-x"
              variant="ghost"
              color="neutral"
              size="sm"
              aria-label="Close"
              @click="handleClose"
            />
          </div>
        </template>

        <div class="space-y-4 overflow-y-auto max-h-[60vh]">
          <div
            v-if="error"
            role="alert"
            class="bg-error/10 text-error rounded-md px-3 py-2 text-sm"
          >
            {{ error }}
          </div>

          <UFormField label="Name" required>
            <UInput
              v-model="name"
              placeholder="Chore name"
              :class="{ 'border-error': error && !name.trim() }"
            />
          </UFormField>

          <UFormField label="Description">
            <UTextarea
              v-model="description"
              placeholder="Optional description"
              :rows="2"
            />
          </UFormField>

          <UFormField label="Point Value" required>
            <UInput
              v-model.number="pointValue"
              type="number"
              :min="1"
            />
          </UFormField>

          <UFormField label="Recurrence">
            <USelect
              v-model="recurrence"
              :items="recurrenceOptions"
              option-attribute="label"
              value-attribute="value"
            />
          </UFormField>

          <UFormField label="Assign To">
            <USelect
              v-model="assignedUserId"
              :items="[{ id: null, name: 'Anyone (open)' }, ...users]"
              option-attribute="name"
              value-attribute="id"
              placeholder="Anyone can claim"
            />
          </UFormField>

          <UFormField v-if="recurrence === 'NONE'" label="Due Date">
            <UInput
              v-model="dueDate"
              type="date"
            />
          </UFormField>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" @click="handleClose">
              Cancel
            </UButton>
            <UButton
              color="primary"
              :loading="isSubmitting"
              :disabled="isSubmitting"
              @click="handleSave"
            >
              Create Chore
            </UButton>
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
