# Fix Timezone Date Parsing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the holiday countdown showing "-1 days" and all other YYYY-MM-DD date parsing locations that suffer from the same UTC vs local timezone bug.

**Architecture:** Create a shared `parseLocalDate` utility that correctly parses "YYYY-MM-DD" strings as local midnight dates. Apply it to all 7 locations where date-only strings are parsed with `new Date()`, which incorrectly creates UTC midnight (wrong day in US timezones).

**Tech Stack:** TypeScript, Vitest, Nuxt 3 (auto-imports from `app/utils/`)

---

### Task 1: Create `parseLocalDate` utility with tests

**Files:**
- Create: `app/utils/dateParser.ts`
- Create: `tests/unit/utils/dateParser.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/utils/dateParser.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { parseLocalDate } from "../../app/utils/dateParser";

describe("parseLocalDate", () => {
  it("should parse YYYY-MM-DD as local midnight", () => {
    const date = parseLocalDate("2026-02-16");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(1); // 0-indexed, Feb = 1
    expect(date.getDate()).toBe(16);
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
    expect(date.getSeconds()).toBe(0);
  });

  it("should parse dates that would shift with UTC parsing", () => {
    // This is the exact bug: new Date("2026-02-16") creates UTC midnight,
    // which in CST (UTC-6) becomes Feb 15 at 6 PM
    const date = parseLocalDate("2026-02-16");
    // With parseLocalDate, the date should always be 16, not 15
    expect(date.getDate()).toBe(16);
  });

  it("should handle single-digit months and days", () => {
    const date = parseLocalDate("2026-01-05");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(0);
    expect(date.getDate()).toBe(5);
  });

  it("should throw on invalid format", () => {
    expect(() => parseLocalDate("not-a-date")).toThrow();
    expect(() => parseLocalDate("2026-13-01")).toThrow();
    expect(() => parseLocalDate("2026-00-01")).toThrow();
    expect(() => parseLocalDate("2026-02-00")).toThrow();
    expect(() => parseLocalDate("")).toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/utils/dateParser.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

Create `app/utils/dateParser.ts`:

```typescript
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
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/utils/dateParser.test.ts`
Expected: PASS — all 4 tests green

**Step 5: Commit**

```bash
git add app/utils/dateParser.ts tests/unit/utils/dateParser.test.ts
git commit -m "feat: add parseLocalDate utility for timezone-safe YYYY-MM-DD parsing"
```

---

### Task 2: Fix holiday countdown — `nagerDateApi.ts`

**Files:**
- Modify: `server/utils/nagerDateApi.ts` (lines 122, 147)
- Modify: `tests/unit/server/utils/nagerDateApi.test.ts`

**Step 1: Add a regression test**

Add this test to the `getNextUpcomingHoliday` describe block in `tests/unit/server/utils/nagerDateApi.test.ts`:

```typescript
it("should not return a past holiday due to timezone parsing", async () => {
  // This tests the exact bug: "2026-02-16" parsed with new Date()
  // creates UTC midnight, which in CST (UTC-6) becomes Feb 15.
  // The filter `holidayDate < today` would then incorrectly keep
  // a holiday that should be filtered out.
  const mockHolidays = [
    {
      date: "2026-02-16",
      localName: "Test Holiday",
      name: "Test Holiday",
      countryCode: "US",
      counties: null,
    },
    {
      date: "2026-07-04",
      localName: "Independence Day",
      name: "Independence Day",
      countryCode: "US",
      counties: null,
    },
  ];

  vi.mocked(globalThis.fetch).mockResolvedValue({
    ok: true,
    json: async () => mockHolidays,
  } as Response);

  // Set time to Feb 17 — the Feb 16 holiday is in the past
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 1, 17, 10, 0, 0)); // Feb 17, 10 AM local

  const result = await getNextUpcomingHoliday("US", undefined);

  // Should skip the past holiday and return Independence Day
  expect(result?.name).toBe("Independence Day");

  vi.useRealTimers();
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/server/utils/nagerDateApi.test.ts`
Expected: The new test may pass or fail depending on the test runner's timezone. The real fix ensures correctness regardless.

**Step 3: Apply fix to `nagerDateApi.ts`**

In `server/utils/nagerDateApi.ts`, add the import at the top:

```typescript
import { parseLocalDate } from "~/utils/dateParser";
```

Then replace line 122:
```typescript
// OLD: const holidayDate = new Date(holiday.date);
const holidayDate = parseLocalDate(holiday.date);
```

And remove the now-redundant `setHours` on line 123 (it's already local midnight):
```typescript
// OLD: holidayDate.setHours(0, 0, 0, 0);
// DELETE this line — parseLocalDate already returns local midnight
```

Do the same for the second filter block (line 147-148):
```typescript
// OLD: const holidayDate = new Date(holiday.date);
const holidayDate = parseLocalDate(holiday.date);
// OLD: holidayDate.setHours(0, 0, 0, 0);
// DELETE this line
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/server/utils/nagerDateApi.test.ts`
Expected: PASS — all tests green

**Step 5: Commit**

```bash
git add server/utils/nagerDateApi.ts tests/unit/server/utils/nagerDateApi.test.ts
git commit -m "fix: use parseLocalDate in nagerDateApi to prevent timezone shift"
```

---

### Task 3: Fix holiday countdown — `countdowns.get.ts`

**Files:**
- Modify: `server/api/todos/countdowns.get.ts` (line 80)

**Step 1: Apply fix**

In `server/api/todos/countdowns.get.ts`, add the import at the top (after existing imports):

```typescript
import { parseLocalDate } from "~/utils/dateParser";
```

Then replace line 80:
```typescript
// OLD: const holidayDate = new Date(apiHoliday.date);
const holidayDate = parseLocalDate(apiHoliday.date);
```

**Step 2: Run existing countdown tests**

Run: `npx vitest run tests/integration/api/todos/countdowns.test.ts`
Expected: PASS (or skip if tests require DB — check output)

**Step 3: Commit**

```bash
git add server/api/todos/countdowns.get.ts
git commit -m "fix: use parseLocalDate in countdowns API for correct holiday dates"
```

---

### Task 4: Fix Google Calendar all-day events — `index.get.ts`

**Files:**
- Modify: `server/api/integrations/google_calendar/events/index.get.ts` (lines 23-24)

**Step 1: Apply fix**

In `server/api/integrations/google_calendar/events/index.get.ts`, add at the top (after existing imports):

```typescript
import { parseLocalDate } from "~/utils/dateParser";
```

Then replace lines 23-24 inside `convertToCalendarEvent`:
```typescript
// OLD:
// const start = new Date(startDateTime || "");
// const end = new Date(endDateTime || "");

