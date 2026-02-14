# Holiday Countdown Fallback Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add automatic holiday countdown fallback when no user countdowns exist, using Nager.Date API with smart caching.

**Architecture:** Modify existing `/api/todos/countdowns` endpoint to return holiday countdown when no user countdowns found. Add holiday settings to AppSettings, create HolidayCache table for caching. Frontend stays unchanged - consumes same countdown API.

**Tech Stack:** Prisma (SQLite), Nuxt 3, Nager.Date API, Google Gemini (existing)

---

## Task 1: Database Schema - Add HolidayCache Model

**Files:**
- Modify: `prisma/schema.prisma:193` (after AppSettings model)
- Modify: `prisma/schema.sqlite.prisma:193`
- Modify: `prisma/schema.postgres.prisma:193`

**Step 1: Add HolidayCache model to schema.prisma**

Add after the AppSettings model:

```prisma
model HolidayCache {
  id              String   @id @default(cuid())
  countryCode     String
  subdivisionCode String?
  holidayName     String
  holidayDate     DateTime
  fetchedAt       DateTime @default(now())
  cachedUntil     DateTime
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("holiday_cache")
}
```

**Step 2: Add holiday settings to AppSettings**

In AppSettings model, add before createdAt:

```prisma
  // Holiday countdown settings
  holidayCountryCode       String  @default("CA")
  holidaySubdivisionCode   String?
  enableHolidayCountdowns  Boolean @default(true)
```

**Step 3: Copy changes to schema.sqlite.prisma**

Same models in `prisma/schema.sqlite.prisma` at same locations.

**Step 4: Copy changes to schema.postgres.prisma**

Same models in `prisma/schema.postgres.prisma`, with DateTime instead of timestamp types.

**Step 5: Generate Prisma migration**

Run: `npx prisma migrate dev --name add_holiday_cache`
Expected: Migration created successfully

**Step 6: Commit**

```bash
git add prisma/schema*.prisma prisma/migrations
git commit -m "feat(db): add HolidayCache model and holiday settings

- Add HolidayCache table for caching next holiday
- Add holiday settings to AppSettings (country, subdivision, enable)
- Support SQLite and PostgreSQL schemas"
```

---

## Task 2: Holiday Cache Utility - Database Operations

**Files:**
- Create: `server/utils/holidayCache.ts`

**Step 1: Write tests for holiday cache operations**

Create: `server/utils/holidayCache.test.ts`

```typescript
import { describe, expect, it, beforeEach } from "vitest";
import { getHolidayCache, saveHolidayCache, invalidateHolidayCache } from "./holidayCache";

describe("holidayCache", () => {
  beforeEach(async () => {
    // Clean up test data
    await invalidateHolidayCache();
  });

  it("should return null when no cache exists", async () => {
    const cache = await getHolidayCache();
    expect(cache).toBeNull();
  });

  it("should save and retrieve holiday cache", async () => {
    const holiday = {
      countryCode: "CA",
      subdivisionCode: null,
      holidayName: "Christmas",
      holidayDate: new Date("2026-12-25"),
    };

    await saveHolidayCache(holiday);
    const cache = await getHolidayCache();

    expect(cache).not.toBeNull();
    expect(cache?.holidayName).toBe("Christmas");
    expect(cache?.countryCode).toBe("CA");
  });

  it("should return null when cached holiday date has passed", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    await saveHolidayCache({
      countryCode: "CA",
      subdivisionCode: null,
      holidayName: "Past Holiday",
      holidayDate: yesterday,
    });

    const cache = await getHolidayCache();
    expect(cache).toBeNull();
  });

  it("should invalidate existing cache", async () => {
    await saveHolidayCache({
      countryCode: "CA",
      subdivisionCode: null,
      holidayName: "Test",
      holidayDate: new Date("2026-12-25"),
    });

    await invalidateHolidayCache();
    const cache = await getHolidayCache();
    expect(cache).toBeNull();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test server/utils/holidayCache.test.ts`
Expected: FAIL - module not found

**Step 3: Implement holiday cache utility**

Create: `server/utils/holidayCache.ts`

