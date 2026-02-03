import { describe, it, expect, afterEach } from "vitest";

const globalKey = "__TIMEZONE_SERVICE_READY__" as const;
const g = globalThis as { [K in typeof globalKey]?: boolean };

import {
  isTimezoneServiceReady,
  setTimezoneServiceReady,
} from "~/types/global";

describe("global", () => {
  afterEach(() => {
    delete g[globalKey];
  });

  describe("isTimezoneServiceReady", () => {
    it("returns true after setTimezoneServiceReady(true)", () => {
      delete g[globalKey];
      setTimezoneServiceReady(true);
      expect(isTimezoneServiceReady()).toBe(true);
    });

    it("returns false after setTimezoneServiceReady(false)", () => {
      setTimezoneServiceReady(false);
      expect(isTimezoneServiceReady()).toBe(false);
    });
  });
});
