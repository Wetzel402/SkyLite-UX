import type { RecurrencePattern } from "~/types/database";

/**
 * Helper to advance a date by a fixed interval until it's past the target date
 * @param startDate - The date to start from
 * @param dateToPass - The date to pass
 * @param intervalDays - Number of days to advance in each step
 * @returns A new date that is past today
 */
function advancePastDate(
  startDate: Date,
  dateToPass: Date,
  intervalDays: number,
): Date {
  if (intervalDays <= 0) {
    throw new Error("intervalDays must be positive");
  }
  const nextDate = new Date(startDate);

  while (nextDate <= dateToPass) {
    nextDate.setDate(nextDate.getDate() + intervalDays);
  }

  return nextDate;
}

/**
 * Helper to advance or regress a date until its the target day of the week
 * @param input - The input date
 * @param dayOfWeek - Day of the week to traverse to
 * @returns A new date that is the correct day of the week
 */
function setDay(input: Date, dayOfWeek: number): Date {
  if (dayOfWeek < 0 || dayOfWeek > 6) {
    throw new Error(
      "dayOfWeek must be a valid day of the week [i.e. 0-6] but was " +
        dayOfWeek,
    );
  }
  const newDate = new Date(input);
  const currentDay = input.getDay();
  const diff = dayOfWeek - currentDay;
  newDate.setDate(newDate.getDate() + diff);
  return newDate;
}

/**
 * Calculate the next due date based on a recurrence pattern and previous due date
 * Maintains the interval cadence - if a task was due in the past, it calculates
 * the next occurrence from that original due date, not from today
 *
 * @param pattern - The recurrence pattern
 * @param previousDueDate - The previous due date (or null to start from today)
 * @param referenceDate - Optional reference date to use as "today" (for timezone handling)
 * @returns The next due date
 */
export function calculateNextDueDate(
  pattern: RecurrencePattern,
  previousDueDate: Date | null = null,
  referenceDate: Date | null = null,
): Date {
  const today = referenceDate ? new Date(referenceDate) : new Date();
  today.setHours(0, 0, 0, 0);

  // For new recurring todos (no previous due date), use today as base
  // For existing todos, use the previous due date
  const baseDate = previousDueDate
    ? new Date(previousDueDate)
    : new Date(today);
  baseDate.setHours(0, 0, 0, 0);

  switch (pattern.type) {
    case "daily": {
      // If there's a previous due date, we need to get the NEXT occurrence after it
      if (previousDueDate) {
        // Advance from previous due date, comparing against max(previousDueDate, today)
        // This ensures we always advance at least once from the completed todo
        const comparePoint = new Date(
          Math.max(baseDate.getTime(), today.getTime()),
        );
        return advancePastDate(baseDate, comparePoint, pattern.interval);
      }
      // For new todos, advance from today
      return advancePastDate(today, today, pattern.interval);
    }

    case "weekly": {
      // If no specific days, treat like daily with 7-day interval
      if (!pattern.daysOfWeek || pattern.daysOfWeek.length === 0) {
        if (previousDueDate) {
          const comparePoint = new Date(
            Math.max(baseDate.getTime(), today.getTime()),
          );
          return advancePastDate(baseDate, comparePoint, pattern.interval * 7);
        }
        return advancePastDate(today, today, pattern.interval * 7);
      }

      const sortedDays = [...pattern.daysOfWeek].sort((a, b) => a - b);
      const latestSelectedDay = sortedDays[sortedDays.length - 1] ?? 0;
      const endOfCurrentWeek = setDay(today, latestSelectedDay);
      const startOfCurrentWeek = setDay(today, 0);

      const canUseCurrentWeek =
        baseDate.getDay() !== 6 && // Not Saturday
        today.getDay() <= latestSelectedDay && // today hasn't passed all selected days
        baseDate.getDay() < latestSelectedDay && // baseDate hasn't passed all selected days
        baseDate >= startOfCurrentWeek && // baseDate is startOfCurrentWeek or later
        baseDate < endOfCurrentWeek; // baseDate is less than the endOfCurrentWeek

      let nextDate = new Date(baseDate);

      if (canUseCurrentWeek) {
        nextDate.setDate(nextDate.getDate() + 1);
        nextDate = new Date(Math.max(nextDate.getTime(), today.getTime()));
      } else {
        // Jump to start of next interval period
        nextDate = setDay(nextDate, 0);
        nextDate.setDate(nextDate.getDate() + pattern.interval * 7);
        // Ensure we don't have a next day prior to today
        while (nextDate < today) {
          nextDate.setDate(nextDate.getDate() + pattern.interval * 7);
        }
      }

      // Iterate through the week until you hit the next matching day
      while (sortedDays.indexOf(nextDate.getDay()) < 0) {
        nextDate.setDate(nextDate.getDate() + 1);
      }

      return nextDate;
    }

    case "monthly": {
      const nextDate = new Date(baseDate);
      const targetDay = pattern.dayOfMonth;

      // Helper function to safely add months while preserving day-of-month intent
      const addMonths = (date: Date, months: number) => {
        date.setDate(1); // Set to day 1 first to avoid overflow
        date.setMonth(date.getMonth() + months);

        // Cap at max day in the target month (handles Feb 31 -> Feb 28, etc.)
        const maxDay = new Date(
          date.getFullYear(),
          date.getMonth() + 1,
          0,
        ).getDate();
        date.setDate(Math.min(targetDay, maxDay));
      };

      // Add interval at least once, then continue until past today
      addMonths(nextDate, pattern.interval);

      while (nextDate < today) {
        addMonths(nextDate, pattern.interval);
      }

      return nextDate;
    }
  }
}
