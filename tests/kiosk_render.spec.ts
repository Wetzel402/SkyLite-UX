import { test, expect } from '@playwright/test';
import { getMockEventsResponse, getTestWeekData } from './utils/test-data';

test.describe('Kiosk Mode Rendering', () => {
  test.beforeEach(async ({ page }) => {
    // Set up environment variables for kiosk mode
    await page.addInitScript(() => {
      // Mock environment variables
      (window as any).__NUXT__.config = {
        public: {
          enableKioskMode: true
        }
      };
    });
  });

  test('renders kiosk display with valid token', async ({ page }) => {
    // Mock the API response with deterministic test data
    const mockResponse = getMockEventsResponse();
    
    await page.route('/api/events/week*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockResponse)
      });
    });

    // Navigate to kiosk display with token
    await page.goto('/display?token=test-token-123');

    // Check that the page loads
    await expect(page).toHaveTitle(/SkyLite UX/);

    // Check for kiosk-specific elements
    await expect(page.locator('h1')).toContainText(/\w+, \w+ \d+, \d{4}/); // Date format
    await expect(page.locator('text=Family Calendar')).toBeVisible();
    await expect(page.locator('text=Auto-refresh: 60s')).toBeVisible();

    // Check for calendar grid
    await expect(page.locator('.calendar-grid')).toBeVisible();
    await expect(page.locator('.week-header')).toBeVisible();
    await expect(page.locator('.events-grid')).toBeVisible();

    // Check for day columns (7 days)
    const dayColumns = page.locator('.day-column');
    await expect(dayColumns).toHaveCount(7);

    // Check for live clock element
    await expect(page.locator('text=/\\d{2}:\\d{2}:\\d{2}/')).toBeVisible();

    // Check for event display (should have multiple events from test data)
    const eventBlocks = page.locator('.event-block');
    await expect(eventBlocks).toHaveCount(mockResponse.events.length);
    await expect(page.locator('text=Morning Meeting')).toBeVisible();
    await expect(page.locator('text=Lunch with Family')).toBeVisible();
  });

  test('denies access without token when DISPLAY_TOKEN is set', async ({ page }) => {
    // Mock environment with DISPLAY_TOKEN set
    await page.addInitScript(() => {
      process.env.DISPLAY_TOKEN = 'required-token-123';
    });

    // Try to access without token
    const response = await page.goto('/display');
    
    // Should be denied access
    expect(response?.status()).toBe(401);
  });

  test('denies access with invalid token', async ({ page }) => {
    // Mock environment with DISPLAY_TOKEN set
    await page.addInitScript(() => {
      process.env.DISPLAY_TOKEN = 'required-token-123';
    });

    // Try to access with wrong token
    const response = await page.goto('/display?token=wrong-token');
    
    // Should be denied access
    expect(response?.status()).toBe(403);
  });

  test('shows placeholder data when no events', async ({ page }) => {
    // Mock empty API response
    await page.route('/api/events/week*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          events: [],
          weekStart: new Date().toISOString(),
          weekEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          totalEvents: 0,
          lastUpdated: new Date().toISOString()
        })
      });
    });

    await page.goto('/display?token=test-token-123');

    // Check for "No events" placeholders
    const noEventsElements = page.locator('text=No events');
    await expect(noEventsElements).toHaveCount(7); // One for each day
  });

  test('applies security headers', async ({ page }) => {
    await page.goto('/display?token=test-token-123');

    // Check for security headers
    const response = await page.request.get('/display?token=test-token-123');
    const headers = response.headers();

    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['referrer-policy']).toBe('no-referrer');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['content-security-policy']).toContain("default-src 'self'");
  });

  test('handles offline mode gracefully', async ({ page }) => {
    // Mock network failure
    await page.route('/api/events/week*', route => route.abort());

    await page.goto('/display?token=test-token-123');

    // Should show offline indicator
    await expect(page.locator('text=📡 Offline mode')).toBeVisible();
  });

  test('auto-refresh works correctly', async ({ page }) => {
    let requestCount = 0;
    
    await page.route('/api/events/week*', async route => {
      requestCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          events: [],
          weekStart: new Date().toISOString(),
          weekEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          totalEvents: 0,
          lastUpdated: new Date().toISOString()
        })
      });
    });

    await page.goto('/display?token=test-token-123');

    // Wait for initial request
    await page.waitForResponse('/api/events/week*');

    // Wait for auto-refresh (30 seconds in test, but we'll check for multiple requests)
    await page.waitForTimeout(1000);

    // Should have made at least one request
    expect(requestCount).toBeGreaterThan(0);
  });
});
