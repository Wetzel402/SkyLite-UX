import { defineVitestProject } from "@nuxt/test-utils/config";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: ["app/**", "server/**"],
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/.nuxt/**",
        "**/coverage/**",
        "**/*.config.*",
        "**/nuxt.config.*",
        "**/vitest.config.*",
        "**/tsconfig*.json",
        "docs/**",
        "**/*.d.ts",
        "**/__mocks__/**",
        "**/test/**",
        "app/lib/prisma.ts",
        "app/types/calendar.ts",
        "app/types/database.ts",
        "app/types/forms.ts",
        "app/types/recurrence.ts",
        "app/types/sync.ts",
        "app/types/ui.ts",
        "app/integrations/**/types.ts",
        "server/integrations/**/types.ts",
        "server/integrations/**/index.ts",
        "server/plugins/01.logging.ts",
      ],
    },
    projects: [
      {
        test: {
          name: "unit",
          include: ["test/unit/**/*.{test,spec}.ts"],
          environment: "node",
        },
      },
      await defineVitestProject({
        test: {
          name: "nuxt",
          include: ["test/nuxt/**/*.{test,spec}.ts"],
          environment: "nuxt",
          setupFiles: ["./test/nuxt/setup-global.ts"],
          environmentOptions: {
            nuxt: {
              mock: {
                intersectionObserver: true,
                indexedDb: true,
              },
            },
          },
        },
      }),
      {
        test: {
          name: "e2e",
          include: ["test/e2e/**/*.{test,spec}.ts"],
          environment: "node",
          testTimeout: 60_000,
          hookTimeout: 180_000,
          pool: "forks",
          globalSetup: ["./test/e2e/globalSetup.ts"],
          setupFiles: ["./test/e2e/setup.ts"],
        },
      },
    ],
  },
});
