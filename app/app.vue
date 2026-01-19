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
    <!-- Letterbox container - centers the 16:9 app container -->
    <div class="app-letterbox">
      <!-- Main app container with 16:9 aspect ratio -->
      <div class="app-container-16-9">
        <GlobalAppLoading :is-loading="isLoading" :loading-message="loadingMessage || ''" />

        <NuxtLayout>
          <div v-if="dock" class="flex h-full">
            <div class="flex flex-col flex-1">
              <div class="flex-1">
                <NuxtPage />
              </div>
              <GlobalDock />
            </div>
          </div>
          <NuxtPage v-else />
        </NuxtLayout>
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

/* Letterbox container - black background for bars */
.app-letterbox {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #000;
  overflow: hidden;
}

/* 16:9 aspect ratio container */
.app-container-16-9 {
  position: relative;
  width: 100%;
  height: 100%;
  max-width: calc(100vh * (16 / 9));
  max-height: calc(100vw * (9 / 16));
  background-color: var(--ui-bg-default, #ffffff);
  overflow: hidden;
}

/* Dark mode support for letterbox */
.dark .app-letterbox {
  background-color: #000;
}

.dark .app-container-16-9 {
  background-color: var(--ui-bg-default, #141f38);
}
</style>
