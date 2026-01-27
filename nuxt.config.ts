// https://nuxt.com/docs/api/configuration/nuxt-config
import pkg from "./package.json";

export default defineNuxtConfig({
  // Disable SSR only for Capacitor builds, enable for web
  // eslint-disable-next-line node/no-process-env
  ssr: process.env.CAPACITOR_BUILD !== "true",

  devtools: {
    enabled: true,
  },

  // Disable experimental features for Capacitor builds
  experimental: {
    // Disable payload extraction to prevent preload errors
    payloadExtraction: false,
  },

  // Route rules to prevent preloading errors in Capacitor
  routeRules: {
    "/mealPlanner": { prerender: false },
    "/mobile-settings": { prerender: false },
    "/home": { prerender: false },
  },

  runtimeConfig: {
    // Server-only config (not exposed to client)
    // Can be overridden by NUXT_GOOGLE_CLIENT_ID and NUXT_GOOGLE_CLIENT_SECRET env vars
    // Also supports GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET for backwards compatibility
    googleClientId: "",
    googleClientSecret: "",
    // Database URL - can be overridden by NUXT_DATABASE_URL or DATABASE_URL env vars
    // docker-entrypoint.sh exports DATABASE_URL, Nuxt auto-reads NUXT_DATABASE_URL
    // eslint-disable-next-line node/no-process-env
    databaseUrl: process.env.NUXT_DATABASE_URL || process.env.DATABASE_URL || "",
    public: {
      skyliteVersion: pkg.version,
      nuxtVersion: pkg.devDependencies.nuxt,
      nuxtUiVersion: pkg.dependencies["@nuxt/ui"],
      // consola log level. See https://github.com/unjs/consola/blob/main/src/constants.ts
      logLevel: "info", // Default log level, can be overridden by NUXT_PUBLIC_LOG_LEVEL env var
      tz: "America/Chicago", // Default timezone, can be overridden by NUXT_PUBLIC_TZ env var
    },
  },

  modules: ["@nuxt/ui", "@nuxt/eslint", "@nuxtjs/html-validator", "@vite-pwa/nuxt"],

  pwa: {
    registerType: "autoUpdate",
    manifest: {
      name: "SkyLite UX",
      short_name: "SkyLite",
      description: "Family hub for calendar, todos, meals, and shopping",
      theme_color: "#0ea5e9",
      background_color: "#ffffff",
      display: "standalone",
      start_url: "/",
      icons: [
        {
          src: "/skylite-192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/skylite-512.png",
          sizes: "512x512",
          type: "image/png",
        },
      ],
    },
    workbox: {
      navigateFallback: "/",
      globPatterns: ["**/*.{js,css,html,png,svg,ico}"],
      runtimeCaching: [
        {
          urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
          handler: "CacheFirst",
          options: {
            cacheName: "google-fonts-cache",
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
            },
          },
        },
        {
          urlPattern: /\/api\/meal-plans\/.*/i,
          handler: "NetworkFirst",
          options: {
            cacheName: "api-meal-plans",
            networkTimeoutSeconds: 10,
            expiration: {
              maxEntries: 50,
              maxAgeSeconds: 60 * 60, // 1 hour
            },
          },
        },
      ],
    },
    devOptions: {
      enabled: true,
      type: "module",
    },
  },

  components: {
    dirs: [
      {
        path: "~/components",
        pathPrefix: false,
        // work around to fix global components not being in their own chunk
        // /app/app/components/global/globalAppLoading.vue is dynamically imported by /app/app/components/global/globalAppLoading.vue?nuxt_component=async&nuxt_component_name=GlobalAppLoading&nuxt_component_export=default but also statically imported by /app/app/app.vue?vue&type=script&setup=true&lang.ts, dynamic import will not move module into another chunk.
        ignore: ["**/global/globalAppLoading.vue", "**/global/globalSideBar.vue", "**/global/globalDock.vue"],
      },
    ],
  },

  app: {
    head: {
      htmlAttrs: {
        lang: "en",
      },
      title: "SkyLite UX",
    },
  },

  htmlValidator: {
    logLevel: "warning",
    failOnError: false,
    options: {
      extends: [
        "html-validate:document",
        "html-validate:recommended",
      ],
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
      include: [
        "date-fns",
        "@internationalized/date",
      ],
    },
  },

  css: ["~/assets/css/main.css"],

  nitro: {
    // Disable server plugins during static generation to prevent hanging
    // setInterval in syncManager keeps process alive during 'nuxt generate'
    // eslint-disable-next-line node/no-process-env
    plugins: process.env.CAPACITOR_BUILD === "true"
      ? []
      : [
          "../server/plugins/01.logging.ts",
          "../server/plugins/02.syncManager.ts",
        ],
  },

  plugins: [
    "~/plugins/01.logging.ts",
    // Disable appInit for Capacitor builds - it tries to fetch from /api/* which doesn't exist in static builds
    // eslint-disable-next-line node/no-process-env
    ...(process.env.CAPACITOR_BUILD !== "true" ? ["~/plugins/02.appInit.ts"] : []),
    // Disable syncManager for Capacitor builds - it tries to connect to /api/sync/events via EventSource
    // eslint-disable-next-line node/no-process-env
    ...(process.env.CAPACITOR_BUILD !== "true" ? ["~/plugins/03.syncManager.client.ts"] : []),
  ],

  future: {
    compatibilityVersion: 4,
  },

  compatibilityDate: "2024-11-27",
});
