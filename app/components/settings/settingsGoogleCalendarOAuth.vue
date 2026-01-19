<script setup lang="ts">
const isLoading = ref(false);

async function initiateOAuth() {
  isLoading.value = true;
  // Redirect to OAuth authorization endpoint
  window.location.href = "/api/integrations/google-calendar/oauth/authorize";
}
</script>

<template>
  <div class="space-y-4">
    <UAlert
      color="info"
      variant="soft"
      title="Connect to Google Calendar"
      description="You'll be redirected to Google to authorize SkyLite to access your calendars."
    />

    <UButton
      color="primary"
      :loading="isLoading"
      block
      @click="initiateOAuth"
    >
      Connect with Google
    </UButton>
  </div>
</template>