// NEW: Use parseLocalDate for date-only strings (all-day events)
const start = isAllDay ? parseLocalDate(startDateTime || "") : new Date(startDateTime || "");
const end = isAllDay ? parseLocalDate(endDateTime || "") : new Date(endDateTime || "");
```

Wait — `isAllDay` is computed on line 25, after `start` and `end`. Reorder:

```typescript
const startDateTime = event.start.dateTime || event.start.date;
const endDateTime = event.end.dateTime || event.end.date;
const isAllDay = !event.start.dateTime && !!event.start.date;

const start = isAllDay ? parseLocalDate(startDateTime!) : new Date(startDateTime || "");
const end = isAllDay ? parseLocalDate(endDateTime!) : new Date(endDateTime || "");
```

**Step 2: Verify no regressions**

Run: `npx vitest run`
Expected: All existing tests pass

**Step 3: Commit**

```bash
git add server/api/integrations/google_calendar/events/index.get.ts
git commit -m "fix: use parseLocalDate for Google Calendar all-day events in list endpoint"
```

---

### Task 5: Fix Google Calendar all-day events — `[eventId].get.ts`

**Files:**
- Modify: `server/api/integrations/google_calendar/events/[eventId].get.ts` (lines 112-116)

**Step 1: Apply fix**

Add import at top:
```typescript
import { parseLocalDate } from "~/utils/dateParser";
```

Replace lines 112-117:
```typescript
const startDateTime = googleEvent.start.dateTime || googleEvent.start.date;
const endDateTime = googleEvent.end.dateTime || googleEvent.end.date;
const isAllDay = !googleEvent.start.dateTime && !!googleEvent.start.date;

