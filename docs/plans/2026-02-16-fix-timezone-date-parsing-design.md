# Fix Timezone Date Parsing Bug

**Date:** 2026-02-16
**Status:** Approved

## Problem

The holiday countdown widget shows "-1 days to Louis Rey Day" instead of advancing to the next upcoming holiday. The root cause is that `new Date("YYYY-MM-DD")` parses date-only strings as UTC midnight, which shifts to the previous day in US timezones (e.g., CST = UTC-6).

This same class of bug exists in 8 locations across the codebase.

## Solution

Create a shared `parseLocalDate(dateStr)` utility that splits `"YYYY-MM-DD"` strings and creates local-time dates via `new Date(year, month-1, day)`. Apply it to all 8 vulnerable locations.

### Utility Location

`app/utils/dateParser.ts` — Nuxt auto-imports from `app/utils/` for both server and client code.

### Function Signature

```typescript
export function parseLocalDate(dateStr: string): Date
```

- Splits on `-`, creates `new Date(year, month - 1, day)`
- Throws on invalid format

### Files to Fix

**Immediate (holiday countdown bug):**
1. `server/utils/nagerDateApi.ts` — lines 122, 147: `new Date(holiday.date)`
2. `server/api/todos/countdowns.get.ts` — line 80: `new Date(apiHoliday.date)`

**Medium priority:**
3. `server/api/meal-plans/by-week/[weekStart].get.ts` — lines 15-16
4. `server/api/integrations/google_calendar/events/index.get.ts` — lines 23-24
5. `server/api/integrations/google_calendar/events/[eventId].get.ts` — lines 115-116

**App-side (deferred to follow-up PR — these receive full datetime strings, not date-only):**
6. `app/composables/useStableDate.ts` — lines 14-18
7. `app/integrations/mealie/mealieShoppingLists.ts` — line 44
8. `app/integrations/tandoor/tandoorShoppingLists.ts` — line 39

### Tests

Add unit test for `parseLocalDate` verifying correct local-time date creation.

## Reference

`server/api/meals/byDateRange.get.ts` already implements correct explicit date parsing — the new utility follows the same pattern.
