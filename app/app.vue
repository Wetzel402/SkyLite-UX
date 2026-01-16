<script setup lang="ts">
import GlobalAppLoading from "~/components/global/globalAppLoading.vue";
import GlobalDock from "~/components/global/globalDock.vue";

const dock = false;
const { isLoading, loadingMessage, setLoading } = useGlobalLoading();

setLoading(true);

onNuxtReady(() => {
  setLoading(false);
});
</script>

<template>
  <UApp>
    <GlobalAppLoading :is-loading="isLoading" :loading-message="loadingMessage || ''" />

    <NuxtLayout>
      <div v-if="dock" class="flex min-h-screen">
        <div class="flex flex-col flex-1">
          <div class="flex-1">
            <NuxtPage />
          </div>
          <GlobalDock />
        </div>
      </div>
      <NuxtPage v-else />
    </NuxtLayout>
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
