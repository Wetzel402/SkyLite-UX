import { test, expect } from '@playwright/test';
import { getMockEventsResponse } from './utils/test-data';

test.describe('ICS Calendar Sync', () => {
  test.beforeEach(async ({ page }) => {
    // Set up environment variables for kiosk mode
    await page.addInitScript(() => {
      (window as any).__NUXT__.config = {
        public: {
          enableKioskMode: true
        }
      };
    });
  });

  test('displays ICS events in kiosk mode', async ({ page }) => {
    // Mock the API response to include ICS events
    const mockResponse = {
      events: [
        {
          id: 'family-event-1',
          title: 'Family Dinner',
          start: new Date().toISOString(),
          end: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          allDay: false,
          color: '#4C6FFF',
          location: '123 Main St, Anytown, USA',
          sourceName: 'Family',
          sourceType: 'ics',
        },
        {
          id: 'school-event-1',
          title: 'Math Class',
          start: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          end: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
          allDay: false,
          color: '#E85D04',
          location: 'School Building, Room 201',
          sourceName: 'School',
          sourceType: 'ics',
        },
      ],
      weekStart: new Date().toISOString(),
      weekEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      totalEvents: 2,
      lastUpdated: new Date().toISOString(),
    };

    await page.route('/api/events/week*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse)
      });
    });

    // Navigate to kiosk display with token
    await page.goto('/display?token=test-token');

    // Check that the page loads
    await expect(page).toHaveTitle(/SkyLite UX/);
    
    // Check for ICS events
    await expect(page.locator('text=Family Dinner')).toBeVisible();
    await expect(page.locator('text=Math Class')).toBeVisible();
    
    // Check for source names
    await expect(page.locator('text=Family')).toBeVisible();
    await expect(page.locator('text=School')).toBeVisible();
    
    // Check for locations
    await expect(page.locator('text=123 Main St, Anytown, USA')).toBeVisible();
    await expect(page.locator('text=School Building, Room 201')).toBeVisible();
  });

  test('handles ICS sync errors gracefully', async ({ page }) => {
    // Mock API error response
    await page.route('/api/events/week*', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'ICS sync failed' })
      });
    });

    // Navigate to kiosk display
    await page.goto('/display?token=test-token');

    // Should still load the page even with sync errors
    await expect(page).toHaveTitle(/SkyLite UX/);
    
    // Should show error state or fallback content
    await expect(page.locator('text=Unable to load events')).toBeVisible();
  });

  test('displays mixed local and ICS events', async ({ page }) => {
    const mockResponse = {
      events: [
        // Local event
        {
          id: 'local-event-1',
          title: 'Local Meeting',
          start: new Date().toISOString(),
          end: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          allDay: false,
          color: '#10B981',
          sourceName: 'Local',
          sourceType: 'local',
        },
        // ICS event
        {
          id: 'ics-event-1',
          title: 'ICS Event',
          start: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          end: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
          allDay: false,
          color: '#4C6FFF',
          sourceName: 'Family',
          sourceType: 'ics',
        },
      ],
      weekStart: new Date().toISOString(),
      weekEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      totalEvents: 2,
      lastUpdated: new Date().toISOString(),
    };

    await page.route('/api/events/week*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse)
      });
    });

    await page.goto('/display?token=test-token');

    // Both events should be visible
    await expect(page.locator('text=Local Meeting')).toBeVisible();
    await expect(page.locator('text=ICS Event')).toBeVisible();
    
    // Source names should be displayed
    await expect(page.locator('text=Local')).toBeVisible();
    await expect(page.locator('text=Family')).toBeVisible();
  });
});
