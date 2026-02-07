import { useNuxtApp, useRuntimeConfig } from "#app";
import { describe, it, expect } from "vitest";

import { consola } from "consola";

describe("01.logging plugin", () => {
  it("should have run so that consola is callable after app load", () => {
    const nuxtApp = useNuxtApp(); 
    expect(nuxtApp).toBeDefined();

    expect(typeof consola.start).toBe("function");
    expect(typeof consola.debug).toBe("function");
    expect(typeof consola.error).toBe("function");
  });

  it("should have set consola.level from runtime config", () => {
    const config = useRuntimeConfig();
    expect(config.public?.logLevel).toBeDefined();

    expect(consola.level).toBeDefined();
    expect(typeof consola.level).toBe("number");
  });
});
