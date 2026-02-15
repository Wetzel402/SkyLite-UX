<script setup lang="ts">
import { MAIN_VIEW_OPTIONS } from "~/types/ui";

// TODO: Authenticate user or route to login page
const { preferences } = useClientPreferences();
const allowedPaths = MAIN_VIEW_OPTIONS.map(o => o.path);
const target = preferences.value?.defaultView ?? "/calendar";
const resolved = allowedPaths.includes(target) ? target : "/calendar";
if (import.meta.client) {
  await navigateTo(resolved);
}
</script>

<template>
  <div>
    <p>Redirecting...</p>
  </div>
</template>
