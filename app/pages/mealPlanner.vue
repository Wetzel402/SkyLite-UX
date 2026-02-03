<template>
  <div class="flex w-full flex-col rounded-lg">
    <div
      class="py-5 sm:px-4 sticky top-0 z-40 bg-default border-b border-default"
    >
      <GlobalDateHeader />
    </div>
    <div class="flex flex-col items-center justify-center gap-4 h-screen">
      <h1 class="font-bold text-2xl text-(--ui-primary)">Meal Planner</h1>

      <div class="flex items-center gap-2">
        <UButton
          label="Documentation"
          icon="i-lucide-square-play"
          to="https://ui.nuxt.com/getting-started/installation/nuxt"
          target="_blank"
        />

        <UButton
          label="GitHub"
          color="neutral"
          variant="outline"
          icon="i-simple-icons-github"
          to="https://github.com/nuxt/ui"
          target="_blank"
        />
      </div>
    </div>
  </div>
</template>
