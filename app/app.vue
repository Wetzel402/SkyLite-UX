<script setup lang="ts">
import GlobalAppLoading from "~/components/global/globalAppLoading.vue";
import GlobalDock from "~/components/global/globalDock.vue";
import GlobalSideBar from "~/components/global/globalSideBar.vue";

const dock = false;
const { isLoading, loadingMessage, setLoading } = useGlobalLoading();

// @ts-ignore - Capacitor is added via script tag in Capacitor builds
const isCapacitor = typeof window !== "undefined" && "Capacitor" in window;

setLoading(true);

onNuxtReady(() => {
  setLoading(false);
});
</script>

<template>
  <UApp>
    <GlobalAppLoading :is-loading="isLoading" :loading-message="loadingMessage || ''" />

    <div v-if="!dock" class="flex min-h-screen">
      <GlobalSideBar />
      <div class="flex flex-col flex-1">
        <div class="flex-1">
          <NuxtPage />
        </div>
      </div>
    </div>
    <div v-else class="flex min-h-screen">
      <div class="flex flex-col flex-1">
        <div class="flex-1">
          <NuxtPage />
        </div>
        <GlobalDock />
      </div>
    </div>
  </UApp>
</template>

<style>
/* Hide scrollbars globally */
* {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

*::-webkit-scrollbar {
  display: none;
}
</style>
