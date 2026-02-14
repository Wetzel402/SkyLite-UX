# Holiday Countdown Fallback Design

**Date:** 2026-02-14
**Feature:** Holiday countdown fallback when no user countdowns exist
**Status:** Approved

## Overview

Currently, the countdown widget on the home screen disappears when users have no countdown events configured. This design adds automatic holiday countdown fallback - when no user countdowns exist, the widget displays the next upcoming public holiday for the user's configured country/region.

## Goals

- Always show something in the countdown widget (user events take priority, holidays as fallback)
- Support multiple countries and regions using Nager.Date public holiday API
- Minimize API calls through smart caching
- Generate AI-powered whimsical messages for holidays (same as user countdowns)
- Keep the feature configurable and optional

## Non-Goals

- No changes to mobile APK (APK is for data entry only, home screen is desktop/browser)
- No hardcoded holiday lists (rely entirely on Nager.Date API)
- No support for custom holiday lists (use what Nager.Date provides)

## Architecture

### Approach: Unified Backend API

Modify the existing countdown endpoint to act as a "countdown provider" - the frontend doesn't care if it's a user countdown or holiday, it just displays whatever the backend provides.

**Priority Logic:**
1. User countdowns exist → Return user countdowns (existing behavior)
2. No user countdowns → Return holiday countdown (new behavior)

This keeps frontend simple and puts smart logic in the backend where it belongs.

### Database Schema Changes

**New Table: `HolidayCache`**
```sql
CREATE TABLE HolidayCache (
  id                  INTEGER PRIMARY KEY,
  countryCode         TEXT NOT NULL,
  subdivisionCode     TEXT,
  holidayName         TEXT NOT NULL,
  holidayDate         DATE NOT NULL,
  fetchedAt           TIMESTAMP NOT NULL,
  cachedUntil         DATE NOT NULL  -- Same as holidayDate
);
```

**AppSettings Table Additions:**
```sql
ALTER TABLE AppSettings ADD COLUMN holidayCountryCode TEXT DEFAULT 'CA';
ALTER TABLE AppSettings ADD COLUMN holidaySubdivisionCode TEXT;
ALTER TABLE AppSettings ADD COLUMN enableHolidayCountdowns BOOLEAN DEFAULT true;
```

## Components

### 1. Settings UI

**New Section: "Holiday Countdowns"**

Three configuration options:

1. **Enable Holiday Countdowns** (Toggle)
   - Default: Enabled
   - When disabled, countdown widget disappears if no user events

2. **Country** (Searchable Dropdown)
   - Fetches countries from Nager.Date `/api/v3/AvailableCountries`
   - Default: "CA - Canada"
   - When changed: Clear subdivision, invalidate cache, refetch subdivisions

3. **Region/Subdivision** (Searchable Dropdown, Optional)
   - Fetches from Nager.Date `/api/v3/CountryInfo/{countryCode}`
   - Only shown if country supports subdivisions
   - Help text: "Optional. If not selected, national holidays will be used."
   - Example: Ontario gets province-specific holidays

### 2. Backend API Changes

**Modified Endpoint: `/api/countdowns`**

