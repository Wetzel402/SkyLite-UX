<script setup lang="ts">
const props = defineProps<{
  isOpen: boolean;
  title?: string;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "verified"): void;
}>();

const pin = ref("");
const error = ref("");
const isVerifying = ref(false);

const pinInput = ref<HTMLInputElement | null>(null);

watch(() => props.isOpen, (open) => {
  if (open) {
    pin.value = "";
    error.value = "";
    isVerifying.value = false;
    nextTick(() => {
      pinInput.value?.focus();
    });
  }
});

async function handleVerify() {
  if (!pin.value) {
    error.value = "Please enter a PIN";
    return;
  }

  isVerifying.value = true;
  error.value = "";

  try {
    const result = await $fetch<{ valid: boolean }>("/api/household/verifyPin", {
      method: "POST",
      body: { pin: pin.value },
    });

    if (result.valid) {
      emit("verified");
      emit("close");
    }
    else {
      error.value = "Incorrect PIN";
      pin.value = "";
      pinInput.value?.focus();
    }
  }
  catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Verification failed";
    if (errorMessage.includes("No parent PIN")) {
      // No PIN set - allow access
      emit("verified");
      emit("close");
    }
    else {
      error.value = errorMessage;
    }
  }
  finally {
    isVerifying.value = false;
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Enter") {
    handleVerify();
  }
}
</script>

<template>
  <UModal
    :open="isOpen"
    @update:open="$emit('close')"
  >
    <template #content>
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-highlighted">
            {{ title || "Parent Verification Required" }}
          </h3>
          <UButton
            variant="ghost"
            size="sm"
            icon="i-lucide-x"
            aria-label="Close"
            @click="$emit('close')"
          />
        </div>

        <p class="text-muted mb-4">
          Enter the parent PIN to access this section.
        </p>

        <div class="space-y-4">
          <UFormField label="PIN" :error="error">
            <UInput
              ref="pinInput"
              v-model="pin"
              type="password"
              placeholder="Enter PIN"
              :disabled="isVerifying"
              autocomplete="off"
              @keydown="handleKeydown"
            />
          </UFormField>

          <div class="flex gap-2 justify-end">
            <UButton
              variant="ghost"
              :disabled="isVerifying"
              @click="$emit('close')"
            >
              Cancel
            </UButton>
            <UButton
              :loading="isVerifying"
              @click="handleVerify"
            >
              Verify
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
