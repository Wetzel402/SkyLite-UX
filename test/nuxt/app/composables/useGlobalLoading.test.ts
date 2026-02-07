import { describe, it, expect, beforeEach } from "vitest";

import { useGlobalLoading } from "../../../../app/composables/useGlobalLoading";

describe("useGlobalLoading", () => {
  beforeEach(() => {
    const { setLoading, setMessage } = useGlobalLoading();
    setLoading(true);
    setMessage("Loading...");
  });

  it("should have loading state", () => {
    const { isLoading } = useGlobalLoading();
    expect(isLoading.value).toBe(true);
  });

  it("should have loading message", () => {
    const { loadingMessage } = useGlobalLoading();
    expect(typeof loadingMessage.value).toBe("string");
  });

  it("should set loading to false", () => {
    const { setLoading, isLoading } = useGlobalLoading();
    setLoading(false);
    expect(isLoading.value).toBe(false);
  });

  it("should set loading to true", () => {
    const { setLoading, isLoading } = useGlobalLoading();
    setLoading(false);
    setLoading(true);
    expect(isLoading.value).toBe(true);
  });

  it("should set message", () => {
    const { setMessage, loadingMessage } = useGlobalLoading();
    setMessage("Custom message");
    expect(loadingMessage.value).toBe("Custom message");
  });

  it("should set loading state and message together", () => {
    const { setLoadingState, isLoading, loadingMessage } = useGlobalLoading();
    setLoadingState(false, "Ready");
    expect(isLoading.value).toBe(false);
    expect(loadingMessage.value).toBe("Ready");
  });

  it("should set only loading when setLoadingState called without message", () => {
    const { setMessage, setLoadingState, isLoading, loadingMessage } =
      useGlobalLoading();
    setMessage("Initial");
    setLoadingState(true);
    expect(isLoading.value).toBe(true);
    expect(loadingMessage.value).toBe("Initial");
  });
});
