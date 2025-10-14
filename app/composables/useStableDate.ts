export function useStableDate() {
  const stableDate = useState<Date>("global-stable-date", () => new Date());

  const getStableDate = () => stableDate.value;

  const parseStableDate = (dateInput: string | Date | undefined, fallback?: Date): Date => {
    if (!dateInput) {
      return fallback || stableDate.value;
    }
    if (dateInput instanceof Date) {
      return dateInput;
    }

    if (typeof dateInput === "string" && dateInput.includes("T") && dateInput.endsWith("Z")) {
      return new Date(dateInput);
    }

    return new Date(dateInput);
  };

  const scheduleNextMidnightUpdate = () => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = midnight.getTime() - now.getTime();

    setTimeout(() => {
      stableDate.value = new Date();
      scheduleNextMidnightUpdate();
    }, msUntilMidnight);
  };

  if (import.meta.client) {
    scheduleNextMidnightUpdate();
  }

  return {
    stableDate,
    getStableDate,
    parseStableDate,
  };
}
