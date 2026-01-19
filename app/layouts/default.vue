<script setup lang="ts">
import GlobalSideBar from "~/components/global/globalSideBar.vue";
</script>

<template>
  <div class="flex h-full">
    <GlobalSideBar />
    <div class="flex flex-col flex-1 overflow-hidden">
      <div class="flex-1 overflow-auto">
        <slot />
      </div>
    </div>
  </div>
</template>
