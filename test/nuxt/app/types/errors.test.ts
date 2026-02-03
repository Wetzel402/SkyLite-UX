import { describe, it, expect } from "vitest";

import { isApiError, isGoogleApiError } from "~/types/errors";

describe("errors", () => {
  describe("isApiError", () => {
    it("returns true for object with code", () => {
      expect(isApiError({ code: 1 })).toBe(true);
    });

    it("returns true for object with message", () => {
      expect(isApiError({ message: "x" })).toBe(true);
    });

    it("returns true for object with response", () => {
      expect(isApiError({ response: {} })).toBe(true);
    });

    it("returns false for null", () => {
      expect(isApiError(null)).toBe(false);
    });

    it("returns false for string", () => {
      expect(isApiError("string")).toBe(false);
    });

    it("returns false for object without code, message, or response", () => {
      expect(isApiError({})).toBe(false);
    });
  });

  describe("isGoogleApiError", () => {
    it("returns true when isApiError would return true", () => {
      expect(isGoogleApiError({ code: 1 })).toBe(true);
      expect(isGoogleApiError({ message: "x" })).toBe(true);
      expect(isGoogleApiError({ response: {} })).toBe(true);
    });

    it("returns false when isApiError would return false", () => {
      expect(isGoogleApiError(null)).toBe(false);
      expect(isGoogleApiError("string")).toBe(false);
      expect(isGoogleApiError({})).toBe(false);
    });
  });
});
