import { describe, it, expect } from "vitest";

import { integrationServices } from "../../../../app/plugins/02.appInit";
import { getBrowserTimezone, isTimezoneRegistered } from "~/types/global";

describe("02.appInit plugin", () => {
  it("should export integrationServices as a Map", () => {
    expect(integrationServices).toBeInstanceOf(Map);
  });

  it("should have run so that timezone state is set or app booted", () => {
    const nuxtApp = useNuxtApp();
    expect(nuxtApp).toBeDefined();

    expect(typeof getBrowserTimezone).toBe("function");
    expect(typeof isTimezoneRegistered).toBe("function");
    const tz = getBrowserTimezone();
    const registered = isTimezoneRegistered();
    expect(typeof registered).toBe("boolean");
    if (registered) {
      expect(tz).toBeDefined();
      expect(typeof tz).toBe("string");
    }
  });

  it("should allow integrationServices to store and retrieve by id", () => {
    const testId = "test-integration-service-id";
    const mockService = {
      initialize: () => Promise.resolve(),
      validate: () => Promise.resolve(true),
      getStatus: () => Promise.resolve({ isConnected: true, lastChecked: new Date() }),
    };
    integrationServices.set(testId, mockService as Parameters<typeof integrationServices.set>[1]);
    expect(integrationServices.get(testId)).toBe(mockService);
    integrationServices.delete(testId);
    expect(integrationServices.has(testId)).toBe(false);
  });
});
