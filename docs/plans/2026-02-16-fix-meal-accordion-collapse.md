# Fix Meal Accordion Collapse Implementation Plan

**Goal:** Stop the meal accordion from collapsing after adding/editing/deleting a meal on mobile.

**Architecture:** Extract a shared `fetchMealPlan({ showLoading })` function with two thin wrappers: `loadWeekMealPlan()` (with spinner, for initial load/navigation) and `reloadMealPlan()` (no spinner, for CRUD operations). This keeps `WeeklyMealGrid` mounted after CRUD so its accordion preservation logic works.

**Tech Stack:** TypeScript, Vue 3, Nuxt 3, Vitest

---

## Tasks

### Task 1: Add `reloadMealPlan()` and update CRUD handlers

**Files:**
- Modify: `app/pages/mealPlanner.vue`

**Step 1: Testing note**

No unit test for `mealPlanner.vue` — it's a Nuxt page with heavy framework dependencies
(composables, auto-imports, Nuxt data) that would require extensive mocking for minimal value.

Key invariant: `reloadMealPlan()` calls `fetchMealPlan({ showLoading: false })`, which never
sets `loading.value`. This keeps `WeeklyMealGrid` mounted so accordion state is preserved.

Verification is via:
- Visual testing on the APK (accordion stays open after adding a meal)
- Existing integration tests still pass
- Lint and type-check pass

**Step 2: Apply the fix to `mealPlanner.vue`**

Extract a shared `fetchMealPlan({ showLoading })` function that centralizes the fetch/create
logic and conditionally toggles `loading.value`. Add two thin wrappers:

```typescript
// Core fetch logic for meal plan data.
// When showLoading is true (initial load, week navigation), sets loading.value
// which triggers v-if="loading" and unmounts/remounts WeeklyMealGrid.
// When false (CRUD operations), keeps the grid mounted so accordion state is preserved.
async function fetchMealPlan({ showLoading = false } = {}) {
  if (showLoading) loading.value = true;
  try { /* fetch or create plan */ }
  catch (error) { /* error handling, only set empty plan when showLoading */ }
  finally { if (showLoading) loading.value = false; }
}

// Initial load / week navigation — shows spinner
function loadWeekMealPlan() {
  return fetchMealPlan({ showLoading: true });
}

// Silent reload after CRUD — no spinner, preserves accordion state on mobile
function reloadMealPlan() {
  return fetchMealPlan({ showLoading: false });
}
```

**Step 3: Update all CRUD handlers to use `reloadMealPlan()`**

Replace `await loadWeekMealPlan()` with `await reloadMealPlan()` in these functions:

1. `handleMealSaveFromInline` (line ~172) — inline add
2. `handleMealSave` (line ~200) — dialog add/edit
3. `handleMealDelete` (line ~220) — dialog delete
4. `handleMealDeleteFromInline` (line ~242) — inline delete
5. `handleMoveMeal` (line ~293) — move meal

Keep `loadWeekMealPlan()` (with spinner) in:
- `onMounted` (initial page load)
- `watch(currentWeekStart)` (week navigation)

**Step 4: Run lint and type-check**

Run: `npx nuxi prepare && npm run lint && npm run type-check`
Expected: No new errors

**Step 5: Run all tests**

Run: `npx vitest run`
Expected: All existing tests pass

**Step 6: Commit**

```bash
git add app/pages/mealPlanner.vue
git commit -m "fix: prevent meal accordion collapse after CRUD operations"
```

---

### Task 2: Run full verification

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

**Step 2: Run lint**

Run: `npm run lint`
Expected: No new lint errors

**Step 3: Run type check**

Run: `npm run type-check`
Expected: No type errors (pre-existing `routeRules` error is acceptable)
