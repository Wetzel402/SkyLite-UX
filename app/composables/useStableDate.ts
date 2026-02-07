export function useStableDate() {
  const stableDate = useState<Date>("global-stable-date", () => new Date());

  const getStableDate = () => stableDate.value;

  const parseStableDate = (
    dateInput: string | Date | undefined,
    fallback?: Date,
  ): Date => {
    if (!dateInput) {
      return fallback || stableDate.value;
    }
    if (dateInput instanceof Date) {
      return dateInput;
    }

    if (
      typeof dateInput === "string"
      && dateInput.includes("T")
      && dateInput.endsWith("Z")
    ) {
      return new Date(dateInput);
    }

    return new Date(dateInput);
  };

  const scheduleNextUpdate = () => {
    const now = new Date();
    const nextUpdate = new Date(now);

    const minutes = now.getMinutes();
    const nextMinutes = Math.ceil((minutes + 1) / 5) * 5;

    if (nextMinutes >= 60) {
      nextUpdate.setHours(nextUpdate.getHours() + 1);
      nextUpdate.setMinutes(0, 0, 0);
    }
    else {
      nextUpdate.setMinutes(nextMinutes, 0, 0);
    }

    const msUntilNextUpdate = nextUpdate.getTime() - now.getTime();

    setTimeout(() => {
      stableDate.value = new Date();
      scheduleNextUpdate();
    }, msUntilNextUpdate);
  };

  if (import.meta.client) {
    scheduleNextUpdate();
  }

  return {
    stableDate,
    getStableDate,
    parseStableDate,
  };
}
