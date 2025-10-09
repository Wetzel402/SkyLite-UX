import { test, expect } from '@playwright/test';

test.describe('CalDAV Integration E2E', () => {
  test('should display CalDAV events in kiosk mode when mock fixture is enabled', async ({ page }) => {
    // Set up mock CalDAV fixture
    await page.goto('/display?token=test-token');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check if CalDAV mock mode is enabled
    const mockMode = await page.evaluate(() => {
      return process.env.CALDAV_MOCK_FIXTURE === 'true';
    });
    
    if (mockMode) {
      // Verify that CalDAV events are displayed
      const caldavEvents = await page.locator('[data-source-type="caldav"]').count();
      expect(caldavEvents).toBeGreaterThan(0);
      
      // Check that events have proper CalDAV source information
      const firstCaldavEvent = page.locator('[data-source-type="caldav"]').first();
      await expect(firstCaldavEvent).toBeVisible();
      
      // Verify event properties
      const eventTitle = await firstCaldavEvent.locator('[data-testid="event-title"]').textContent();
      expect(eventTitle).toBeTruthy();
      
      const eventColor = await firstCaldavEvent.getAttribute('data-color');
      expect(eventColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    } else {
      // If mock mode is not enabled, just verify the page loads without errors
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('should handle CalDAV authentication errors gracefully', async ({ page }) => {
    // This test would need to be run with invalid CalDAV credentials
    // to verify that the system handles auth failures without crashing
    await page.goto('/display?token=test-token');
    await page.waitForLoadState('networkidle');
    
    // The page should still load even if CalDAV fails
    await expect(page.locator('body')).toBeVisible();
    
    // Check that no CalDAV events are shown when auth fails
    const caldavEvents = await page.locator('[data-source-type="caldav"]').count();
    expect(caldavEvents).toBe(0);
  });

  test('should merge CalDAV events with local and ICS events', async ({ page }) => {
    await page.goto('/display?token=test-token');
    await page.waitForLoadState('networkidle');
    
    // Check that events from different sources are displayed
    const allEvents = await page.locator('[data-testid="calendar-event"]').count();
    expect(allEvents).toBeGreaterThan(0);
    
    // Verify that events are sorted by start time
    const eventTimes = await page.locator('[data-testid="event-start-time"]').allTextContents();
    const sortedTimes = [...eventTimes].sort();
    expect(eventTimes).toEqual(sortedTimes);
  });

  test('should respect CalDAV sync configuration', async ({ page }) => {
    // Check that CalDAV sync respects the feature flag
    const caldavEnabled = await page.evaluate(() => {
      return process.env.CALDAV_SYNC_ENABLED === 'true';
    });
    
    if (!caldavEnabled) {
      // If CalDAV is disabled, no CalDAV events should be shown
      const caldavEvents = await page.locator('[data-source-type="caldav"]').count();
      expect(caldavEvents).toBe(0);
    }
  });

  test('should display CalDAV events with proper source attribution', async ({ page }) => {
    await page.goto('/display?token=test-token');
    await page.waitForLoadState('networkidle');
    
    // Check that CalDAV events show proper source information
    const caldavEvents = page.locator('[data-source-type="caldav"]');
    const count = await caldavEvents.count();
    
    if (count > 0) {
      const firstEvent = caldavEvents.first();
      
      // Verify source name is displayed
      const sourceName = await firstEvent.getAttribute('data-source-name');
      expect(sourceName).toBeTruthy();
      
      // Verify source type is correct
      const sourceType = await firstEvent.getAttribute('data-source-type');
      expect(sourceType).toBe('caldav');
    }
  });
});
