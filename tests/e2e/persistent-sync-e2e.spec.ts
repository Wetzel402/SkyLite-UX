import { test, expect } from '@playwright/test';

test.describe('Persistent Sync E2E', () => {
  test('should display events from database after sync', async ({ page }) => {
    // Mock environment variables for testing
    await page.addInitScript(() => {
      // Mock environment variables
      (window as any).__NUXT__.config = {
        public: {
          enableKioskMode: true
        }
      };
    });

    // Mock API responses
    await page.route('/api/events/week*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          events: [
            {
              id: 'test-event-1',
              title: 'Test Event from Database',
              description: 'This event was synced and stored in the database',
              start: new Date().toISOString(),
              end: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
              allDay: false,
              color: '#FF0000',
              location: 'Test Location',
              users: []
            }
          ],
          weekStart: new Date().toISOString(),
          weekEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          totalEvents: 1,
          lastUpdated: new Date().toISOString()
        })
      });
    });

    // Navigate to kiosk display
    const response = await page.goto('/display');
    expect(response?.status()).toBe(200);

    // Verify event is displayed
    await expect(page.locator('text=Test Event from Database')).toBeVisible();
    await expect(page.locator('text=This event was synced and stored in the database')).toBeVisible();
  });

  test('should handle sync service unavailable gracefully', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__NUXT__.config = {
        public: {
          enableKioskMode: true
        }
      };
    });

    // Mock API to return service unavailable
    await page.route('/api/events/week*', async route => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Event merger service not available'
        })
      });
    });

    const response = await page.goto('/display');
    expect(response?.status()).toBe(200);

    // Should show empty state or error message
    await expect(page.locator('text=Unable to fetch events')).toBeVisible();
  });
});

