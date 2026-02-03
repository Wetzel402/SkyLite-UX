import { createTest, exposeContextToEnv } from "@nuxt/test-utils/e2e";

import { cleanupE2eDb } from "./cleanupDb";

const options = JSON.parse(process.env.NUXT_TEST_OPTIONS || "{}");
const defaultOptions = {
  rootDir: process.cwd(),
  setupTimeout: 300_000,
  browser: false,
};
const merged = { ...defaultOptions, ...options };
const hooks = createTest(merged);

export async function setup() {
  await hooks.beforeAll();
  exposeContextToEnv();
}

export async function teardown() {
  await hooks.afterAll();
  await cleanupE2eDb();
}
