import { useToast as useNuxtToast } from "#imports";

import type { ToastType } from "~/types/ui";

export function useAlertToast() {
  const nuxtToast = useNuxtToast();

  const getAlertIcon = (type: ToastType): string => {
    switch (type) {
      case "error":
        return "i-lucide-x-circle";
      case "warning":
        return "i-lucide-alert-triangle";
      case "success":
        return "i-lucide-check-circle";
      case "info":
        return "i-lucide-info";
      default:
        return "i-lucide-x-circle";
    }
  };

  const getAlertColor = (
    type: ToastType,
  ):
    | "error"
    | "warning"
    | "success"
    | "info"
    | "primary"
    | "secondary"
    | "neutral" => {
    switch (type) {
      case "error":
        return "error";
      case "warning":
        return "warning";
      case "success":
        return "success";
      case "info":
        return "info";
      default:
        return "error";
    }
  };

  const showAlert = (
    title: string,
    description?: string,
    type: ToastType = "error",
    duration?: number,
  ) => {
    const icon = getAlertIcon(type);
    const color = getAlertColor(type);

    nuxtToast.add({
      title,
      description,
      icon,
      color,
      duration: duration ?? 5000,
    });
  };

  const showError = (
    title: string,
    description?: string,
    duration?: number,
  ) => {
    showAlert(title, description, "error", duration);
  };

  const showWarning = (
    title: string,
    description?: string,
    duration?: number,
  ) => {
    showAlert(title, description, "warning", duration);
  };

  const showSuccess = (
    title: string,
    description?: string,
    duration?: number,
  ) => {
    showAlert(title, description, "success", duration);
  };

  const showInfo = (title: string, description?: string, duration?: number) => {
    showAlert(title, description, "info", duration);
  };

  return {
    showAlert,
    showError,
    showWarning,
    showSuccess,
    showInfo,
  };
}
