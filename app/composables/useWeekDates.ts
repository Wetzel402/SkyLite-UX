/**
 * Composable for week date calculations (Monday-Sunday)
 */
export function useWeekDates() {
  /**
   * Get the Monday of the week containing the given date
   */
  function getMondayOfWeek(date: Date): Date {
    const monday = new Date(date.getTime());
    const dayOfWeek = monday.getDay();
    // If Sunday (0), go back 6 days; else go back (dayOfWeek - 1) days
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    monday.setDate(monday.getDate() - daysToMonday);
    return monday;
  }

  /**
   * Get the Sunday of the week containing the given date
   */
  function getSundayOfWeek(date: Date): Date {
    const monday = getMondayOfWeek(date);
    const sunday = new Date(monday.getTime());
    sunday.setDate(sunday.getDate() + 6);
    return sunday;
  }

  /**
   * Get the full week range (Monday to Sunday) for a given date
   */
  function getWeekRange(date: Date): { start: Date; end: Date } {
    const monday = getMondayOfWeek(date);
    const sunday = getSundayOfWeek(date);
    return { start: monday, end: sunday };
  }

  /**
   * Generate array of 7 dates from Monday to Sunday for a given week
   */
  function getWeekDays(date: Date): Date[] {
    const monday = getMondayOfWeek(date);
    const days: Date[] = [];

    for (let i = 0; i < 7; i++) {
      const day = new Date(monday.getTime());
      day.setDate(monday.getDate() + i);
      days.push(day);
    }

    return days;
  }

  return {
    getMondayOfWeek,
    getSundayOfWeek,
    getWeekRange,
    getWeekDays,
  };
}
