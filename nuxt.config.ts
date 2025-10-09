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
      enableKioskMode: process.env.ENABLE_KIOSK_MODE === 'true', // Kiosk mode toggle
    },
  },

  modules: ["@nuxt/ui", "@nuxt/eslint", "@nuxtjs/html-validator"],

  app: {
    head: {
      htmlAttrs: {
        lang: "en",
      },
      title: "SkyLite UX",
      link: [
        { rel: 'manifest', href: '/manifest.json' },
        { rel: 'icon', href: '/skylite.svg', type: 'image/svg+xml' }
      ],
      meta: [
        { name: 'theme-color', content: '#3B82F6' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'apple-mobile-web-app-title', content: 'SkyLite-UX' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no' }
      ]
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
    plugins: [
      "../server/plugins/01.logging.ts",
      "../server/plugins/01.sources-bootstrap.ts",
      "../server/plugins/02.syncManager.ts",
      "../server/plugins/03.persistentSync.ts",
    ],
  },

  plugins: [
    "~/plugins/01.logging.ts",
    "~/plugins/02.appInit.ts",
    "~/plugins/03.syncManager.client.ts",
    "~/plugins/04.pwa.client.ts",
  ],

  future: {
    compatibilityVersion: 4,
  },

  compatibilityDate: "2024-11-27",
});