```typescript
import consola from "consola";
import prisma from "~/lib/prisma";

export interface HolidayCacheData {
  countryCode: string;
  subdivisionCode: string | null;
  holidayName: string;
  holidayDate: Date;
}

/**
 * Get the current holiday cache if valid (date hasn't passed)
 * Returns null if no cache or cache is expired
 */
export async function getHolidayCache() {
  try {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Start of today

    const cache = await prisma.holidayCache.findFirst({
      where: {
        cachedUntil: {
          gte: now, // Holiday date must be today or future
        },
      },
      orderBy: {
        createdAt: "desc", // Get most recent if multiple exist
      },
    });

    if (!cache) {
      consola.debug("No valid holiday cache found");
      return null;
    }

    consola.debug(`Holiday cache found: ${cache.holidayName} on ${cache.holidayDate}`);
    return cache;
  }
  catch (error) {
    consola.error("Failed to get holiday cache:", error);
    return null;
  }
}

/**
 * Save a new holiday to cache
 * Clears any existing cache first
 */
export async function saveHolidayCache(holiday: HolidayCacheData) {
  try {
    // Clear existing cache
    await invalidateHolidayCache();

    // Save new cache
    const cache = await prisma.holidayCache.create({
      data: {
        countryCode: holiday.countryCode,
        subdivisionCode: holiday.subdivisionCode,
        holidayName: holiday.holidayName,
        holidayDate: holiday.holidayDate,
        cachedUntil: holiday.holidayDate, // Cache until holiday date
      },
    });

    consola.info(`Holiday cached: ${cache.holidayName} on ${cache.holidayDate}`);
    return cache;
  }
  catch (error) {
    consola.error("Failed to save holiday cache:", error);
    throw error;
  }
}

/**
 * Clear all holiday cache entries
 */
export async function invalidateHolidayCache() {
  try {
    await prisma.holidayCache.deleteMany({});
    consola.debug("Holiday cache invalidated");
  }
  catch (error) {
    consola.error("Failed to invalidate holiday cache:", error);
    throw error;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test server/utils/holidayCache.test.ts`
Expected: PASS - all tests green

**Step 5: Commit**

```bash
git add server/utils/holidayCache.ts server/utils/holidayCache.test.ts
git commit -m "feat(server): add holiday cache utility with tests

- getHolidayCache: retrieve valid cached holiday
- saveHolidayCache: store new holiday, clear old cache
- invalidateHolidayCache: clear all cache entries
- Tests verify cache validation and expiration"
```

---

## Task 3: Nager.Date API Integration

**Files:**
- Create: `server/utils/nagerDateApi.ts`

**Step 1: Write tests for Nager.Date integration**

Create: `server/utils/nagerDateApi.test.ts`

```typescript
import { describe, expect, it, vi } from "vitest";
import { fetchNextHoliday } from "./nagerDateApi";

describe("nagerDateApi", () => {
  it("should fetch next holiday for Canada", async () => {
    const holiday = await fetchNextHoliday("CA", null);

    expect(holiday).not.toBeNull();
    expect(holiday?.countryCode).toBe("CA");
    expect(holiday?.holidayName).toBeTruthy();
    expect(holiday?.holidayDate).toBeInstanceOf(Date);
  });

  it("should return null when no upcoming holidays found", async () => {
    // Use invalid country code
    const holiday = await fetchNextHoliday("XX", null);
    expect(holiday).toBeNull();
  });

  it("should filter by subdivision when provided", async () => {
    const holiday = await fetchNextHoliday("CA", "CA-ON");

    // Should return holiday valid in Ontario
    expect(holiday).toBeDefined();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test server/utils/nagerDateApi.test.ts`
Expected: FAIL - module not found

**Step 3: Implement Nager.Date API client**

Create: `server/utils/nagerDateApi.ts`

