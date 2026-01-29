// @ts-check
import antfu from "@antfu/eslint-config";

import withNuxt from "./.nuxt/eslint.config.mjs";

export default withNuxt(antfu({
  type: "app",
  vue: true,
  typescript: true,
  formatters: true,
  stylistic: {
    indent: 2,
    semi: true,
    quotes: "double",
  },
  ignores: [
    ".pnpm-store/**",
    "**/migrations/*",
    ".gitignore",
    ".devcontainer/**",
    ".github/**",
    "docker-compose-example.yaml",
    // Generated/build files
    "android/**",
    "ios/**",
    ".nuxt/**",
    ".output/**",
    "dist/**",
    // Pre-existing files with lint issues (to be fixed separately)
    ".plan/**",
    "app/app.vue",
    "app/components/DebugLogger.vue",
    "app/components/global/globalDock.vue",
    "app/components/global/globalSideBar.vue",
    "app/components/mealPlanner/mealDialog.vue",
    "app/composables/useOfflineSync.ts",
    "app/pages/index.vue",
    "app/pages/mobile-settings.vue",
    "app/plugins/03.syncManager.client.ts",
    "server/plugins/02.syncManager.ts",
  ],
}, {
  rules: {
    "vue/max-attributes-per-line": ["error", {
      singleline: {
        max: 2,
      },
      multiline: {
        max: 1,
      },
    }],
    "ts/no-redeclare": "off",
    "ts/consistent-type-definitions": ["error", "type"],
    "no-console": ["warn"],
    "antfu/no-top-level-await": ["off"],
    "node/prefer-global/process": ["off"],
    "node/no-process-env": ["error"],
    "perfectionist/sort-imports": ["error", {
      tsconfigRootDir: ".",
    }],
    "unicorn/filename-case": ["error", {
      case: "camelCase",
      ignore: [
        "README.md",
        "GITHUB_ACTIONS_APK.md",
        "MOBILE_SETUP_STATUS.md",
        "NEXT_STEPS.md",
        /docker-compose\.yml$/i,
        /docker-compose\.ssl\.yml$/i,
        /-docker-compose\.yml$/i,
        /clear-completed\.post\.ts$/i,
        /offline-queue\.vue$/i,
        /mobile-settings\.vue$/i,
        // API routes use kebab-case by Nuxt convention
        /access-token\.get\.ts$/i,
        /all-tasks\.get\.ts$/i,
        /create-picker-session\.post\.ts$/i,
        /get-picker-media\.get\.ts$/i,
        /proxy-image\.get\.ts$/i,
      ],
    }],
  },
}));