const start = isAllDay ? parseLocalDate(startDateTime!) : new Date(startDateTime || "");
const end = isAllDay ? parseLocalDate(endDateTime!) : new Date(endDateTime || "");
```

**Step 2: Commit**

```bash
git add server/api/integrations/google_calendar/events/\[eventId\].get.ts
git commit -m "fix: use parseLocalDate for Google Calendar all-day events in detail endpoint"
```

---

### Task 6: Fix Google Calendar all-day events — `index.post.ts` and `[eventId].put.ts`

**Files:**
- Modify: `server/api/integrations/google_calendar/events/index.post.ts` (line 148-149)
- Modify: `server/api/integrations/google_calendar/events/[eventId].put.ts` (line 158-159)

**Step 1: Apply fix to `index.post.ts`**

Add import at top:
```typescript
import { parseLocalDate } from "~/utils/dateParser";
```

Replace lines 148-149:
```typescript
// OLD:
// const start = createdEvent.start.dateTime ? new Date(createdEvent.start.dateTime) : new Date(`${createdEvent.start.date}T00:00:00Z`);
// const end = createdEvent.end.dateTime ? new Date(createdEvent.end.dateTime) : new Date(`${createdEvent.end.date}T00:00:00Z`);

// NEW:
const start = createdEvent.start.dateTime ? new Date(createdEvent.start.dateTime) : parseLocalDate(createdEvent.start.date!);
const end = createdEvent.end.dateTime ? new Date(createdEvent.end.dateTime) : parseLocalDate(createdEvent.end.date!);
```

**Step 2: Apply same fix to `[eventId].put.ts`**

Add import at top:
```typescript
import { parseLocalDate } from "~/utils/dateParser";
```

Replace lines 158-159:
```typescript
// OLD:
// const start = updatedEvent.start.dateTime ? new Date(updatedEvent.start.dateTime) : new Date(`${updatedEvent.start.date}T00:00:00Z`);
// const end = updatedEvent.end.dateTime ? new Date(updatedEvent.end.dateTime) : new Date(`${updatedEvent.end.date}T00:00:00Z`);

// NEW:
const start = updatedEvent.start.dateTime ? new Date(updatedEvent.start.dateTime) : parseLocalDate(updatedEvent.start.date!);
const end = updatedEvent.end.dateTime ? new Date(updatedEvent.end.dateTime) : parseLocalDate(updatedEvent.end.date!);
```

**Step 3: Commit**

```bash
git add server/api/integrations/google_calendar/events/index.post.ts server/api/integrations/google_calendar/events/\[eventId\].put.ts
git commit -m "fix: use parseLocalDate for Google Calendar all-day events in create/update endpoints"
```

---

### Task 7: Fix meal plan week lookup — `[weekStart].get.ts`

**Files:**
- Modify: `server/api/meal-plans/by-week/[weekStart].get.ts` (lines 15-16)

**Step 1: Apply fix**

Add import at top:
```typescript
import { parseLocalDate } from "~/utils/dateParser";
```

Replace lines 15-16:
```typescript
// OLD:
// const searchDate = new Date(weekStart);
// searchDate.setUTCHours(0, 0, 0, 0);

// NEW:
const searchDate = parseLocalDate(weekStart);
```

Note: `parseLocalDate` already returns local midnight, so no `setUTCHours` needed. The `endOfDay` calculation on lines 19-20 should also use local time:

```typescript
const endOfDay = new Date(searchDate);
endOfDay.setHours(23, 59, 59, 999);
```

(Change `setUTCHours` to `setHours` if it was using UTC before, to be consistent with local dates.)

**Step 2: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 3: Commit**

```bash
git add server/api/meal-plans/by-week/\[weekStart\].get.ts
git commit -m "fix: use parseLocalDate for meal plan week lookup"
```

---

### Task 8: Run full test suite and lint

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 2: Run lint**

Run: `npm run lint`
Expected: No new lint errors

**Step 3: Run type check**

Run: `npm run type-check`
Expected: No type errors

---

### Task 9: Clean up `byDateRange.get.ts` (optional refactor)

**Files:**
- Modify: `server/api/meals/byDateRange.get.ts` (lines 39-51)

This file already has a correct manual implementation of date parsing. It can be simplified to use `parseLocalDate`:

```typescript
// OLD (lines 39-51): Manual split and Date.UTC construction
// NEW:
const startParts = startDateStr.split("-");
if (startParts.length !== 3) {
  throw createError({
    statusCode: 400,
    message: "Invalid date format. Use YYYY-MM-DD or ISO 8601 format",
  });
}
startDate = parseLocalDate(startDateStr);
```

Note: This file uses `Date.UTC` (UTC dates) for DB queries while `parseLocalDate` creates local dates. Only apply this refactor if the meal plan DB stores dates in local time. If it stores UTC, leave this file as-is.

**Decision point:** Check whether meal plan dates in the DB are stored as UTC or local. If UTC, skip this task. If local, apply the refactor and commit.
