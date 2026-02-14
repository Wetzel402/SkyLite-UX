# Holiday Countdown Fallback

## Overview

The holiday countdown feature automatically displays countdowns to upcoming public holidays when no user-created countdown events exist. This ensures the countdown widget always shows something meaningful.

## Features

- **Automatic Fallback**: Shows next upcoming holiday when no user countdowns exist
- **Multi-Country Support**: Supports 100+ countries via Nager.Date API
- **Regional Holidays**: Optional subdivision support for region-specific holidays
- **Smart Caching**: Minimizes API calls through intelligent caching
- **AI Messages**: Generates whimsical countdown messages via Google Gemini (same as user countdowns)
- **Configurable**: Can be enabled/disabled and configured per country/region

## Priority Logic

1. **User Countdowns Exist** → Display user countdowns (existing behavior)
2. **No User Countdowns** → Display holiday countdown (fallback behavior)

User-created countdowns always take priority over holidays, even if a holiday is sooner.

## Configuration

Navigate to **Settings > Holiday Countdowns** to configure:

### Enable Holiday Countdowns
- Toggle to enable/disable the feature
- Default: Enabled
- When disabled, the countdown widget disappears if no user events exist

### Country Selection
- Choose your country from a searchable dropdown
- Default: Canada (CA)
- Changes invalidate the cache and fetch new holidays

### Region/Subdivision (Optional)
- Enter a subdivision code for region-specific holidays
- Examples: "ON" for Ontario, "BC" for British Columbia, "NY" for New York
- If not specified, national holidays will be used
- Only affects which holidays are shown (national vs regional)

## How It Works

### Data Flow

1. **Home screen loads** → Requests countdowns from `/api/todos/countdowns`
2. **Backend checks** → Are there user countdowns?
   - **Yes** → Return user countdowns (skip holiday logic)
   - **No** → Proceed to holiday fallback
3. **Holiday fallback** → Check if feature enabled in settings
   - **Disabled** → Return empty array
   - **Enabled** → Proceed to fetch holiday
4. **Check cache** → Is there a valid cached holiday?
   - **Yes** → Return cached holiday
   - **No** → Fetch from Nager.Date API
5. **Fetch from API** → Get next upcoming holiday for configured country/subdivision
6. **Save to cache** → Store holiday with expiration date
7. **Return countdown** → Display holiday countdown with `isHoliday: true` flag

### Caching Strategy

- **Cache on first fetch**: Holiday is cached when fetched from API
- **Cache expiration**: Cache is valid until the holiday date passes
- **Cache invalidation**: Cache is cleared when country/subdivision settings change
- **No periodic refresh**: Fetches only on-demand (when no user countdowns exist)

### API Integration

