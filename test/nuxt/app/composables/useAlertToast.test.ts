import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockNuxtImport } from "@nuxt/test-utils/runtime";

import type { ToastType } from "~/types/ui";

const { mockAdd } = vi.hoisted(() => ({
  mockAdd: vi.fn(),
}));

mockNuxtImport("useToast", () => () => ({ add: mockAdd }));

import { useAlertToast } from "../../../../app/composables/useAlertToast";

describe("useAlertToast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call add with error icon and color for showError", () => {
    const { showError } = useAlertToast();
    showError("Error title", "Error description");
    expect(mockAdd).toHaveBeenCalledWith({
      title: "Error title",
      description: "Error description",
      icon: "i-lucide-x-circle",
      color: "error",
      duration: 5000,
    });
  });

  it("should call add with warning icon and color for showWarning", () => {
    const { showWarning } = useAlertToast();
    showWarning("Warning");
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Warning",
        icon: "i-lucide-alert-triangle",
        color: "warning",
      }),
    );
  });

  it("should call add with success icon and color for showSuccess", () => {
    const { showSuccess } = useAlertToast();
    showSuccess("Done");
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Done",
        icon: "i-lucide-check-circle",
        color: "success",
      }),
    );
  });

  it("should call add with info icon and color for showInfo", () => {
    const { showInfo } = useAlertToast();
    showInfo("Info");
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Info",
        icon: "i-lucide-info",
        color: "info",
      }),
    );
  });

  it("should pass custom duration to add", () => {
    const { showError } = useAlertToast();
    showError("Title", "Desc", 3000);
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({ duration: 3000 }),
    );
  });

  it("should use default duration when not provided", () => {
    const { showAlert } = useAlertToast();
    showAlert("Title", undefined, "error");
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({ duration: 5000 }),
    );
  });

  it("should use default icon and color for unknown toast type", () => {
    const { showAlert } = useAlertToast();
    showAlert("Title", undefined, "other" as ToastType);
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        icon: "i-lucide-x-circle",
        color: "error",
      }),
    );
  });
});
