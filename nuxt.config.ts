// https://nuxt.com/docs/api/configuration/nuxt-config
import pkg from "./package.json";

export default defineNuxtConfig({
  devtools: {
    enabled: true,
  },

  runtimeConfig: {
    public: {
      skyliteVersion: pkg.version,
      nuxtVersion: pkg.devDependencies.nuxt,
      nuxtUiVersion: pkg.dependencies["@nuxt/ui"],
      // consola log level. See https://github.com/unjs/consola/blob/main/src/constants.ts
      logLevel: "info", // Default log level, can be overridden by NUXT_PUBLIC_LOG_LEVEL env var
      tz: "America/Chicago", // Default timezone, can be overridden by NUXT_PUBLIC_TZ env var
    },
  },

  modules: [
    "@nuxt/ui",
    "@nuxt/fonts",
    "@nuxt/eslint",
    "@nuxtjs/html-validator",
    "@nuxt/test-utils/module",
  ],

  fonts: {
    families: [
      {
        name: "Inclusive Sans",
        provider: "google",
        global: true,
      },
      {
        name: "Noto Sans",
        provider: "google",
        global: true,
      },
      {
        name: "EB Garamond",
        provider: "google",
        global: true,
      },
      {
        name: "IBM Plex Mono",
        provider: "google",
        global: true,
      },
      {
        name: "Ovo",
        provider: "google",
        global: true,
      },
      {
        name: "Handlee",
        provider: "google",
        global: true,
      },
    ],
  },

  components: {
    dirs: [
      {
        path: "~/components",
        pathPrefix: false,
        // work around to fix global components not being in their own chunk
        // /app/app/components/global/globalAppLoading.vue is dynamically imported by /app/app/components/global/globalAppLoading.vue?nuxt_component=async&nuxt_component_name=GlobalAppLoading&nuxt_component_export=default but also statically imported by /app/app/app.vue?vue&type=script&setup=true&lang.ts, dynamic import will not move module into another chunk.
        ignore: [
          "**/global/globalAppLoading.vue",
          "**/global/globalSideBar.vue",
          "**/global/globalDock.vue",
        ],
      },
    ],
  },

  app: {
    baseURL: "/",
    head: {
      htmlAttrs: {
        lang: "en",
      },
      title: "Skylite UX",
    },
  },

  htmlValidator: {
    logLevel: "warning",
    failOnError: false,
    options: {
      extends: ["html-validate:document", "html-validate:recommended"],
      rules: {
        "no-unknown-elements": "error",
        "element-permitted-content": "error",
        "no-implicit-button-type": "error",
        "no-dup-class": "off",
        "wcag/h30": "off",
        "no-redundant-role": "off",
        "element-required-attributes": "off",
        "element-required-content": "off",
        "valid-id": "off",
        "no-missing-references": "off",
        "prefer-native-element": "off",
        "void-style": "off",
        "no-trailing-whitespace": "off",
        "require-sri": "off",
        "attribute-boolean-style": "off",
        "doctype-style": "off",
        "no-inline-style": "off",
      },
    },
  },

  eslint: {
    config: {
      standalone: false,
    },
  },

  vite: {
    optimizeDeps: {
      include: ["date-fns", "@internationalized/date"],
    },
  },

  css: ["~/assets/css/main.css"],

  nitro: {
    plugins: [
      "../server/plugins/01.logging.ts",
      "../server/plugins/02.syncManager.ts",
    ],
  },

  plugins: [
    "~/plugins/01.logging.ts",
    "~/plugins/02.appInit.ts",
    "~/plugins/03.syncManager.client.ts",
    "~/plugins/04.clientPreferences.client.ts",
  ],

  future: {
    compatibilityVersion: 4,
  },

  compatibilityDate: "2024-11-27",
});
