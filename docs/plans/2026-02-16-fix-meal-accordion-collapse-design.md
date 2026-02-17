# Fix Meal Accordion Collapse on Save

**Date:** 2026-02-16
**Status:** Approved

## Problem

On the APK (mobile), when a user adds/edits/deletes a meal via the inline form, the entire accordion collapses. The user must scroll back and re-expand the day they were working on. Expected behavior: the accordion stays open on the current day, showing the newly added meal.

## Root Cause

In `mealPlanner.vue`, every CRUD operation calls `loadWeekMealPlan()`, which sets `loading.value = true`. The template uses `v-if="loading"` to show a spinner, which **unmounts** the `WeeklyMealGrid` component entirely. When loading finishes and the grid remounts, `onMounted` resets `expandedDay` to the default — destroying the accordion state.

The `weeklyMealGrid.vue` component already has a `preserveExpandedDay` mechanism designed to survive data reloads, but it never gets a chance to work because the component is destroyed and recreated.

## Solution

Separate initial page load from data refresh. Use `loading` only for the initial load and week navigation. CRUD operations update `currentPlan` without setting `loading = true`, so the grid stays mounted and the existing preservation logic works.

### Changes

**`mealPlanner.vue` only** — no changes to `weeklyMealGrid.vue`.

1. Stop setting `loading = true` in CRUD reload calls
2. Extract a `reloadMealPlan()` function that fetches data without the loading spinner
3. Call `reloadMealPlan()` from all CRUD handlers instead of `loadWeekMealPlan()`
4. Keep `loadWeekMealPlan()` (with spinner) for initial mount and week navigation

### Files to Fix

1. `app/pages/mealPlanner.vue` — add `reloadMealPlan()`, update CRUD handlers

### Tests

Add unit test verifying that `reloadMealPlan` updates data without toggling `loading`.