```typescript
import consola from "consola";
import type { HolidayCacheData } from "./holidayCache";

interface NagerHoliday {
  date: string; // "2026-12-25"
  localName: string;
  name: string;
  countryCode: string;
  fixed: boolean;
  global: boolean;
  counties: string[] | null; // ["CA-ON", "CA-BC"] for subdivisions
  launchYear: number | null;
  types: string[];
}

/**
 * Fetch the next upcoming holiday from Nager.Date API
 * @param countryCode - ISO 3166-1 alpha-2 country code (e.g., "CA", "US")
 * @param subdivisionCode - Subdivision code (e.g., "CA-ON" for Ontario), optional
 * @returns Holiday data or null if none found
 */
export async function fetchNextHoliday(
  countryCode: string,
  subdivisionCode: string | null,
): Promise<HolidayCacheData | null> {
  try {
    const year = new Date().getFullYear();
    const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`;

    consola.debug(`Fetching holidays from Nager.Date: ${url}`);

    const response = await $fetch<NagerHoliday[]>(url, {
      timeout: 10000, // 10 second timeout
    });

    if (!response || response.length === 0) {
      consola.warn(`No holidays found for country ${countryCode}`);
      return null;
    }

    // Filter to upcoming holidays
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingHolidays = response
      .filter((holiday) => {
        const holidayDate = new Date(holiday.date);
        holidayDate.setHours(0, 0, 0, 0);

        // Must be today or future
        if (holidayDate < today) {
          return false;
        }

        // If subdivision specified, check if holiday applies to that region
        if (subdivisionCode) {
          // If holiday has no counties array, it's global/national
          if (!holiday.counties || holiday.counties.length === 0) {
            return true;
          }
          // Otherwise, check if subdivision is in the list
          return holiday.counties.includes(subdivisionCode);
        }

        return true;
      })
      .sort((a, b) => {
        // Sort by date, earliest first
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });

    if (upcomingHolidays.length === 0) {
      consola.warn("No upcoming holidays found after filtering");
      return null;
    }

    const nextHoliday = upcomingHolidays[0];

    const result: HolidayCacheData = {
      countryCode,
      subdivisionCode,
      holidayName: nextHoliday.localName || nextHoliday.name,
      holidayDate: new Date(nextHoliday.date),
    };

    consola.info(`Next holiday: ${result.holidayName} on ${result.holidayDate}`);
    return result;
  }
  catch (error) {
    consola.error(`Failed to fetch holidays from Nager.Date:`, error);
    return null;
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test server/utils/nagerDateApi.test.ts`
Expected: PASS - tests may be slow due to API calls

**Step 5: Commit**

```bash
git add server/utils/nagerDateApi.ts server/utils/nagerDateApi.test.ts
git commit -m "feat(server): add Nager.Date API integration

- fetchNextHoliday: get next upcoming holiday for country/region
- Filters by subdivision if provided
- Returns null on API errors or no holidays found
- 10 second timeout for reliability"
```

---

## Task 4: Modify Countdown Endpoint - Add Holiday Fallback

**Files:**
- Modify: `server/api/todos/countdowns.get.ts`

**Step 1: Write test for countdown endpoint with holiday fallback**

Create: `server/api/todos/countdowns.get.test.ts`

```typescript
import { describe, expect, it, beforeEach, vi } from "vitest";
import { eventHandler } from "h3";
import handler from "./countdowns.get";

describe("GET /api/todos/countdowns", () => {
  beforeEach(async () => {
    // Clean up test database
    const prisma = (await import("~/lib/prisma")).default;
    await prisma.todo.deleteMany();
    await prisma.holidayCache.deleteMany();
    await prisma.appSettings.upsert({
      where: { singletonId: 1 },
      update: {
        enableHolidayCountdowns: true,
        holidayCountryCode: "CA",
      },
      create: {
        singletonId: 1,
        enableHolidayCountdowns: true,
        holidayCountryCode: "CA",
      },
    });
  });

  it("should return user countdowns when they exist", async () => {
    const prisma = (await import("~/lib/prisma")).default;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    await prisma.todo.create({
      data: {
        title: "Test Event",
        isCountdown: true,
        completed: false,
        dueDate: tomorrow,
      },
    });

    const event = { node: { req: {}, res: {} } };
    const result = await handler(event as any);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Test Event");
    expect(result[0].isCountdown).toBe(true);
  });

  it("should return holiday countdown when no user countdowns exist", async () => {
    const event = { node: { req: {}, res: {} } };
    const result = await handler(event as any);

    // Should either return cached holiday or fetch from API
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0].title).toBeTruthy();
      expect(result[0].isHoliday).toBe(true);
    }
  });

  it("should not return holiday when feature disabled", async () => {
    const prisma = (await import("~/lib/prisma")).default;
    await prisma.appSettings.update({
      where: { singletonId: 1 },
      data: { enableHolidayCountdowns: false },
    });

    const event = { node: { req: {}, res: {} } };
    const result = await handler(event as any);

    expect(result).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test server/api/todos/countdowns.get.test.ts`
Expected: FAIL - test expects holiday fallback

**Step 3: Modify countdown endpoint to add holiday fallback**

Modify: `server/api/todos/countdowns.get.ts`

```typescript
import consola from "consola";

import prisma from "~/lib/prisma";
import { getHolidayCache, saveHolidayCache } from "~/server/utils/holidayCache";
import { fetchNextHoliday } from "~/server/utils/nagerDateApi";

export default defineEventHandler(async (_event) => {
  try {
    const now = new Date();

    // Query for all uncompleted countdown todos with future due dates
    const userCountdowns = await prisma.todo.findMany({
      where: {
        isCountdown: true,
        completed: false,
        dueDate: {
          gte: now,
        },
      },
      orderBy: {
        dueDate: "asc", // Sort by earliest first
      },
      include: {
        todoColumn: {
          select: {
            id: true,
            name: true,
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    // If user countdowns exist, return them (existing behavior)
    if (userCountdowns.length > 0) {
      consola.debug(`Found ${userCountdowns.length} user countdowns`);
      return userCountdowns;
    }

    // No user countdowns - check if holiday fallback is enabled
    const settings = await prisma.appSettings.findUnique({
      where: { singletonId: 1 },
    });

    if (!settings?.enableHolidayCountdowns) {
      consola.debug("Holiday countdowns disabled, returning empty array");
      return [];
    }

    // Try to get cached holiday
    let holidayCache = await getHolidayCache();

    // If no valid cache, fetch from Nager.Date API
    if (!holidayCache) {
      consola.debug("No valid holiday cache, fetching from Nager.Date API");

      const nextHoliday = await fetchNextHoliday(
        settings.holidayCountryCode,
        settings.holidaySubdivisionCode,
      );

      if (!nextHoliday) {
        consola.warn("No upcoming holidays found from API");
        return [];
      }

      // Cache the holiday
      holidayCache = await saveHolidayCache(nextHoliday);
    }

    // Format holiday as a countdown todo for frontend consumption
    const holidayCountdown = {
      id: `holiday-${holidayCache.id}`,
      title: holidayCache.holidayName,
      description: null,
      completed: false,
      priority: "MEDIUM" as const,
      dueDate: holidayCache.holidayDate,
      order: 0,
      createdAt: holidayCache.createdAt,
      updatedAt: holidayCache.updatedAt,
      isCountdown: true,
      isHoliday: true, // Flag to indicate this is a holiday countdown
      countdownMessage: null, // Will be generated by frontend
      messageGeneratedAt: null,
      todoColumnId: null,
      todoColumn: null,
    };

    consola.debug(`Returning holiday countdown: ${holidayCache.holidayName}`);
    return [holidayCountdown];
  }
  catch (error) {
    consola.error("Failed to fetch countdowns:", error);
    throw createError({
      statusCode: 500,
      message: `Failed to fetch countdowns: ${error}`,
    });
  }
});
```

**Step 4: Run test to verify it passes**

Run: `npm run test server/api/todos/countdowns.get.test.ts`
Expected: PASS - all tests green

**Step 5: Test manually with API call**

Run: `curl http://localhost:3000/api/todos/countdowns`
Expected: Returns holiday countdown JSON

**Step 6: Commit**

```bash
git add server/api/todos/countdowns.get.ts server/api/todos/countdowns.get.test.ts
git commit -m "feat(api): add holiday fallback to countdown endpoint

- Return user countdowns if they exist (unchanged behavior)
- Fall back to holiday countdown when no user countdowns
- Check holiday cache first, fetch from API if needed
- Respect enableHolidayCountdowns setting
- Format holiday as countdown todo for frontend compatibility"
```

---

## Task 5: Settings API - Holiday Configuration Endpoints

**Files:**
- Create: `server/api/settings/holiday-countries.get.ts`
- Create: `server/api/settings/holiday-countries/[code].get.ts`

**Step 1: Create endpoint to fetch available countries**

Create: `server/api/settings/holiday-countries.get.ts`

```typescript
import consola from "consola";

interface NagerCountry {
  countryCode: string;
  name: string;
}

export default defineEventHandler(async (_event) => {
  try {
    consola.debug("Fetching available countries from Nager.Date");

    const countries = await $fetch<NagerCountry[]>(
      "https://date.nager.at/api/v3/AvailableCountries",
      {
        timeout: 10000,
      },
    );

    consola.debug(`Found ${countries.length} countries`);
    return countries;
  }
  catch (error) {
    consola.error("Failed to fetch countries:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to fetch available countries",
    });
  }
});
```

**Step 2: Test the countries endpoint**

Run: `curl http://localhost:3000/api/settings/holiday-countries`
Expected: Returns array of countries with countryCode and name

**Step 3: Create endpoint to fetch country info with subdivisions**

Create: `server/api/settings/holiday-countries/[code].get.ts`

```typescript
import consola from "consola";

interface NagerCountryInfo {
  commonName: string;
  officialName: string;
  countryCode: string;
  region: string;
  borders: Array<{ commonName: string; officialName: string; countryCode: string }> | null;
}

export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, "code");

  if (!code) {
    throw createError({
      statusCode: 400,
      message: "Country code is required",
    });
  }

  try {
    consola.debug(`Fetching country info for ${code}`);

    const countryInfo = await $fetch<NagerCountryInfo>(
      `https://date.nager.at/api/v3/CountryInfo/${code}`,
      {
        timeout: 10000,
      },
    );

    return countryInfo;
  }
  catch (error) {
    consola.error(`Failed to fetch country info for ${code}:`, error);
    throw createError({
      statusCode: 500,
      message: `Failed to fetch country information for ${code}`,
    });
  }
});
```

**Step 4: Test the country info endpoint**

Run: `curl http://localhost:3000/api/settings/holiday-countries/CA`
Expected: Returns country info for Canada

**Step 5: Commit**

```bash
git add server/api/settings/holiday-countries.get.ts server/api/settings/holiday-countries/[code].get.ts
git commit -m "feat(api): add holiday settings endpoints

- GET /api/settings/holiday-countries: list available countries
- GET /api/settings/holiday-countries/:code: get country details
- Proxy Nager.Date API to avoid CORS issues
- 10 second timeouts for reliability"
```

---

## Task 6: App Settings API - Update with Holiday Settings

**Files:**
- Modify: `server/api/app-settings.get.ts` (if exists)
- Modify: `server/api/app-settings.put.ts` (if exists)

**Step 1: Find existing app settings endpoints**

Run: `find server/api -name "*app-settings*" -o -name "*settings*" | grep -v holiday`
Expected: List of existing settings endpoints

**Step 2: Add holiday settings to GET endpoint**

Modify the app settings GET endpoint to include holiday settings in response.

**Step 3: Add holiday settings to PUT endpoint**

Modify the app settings PUT endpoint to accept and save:
- `holidayCountryCode`
- `holidaySubdivisionCode`
- `enableHolidayCountdowns`

When settings change, invalidate holiday cache:

```typescript
import { invalidateHolidayCache } from "~/server/utils/holidayCache";

// After updating settings
if (body.holidayCountryCode !== undefined || body.holidaySubdivisionCode !== undefined) {
  await invalidateHolidayCache();
  consola.info("Holiday cache invalidated due to settings change");
}
```

**Step 4: Test settings update**

Run settings update API call with new holiday settings.
Expected: Settings saved, cache invalidated

**Step 5: Commit**

```bash
git add server/api/app-settings*.ts
git commit -m "feat(api): add holiday settings to app settings API

- Include holiday settings in GET response
- Accept holiday settings in PUT request
- Invalidate holiday cache when country/subdivision changes
- Enables frontend configuration"
```

---

## Task 7: Frontend Settings UI - Holiday Configuration

**Files:**
- Modify: `app/pages/settings.vue`

**Step 1: Find settings page structure**

Read: `app/pages/settings.vue` to understand current layout.

**Step 2: Add Holiday Countdowns section to settings**

Add new section in settings page:

```vue
<template>
  <!-- ... existing settings sections ... -->

  <!-- Holiday Countdowns Section -->
  <div class="settings-section">
    <h2 class="text-xl font-semibold mb-4">Holiday Countdowns</h2>

    <div class="space-y-4">
      <!-- Enable Toggle -->
      <div class="flex items-center justify-between">
        <div>
          <label class="font-medium">Enable Holiday Countdowns</label>
          <p class="text-sm text-muted">
            Show holidays when no countdown events exist
          </p>
        </div>
        <UToggle
          v-model="settings.enableHolidayCountdowns"
          @update:model-value="saveSettings"
        />
      </div>

      <!-- Country Selection -->
      <div v-if="settings.enableHolidayCountdowns">
        <label class="block font-medium mb-2">Country</label>
        <USelectMenu
          v-model="selectedCountry"
          :options="countries"
          option-attribute="name"
          value-attribute="countryCode"
          searchable
          :loading="loadingCountries"
          @update:model-value="handleCountryChange"
        />
      </div>

      <!-- Subdivision Selection -->
      <div v-if="settings.enableHolidayCountdowns && showSubdivision">
        <label class="block font-medium mb-2">Region/Subdivision</label>
        <p class="text-sm text-muted mb-2">
          Optional. If not selected, national holidays will be used.
        </p>
        <USelectMenu
          v-model="settings.holidaySubdivisionCode"
          :options="subdivisions"
          searchable
          clearable
          :loading="loadingSubdivisions"
          placeholder="Select a region (optional)"
          @update:model-value="saveSettings"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const settings = ref({
  enableHolidayCountdowns: true,
  holidayCountryCode: "CA",
  holidaySubdivisionCode: null,
});

const countries = ref([]);
const subdivisions = ref([]);
const selectedCountry = ref(null);
const loadingCountries = ref(false);
const loadingSubdivisions = ref(false);
const showSubdivision = computed(() => subdivisions.value.length > 0);

async function loadCountries() {
  loadingCountries.value = true;
  try {
    countries.value = await $fetch("/api/settings/holiday-countries");
  } catch (error) {
    console.error("Failed to load countries:", error);
  } finally {
    loadingCountries.value = false;
  }
}

async function handleCountryChange(country) {
  settings.value.holidayCountryCode = country.countryCode;
  settings.value.holidaySubdivisionCode = null;
  subdivisions.value = [];

  // Fetch subdivisions for selected country
  loadingSubdivisions.value = true;
  try {
    const countryInfo = await $fetch(
      `/api/settings/holiday-countries/${country.countryCode}`
    );
    // Parse subdivisions from country info if available
    // (Nager.Date doesn't directly provide subdivisions, may need different approach)
  } catch (error) {
    console.error("Failed to load subdivisions:", error);
  } finally {
    loadingSubdivisions.value = false;
  }

  await saveSettings();
}

async function saveSettings() {
  try {
    await $fetch("/api/app-settings", {
      method: "PUT",
      body: settings.value,
    });
  } catch (error) {
    console.error("Failed to save settings:", error);
  }
}

onMounted(() => {
  loadCountries();
  // Load current settings
});
</script>
```

**Step 3: Test settings UI**

Run dev server, navigate to settings page.
Expected: Holiday section visible, dropdowns work

**Step 4: Commit**

```bash
git add app/pages/settings.vue
git commit -m "feat(ui): add holiday countdown settings UI

- Enable/disable holiday countdowns toggle
- Country selection with searchable dropdown
- Subdivision selection with help text
- Auto-save on changes
- Load countries from API on mount"
```

---

## Task 8: Frontend Type Updates - Add isHoliday Flag

**Files:**
- Modify: `app/types/database.ts`

**Step 1: Add isHoliday property to Todo type**

Find Todo type definition and add optional isHoliday:

```typescript
export interface Todo {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  priority: Priority;
  dueDate: Date | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  isCountdown: boolean;
  isHoliday?: boolean; // NEW: Flag for holiday countdowns
  countdownMessage: string | null;
  messageGeneratedAt: Date | null;
  todoColumnId: string | null;
  todoColumn: TodoColumn | null;
}
```

**Step 2: Update countdown composable if needed**

Check if useCountdowns needs updates to handle isHoliday flag.

**Step 3: Commit**

```bash
git add app/types/database.ts
git commit -m "feat(types): add isHoliday flag to Todo type

- Support holiday countdown identification
- Optional field for backward compatibility"
```

---

## Task 9: Integration Testing - End to End

**Files:**
- Create: `tests/e2e/holiday-countdown.spec.ts` (if E2E tests exist)

**Step 1: Test complete user flow**

Manual testing checklist:
1. ✓ Navigate to settings
2. ✓ Enable holiday countdowns
3. ✓ Select Canada as country
4. ✓ Save settings
5. ✓ Navigate to home screen
6. ✓ Verify holiday countdown displays (no user countdowns)
7. ✓ Create a user countdown event
8. ✓ Verify user countdown displays (holiday hidden)
9. ✓ Delete user countdown
10. ✓ Verify holiday countdown returns

**Step 2: Test API failure scenarios**

1. ✓ Disconnect network, reload home page
2. ✓ Verify cached holiday still displays
3. ✓ Clear cache, reload with no network
4. ✓ Verify no countdown shows (graceful degradation)

**Step 3: Test Gemini message generation**

1. ✓ Ensure Gemini integration configured
2. ✓ View holiday countdown
3. ✓ Verify AI message generates for holiday

**Step 4: Document test results**

Create test report documenting all scenarios tested.

**Step 5: Commit**

```bash
git add tests/e2e/holiday-countdown.spec.ts
git commit -m "test: add holiday countdown E2E tests

- Test settings configuration
- Test countdown priority (user vs holiday)
- Test API failure scenarios
- Test Gemini message generation"
```

---

## Task 10: Documentation Updates

**Files:**
- Modify: `README.md`
- Create: `docs/features/holiday-countdowns.md` (optional)

**Step 1: Update README features section**

Add under Countdown Widget:

```markdown
- **Holiday Countdown Fallback** - Automatically displays next upcoming public holiday when no user countdowns exist
  - Configurable by country and region
  - Uses Nager.Date API for 100+ countries
  - Smart caching to minimize API calls
  - AI-generated whimsical messages
```

**Step 2: Create holiday countdowns feature documentation**

Optional detailed docs explaining:
- How to configure country/region
- How caching works
- Supported countries
- API integration details

**Step 3: Update CHANGELOG**

Add entry for this feature release.

**Step 4: Commit**

```bash
git add README.md docs/features/holiday-countdowns.md CHANGELOG.md
git commit -m "docs: add holiday countdown fallback documentation

- Update README with feature description
- Add detailed feature documentation
- Document configuration options and caching"
```

---

## Task 11: Final Testing & Polish

**Step 1: Run full test suite**

Run: `npm run test`
Expected: All tests pass

**Step 2: Run type checking**

Run: `npm run type-check`
Expected: No TypeScript errors

**Step 3: Run linting**

Run: `npm run lint`
Expected: No linting errors

**Step 4: Test on local development**

1. Start dev server: `npm run dev`
2. Test all functionality manually
3. Verify no console errors
4. Test with different countries

**Step 5: Build for production**

Run: `npm run build`
Expected: Clean build, no errors

**Step 6: Final commit**

```bash
git add .
git commit -m "chore: final polish for holiday countdown feature

- All tests passing
- Type checking clean
- Linting clean
- Production build verified"
```

---

## Task 12: Create Pull Request

**Step 1: Push feature branch**

Run: `git push origin feature/holiday-countdown-fallback`
Expected: Branch pushed to remote

**Step 2: Create pull request**

Use GitHub CLI or web interface to create PR with description from design doc.

**Step 3: Add PR description**

```markdown
## Holiday Countdown Fallback

Implements automatic holiday countdown fallback when no user countdowns exist.

### Features
- ✅ Nager.Date API integration (100+ countries)
- ✅ Smart caching to minimize API calls
- ✅ Configurable by country/region
- ✅ AI-generated messages via Gemini
- ✅ User countdowns always take priority
- ✅ Graceful error handling

### Testing
- Unit tests for all utilities
- API endpoint tests
- Manual E2E testing completed
- Works in offline mode with cache

### Breaking Changes
None - backward compatible

### Documentation
- README updated
- Feature documentation added
- Design doc in docs/plans/

Closes #[issue-number]
```

**Step 4: Request review**

Assign reviewers and mark PR as ready for review.

---

## Success Criteria Verification

Before merging, verify:

- ✅ Countdown widget always shows something when enabled
- ✅ User countdowns always take priority over holidays
- ✅ Minimal API calls through smart caching
- ✅ Works for multiple countries/regions
- ✅ Gemini messages work for holidays
- ✅ Configurable in settings
- ✅ No impact on mobile APK
- ✅ Graceful degradation on API failures
- ✅ All tests passing
- ✅ Documentation complete

---

## Notes for Implementation

### Testing Strategy
- Write tests FIRST (TDD)
- Run tests after each implementation step
- Commit after each passing test + implementation

### Code Quality
- DRY: Reuse existing countdown infrastructure
- YAGNI: No custom holiday lists, no holiday history
- Keep commits small and focused

### Error Handling
- Always handle API failures gracefully
- Log errors for debugging
- Never crash the home screen

### Performance
- Cache aggressively (only fetch when needed)
- 10 second timeouts on all external API calls
- No blocking operations on home screen load
