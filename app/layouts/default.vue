<script setup lang="ts">
import GlobalSideBar from "~/components/global/globalSideBar.vue";
</script>

<template>
  <div class="flex min-h-screen">
    <GlobalSideBar />
    <div class="flex flex-col flex-1">
      <div class="flex-1">
        <slot />
      </div>
    </div>
  </div>
</template>