Uses [Nager.Date](https://date.nager.at) public holiday API:
- **Free**: No API key required
- **100+ countries**: Supports most countries worldwide
- **Subdivision support**: Some countries have region-specific holidays
- **Reliable**: Well-maintained public API

## Database Schema

### HolidayCache Table
```sql
CREATE TABLE holiday_cache (
  id                TEXT PRIMARY KEY,
  countryCode       TEXT NOT NULL,
  subdivisionCode   TEXT,
  holidayName       TEXT NOT NULL,
  holidayDate       DATETIME NOT NULL,
  fetchedAt         DATETIME NOT NULL,
  cachedUntil       DATETIME NOT NULL,
  createdAt         DATETIME NOT NULL,
  updatedAt         DATETIME NOT NULL
);
```

**Indexes:**
- Unique: `(countryCode, subdivisionCode, holidayDate)`
- Index: `(countryCode, subdivisionCode)` for lookups
- Index: `(cachedUntil)` for cache expiration queries

### AppSettings Fields
```sql
holidayCountryCode       TEXT DEFAULT 'CA'
holidaySubdivisionCode   TEXT NULL
enableHolidayCountdowns  BOOLEAN DEFAULT true
```

## API Endpoints

### Countdown Endpoint
- **GET** `/api/todos/countdowns`
- Returns user countdowns OR holiday countdown (never both)
- Holiday countdown includes `isHoliday: true` flag

### Settings Endpoints
- **GET** `/api/settings/holiday-countries` - List available countries
- **GET** `/api/settings/holiday-countries/:code` - Get country info
- **PUT** `/api/app-settings` - Update holiday settings (invalidates cache)

## Error Handling

### Graceful Degradation

**Nager.Date API Unreachable:**
- Error logged
- Empty array returned (no countdown shown)
- Retry on next home screen load

**Invalid Country/Subdivision:**
- Falls back to national holidays (ignores subdivision)
- If country invalid, uses default (Canada)
- Warning logged

**No Upcoming Holidays:**
- Empty array returned (no countdown shown)
- Rare but possible (e.g., no more holidays this year)

**Gemini API Fails:**
- Falls back to generic message: "X days until [Holiday Name]"
- Same fallback as user countdowns

## Frontend Display

### Countdown Widget
- Holiday countdowns display exactly like user countdowns
- Uses same AI-generated messages
- Same visual design and styling
- Includes `isHoliday: true` in data (for future styling if desired)

### Settings UI
- Holiday Countdowns section in Settings page
- Toggle switch for enable/disable
- Searchable country dropdown
- Optional subdivision text input
- Auto-saves on change
- Help text for subdivision field

## Testing

### Unit Tests
- `tests/unit/server/utils/holidayCache.test.ts` - Database operations
- `tests/unit/server/utils/nagerDateApi.test.ts` - API integration

### Integration Tests
- `tests/integration/api/todos/countdowns.test.ts` - Countdown endpoint
- `tests/integration/api/settings/holiday-countries.test.ts` - Settings endpoints
- `tests/integration/api/app-settings.test.ts` - Settings updates
- `tests/integration/holiday-countdown-e2e.test.ts` - End-to-end flow

### Test Coverage
- Priority logic (user countdowns vs holidays)
- Cache hit/miss scenarios
- Settings changes and cache invalidation
- Feature enable/disable
- Error handling

## Maintenance

### Updating Country List
Country list is fetched dynamically from Nager.Date API - no manual updates needed.

### Adding New Countries
Nager.Date API is maintained by the community. New countries are added upstream.

### Subdivision Codes

Subdivision codes use short format for input but are converted to ISO 3166-2 format internally:

- **Input Format**: Short codes ("ON", "BC", "NY", "CA")
- **Internal Format**: ISO 3166-2 ("CA-ON", "CA-BC", "US-NY", "US-CA")
- **Conversion**: The system automatically converts short codes to full ISO format by prepending the country code

**Examples:**
- Canada, Ontario: Enter "ON" → Stored as "CA-ON"
- Canada, British Columbia: Enter "BC" → Stored as "CA-BC"
- United States, New York: Enter "NY" → Stored as "US-NY"
- United States, California: Enter "CA" → Stored as "US-CA"

The Nager.Date API uses ISO 3166-2 format in the `counties` field of holiday responses, but accepts short codes as the subdivision parameter.

## Deployment

### Database Migration

Run Prisma migration to create HolidayCache table and AppSettings columns:

```bash
npx prisma migrate deploy
```

### Configuration

Default settings after migration:
- Feature: Enabled
- Country: Canada (CA)
- Subdivision: None (national holidays)

Users can configure these settings in the Settings page under "Holiday Countdowns".

### External Dependencies

- **Nager.Date API**: Free public holiday API (https://date.nager.at)
  - No authentication required
  - Rate limits: Reasonable use for personal applications
  - Availability: Public service, community-maintained
- **Graceful Degradation**: If API unavailable, feature returns no countdown (widget hidden)
- **No API Key**: No setup or API key management required

## Future Enhancements

- Custom holiday lists (beyond Nager.Date)
- Multiple simultaneous countdowns
- Regional holiday preferences
- Holiday history/past holidays view
- "Days since" countdowns

## Implementation Date

- **Designed:** 2026-02-14
- **Implemented:** 2026-02-14
- **Branch:** feature/holiday-countdown-fallback

## Related Files

**Backend:**
- `server/utils/holidayCache.ts` - Cache operations
- `server/utils/nagerDateApi.ts` - API integration
- `server/api/todos/countdowns.get.ts` - Modified endpoint
- `server/api/settings/holiday-countries.get.ts` - Country list
- `server/api/settings/holiday-countries/[code].get.ts` - Country info
- `server/api/app-settings/index.put.ts` - Settings updates

**Frontend:**
- `app/pages/settings.vue` - Settings UI
- `app/types/database.ts` - Type definitions

**Database:**
- `prisma/schema.prisma` - Schema definitions
- `prisma/migrations/20260214101137_add_holiday_cache/` - Initial migration
- `prisma/migrations/20260214102729_add_holiday_cache_indexes/` - Index migration

**Tests:**
- `tests/unit/server/utils/holidayCache.test.ts`
- `tests/unit/server/utils/nagerDateApi.test.ts`
- `tests/integration/api/todos/countdowns.test.ts`
- `tests/integration/api/settings/holiday-countries.test.ts`
- `tests/integration/api/app-settings.test.ts`
- `tests/integration/holiday-countdown-e2e.test.ts`
