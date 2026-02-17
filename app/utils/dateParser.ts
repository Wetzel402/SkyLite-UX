/**
 * Parse a "YYYY-MM-DD" date string as local midnight.
 *
 * IMPORTANT: Do NOT use `new Date("YYYY-MM-DD")` for date-only strings.
 * That parses as UTC midnight, which shifts to the previous day in
 * timezones behind UTC (e.g., CST = UTC-6).
 *
 * This function splits the string and uses `new Date(year, month-1, day)`
 * which creates a date at local midnight — the correct behavior for
 * dates from APIs like Nager.Date and Google Calendar all-day events.
 */
export function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split("-").map(Number);

  if (parts.length !== 3) {
    throw new Error(`Invalid date format "${dateStr}". Expected YYYY-MM-DD.`);
  }

  const [year, month, day] = parts as [number, number, number];

  if (
    Number.isNaN(year)
    || Number.isNaN(month)
    || Number.isNaN(day)
    || month < 1
    || month > 12
    || day < 1
    || day > 31
  ) {
    throw new Error(`Invalid date values in "${dateStr}". Expected valid YYYY-MM-DD.`);
  }

  return new Date(year, month - 1, day);
}