Logic flow:
1. Check if user countdown todos exist
2. If YES → return user countdowns (skip holiday logic)
3. If NO → check holiday cache
4. If cache valid (date hasn't passed) → return cached holiday
5. If cache invalid/missing → fetch from Nager.Date, cache, return
6. Apply Gemini message generation to holidays

**New Endpoint: `/api/settings/holiday-countries`**

Proxy for Nager.Date API to avoid CORS issues and enable caching:
- `GET /api/settings/holiday-countries` → Fetch available countries
- `GET /api/settings/holiday-countries/:code` → Fetch subdivisions for country

### 3. Nager.Date API Integration

**Primary Endpoint:**
```
GET https://date.nager.at/api/v3/PublicHolidays/{year}/{countryCode}
```

**Response Format:**
```json
[
  {
    "date": "2026-12-25",
    "localName": "Christmas Day",
    "name": "Christmas Day",
    "countryCode": "CA",
    "counties": ["CA-ON", "CA-BC"]
  }
]
```

**Holiday Selection Logic:**
1. Fetch all holidays for current year
2. Filter to holidays >= today
3. If subdivision configured, filter to holidays with matching county code
4. Select earliest upcoming holiday
5. Cache until holiday date passes

**Cache Strategy:**
- Fetch ONLY when needed (no user countdown exists)
- Cache single holiday until its date passes
- Invalidate when user changes country/subdivision settings
- No periodic refreshes - fetch on-demand only

## Data Flow

### Home Screen Load

```
Frontend → GET /api/countdowns
            ↓
Backend: Check user countdowns?
            ↓
    ┌───────┴───────┐
    YES             NO
    ↓               ↓
Return user    Check holiday cache
countdowns          ↓
                ┌───┴───┐
              Valid  Invalid
                ↓       ↓
            Return   Fetch from
            cached   Nager.Date
            holiday      ↓
                     Cache + Return
                     holiday
```

### Settings Change

```
User changes country/subdivision
            ↓
Save to AppSettings
            ↓
Invalidate HolidayCache
            ↓
Next home load fetches new holiday
```

## Error Handling

### API Failures

1. **Nager.Date API unreachable:**
   - Log error
   - Don't show countdown widget
   - Retry on next home screen load
   - Don't crash home screen

2. **Invalid country/subdivision:**
   - Fall back to national holidays (ignore subdivision)
   - If country invalid, fall back to Canada default
   - Log warning

3. **No upcoming holidays found:**
   - Don't show countdown widget
   - Log info message
   - Unlikely with Nager.Date but possible

4. **Gemini API fails:**
   - Fall back to generic: "X days until [Holiday Name]"
   - Same fallback as user countdowns

### Edge Cases

5. **Holiday is today (0 days):**
   - Show "Today is [Holiday Name]!"
   - Cache remains valid until end of day

6. **User creates countdown while holiday showing:**
   - Next load automatically switches to user countdown
   - Holiday cache stays valid for future

7. **Settings page - fetch countries fails:**
   - Show error in UI
   - Keep existing selection
   - Provide retry button

8. **Multiple holidays same day:**
   - Use first from API (Nager.Date orders them)

## Testing Strategy

### Backend Unit Tests

- ✓ User countdown exists → returns user countdown, no holiday fetch
- ✓ No user countdown → returns holiday countdown
- ✓ Valid cache → uses cache, no API call
- ✓ Expired cache → fetches new holiday
- ✓ No cache → fetches and stores
- ✓ API failure handled gracefully
- ✓ Subdivision filtering works
- ✓ Settings changes invalidate cache

### Frontend Unit Tests

- ✓ Settings UI: Country dropdown populates
- ✓ Settings UI: Changing country updates subdivision
- ✓ Settings UI: Help text displays
- ✓ Settings UI: Loading states work
- ✓ Countdown widget displays holiday correctly
- ✓ Switches between user and holiday countdowns

### Integration Tests

- ✓ Real Nager.Date API integration
- ✓ Test multiple countries (Canada, US, UK)
- ✓ Test with/without subdivisions
- ✓ Gemini message generation for holidays
- ✓ Complete user workflow

### Manual Testing

- Configure country/subdivision
- Verify correct holidays appear
- Create user countdown → holiday hides
- Delete user countdown → holiday returns
- Change country → new holidays appear

## Implementation Notes

### Files to Modify

**Backend:**
- Create `prisma/migrations/XXX_add_holiday_cache.sql`
- Modify `/server/api/countdowns.get.ts` (or equivalent)
- Create `/server/api/settings/holiday-countries.get.ts`
- Create `/server/api/settings/holiday-countries/[code].get.ts`
- Add utility: `/server/utils/holidayCache.ts`

**Frontend:**
- Modify `/app/pages/settings.vue` (add Holiday Countdowns section)
- Component: `/app/components/settings/holidaySettings.vue` (optional, if extracted)

**Prisma Schema:**
- Add `HolidayCache` model
- Add fields to `AppSettings` model

### Dependencies

- No new npm packages required (use native fetch)
- Nager.Date API is free and requires no API key

### Deployment Notes

- Database migration required
- Settings will default to Canada with feature enabled
- Existing countdown functionality unchanged (backward compatible)

## Future Enhancements (Out of Scope)

- Custom holiday lists
- Multiple simultaneous countdowns
- Regional holiday preferences beyond country/subdivision
- Holiday history/past holidays view
- "Days since" countdowns

## Success Criteria

1. ✅ Countdown widget always shows something when enabled
2. ✅ User countdowns always take priority over holidays
3. ✅ Minimal API calls through smart caching
4. ✅ Works for multiple countries/regions
5. ✅ Gemini messages work for holidays
6. ✅ Configurable in settings
7. ✅ No impact on mobile APK
8. ✅ Graceful degradation on API failures

## References

- [Nager.Date API Documentation](https://date.nager.at/Api)
- [Nager.Date Swagger](https://date.nager.at/swagger/index.html)
- Existing countdown implementation in Skylite UX
- Google Gemini integration for message generation
