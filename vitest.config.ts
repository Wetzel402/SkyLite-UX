import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "tests/",
        "*.config.*",
        ".nuxt/",
        "android/",
        "docs/",
      ],
    },
    // Exit with error if no tests are found
    passWithNoTests: false,
  },
  resolve: {
    alias: {
      // Map ~/lib/prisma to app/lib/prisma (Nuxt's app directory convention)
      "~/lib/prisma": fileURLToPath(new URL("./app/lib/prisma.ts", import.meta.url)),
      "~/server/utils/holidayCache": fileURLToPath(new URL("./server/utils/holidayCache.ts", import.meta.url)),
      // Generic aliases for ~ and @ (Nuxt convention with app/ directory)
      "~/": fileURLToPath(new URL("./app/", import.meta.url)),
      "@/": fileURLToPath(new URL("./app/", import.meta.url)),
      "~": fileURLToPath(new URL("./app/", import.meta.url)),
      "@": fileURLToPath(new URL("./app/", import.meta.url)),
    },
  },
});
