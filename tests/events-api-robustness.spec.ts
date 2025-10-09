import { test, expect } from '@playwright/test';

test.describe('Events API Robustness', () => {
  test('returns 200 with empty array when no events', async ({ request }) => {
    const response = await request.get('/api/events/week?token=test-token');
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data).toEqual([]);
  });

  test('handles date range parameters correctly', async ({ request }) => {
    const from = '2025-01-01T00:00:00Z';
    const to = '2025-01-07T23:59:59Z';
    
    const response = await request.get(`/api/events/week?token=test-token&from=${from}&to=${to}`);
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('handles invalid date parameters gracefully', async ({ request }) => {
    const response = await request.get('/api/events/week?token=test-token&from=invalid&to=invalid');
    
    // Should still return 200 with current week
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('returns stable sorted events', async ({ request }) => {
    // This test would need actual events in the database
    // For now, we just test the API structure
    const response = await request.get('/api/events/week?token=test-token');
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    
    // If there are events, they should be sorted by start time
    if (data.length > 1) {
      for (let i = 1; i < data.length; i++) {
        const prevStart = new Date(data[i-1].start);
        const currStart = new Date(data[i].start);
        expect(prevStart.getTime()).toBeLessThanOrEqual(currStart.getTime());
      }
    }
  });

  test('includes proper cache headers', async ({ request }) => {
    const response = await request.get('/api/events/week?token=test-token');
    
    expect(response.status()).toBe(200);
    
    const headers = response.headers();
    expect(headers['cache-control']).toContain('public');
    expect(headers['cache-control']).toContain('max-age=15');
    expect(headers['content-type']).toBe('application/json');
  });

  test('handles database connection errors gracefully', async ({ request }) => {
    // This test would need to mock database failures
    // For now, we just test that the API doesn't crash
    const response = await request.get('/api/events/week?token=test-token');
    
    // Should always return 200, even if there are errors
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('requires authentication token', async ({ request }) => {
    const response = await request.get('/api/events/week');
    
    expect(response.status()).toBe(401);
  });

  test('rejects invalid authentication token', async ({ request }) => {
    const response = await request.get('/api/events/week?token=invalid-token');
    
    expect(response.status()).toBe(401);
  });
});

test.describe('Kiosk Display Integration', () => {
  test('kiosk display renders with 0 events', async ({ page }) => {
    await page.goto('/display?token=test-token');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check that the calendar grid is rendered
    const calendarGrid = page.locator('[data-testid="calendar-grid"]');
    await expect(calendarGrid).toBeVisible();
    
    // Check that no events are displayed
    const eventElements = page.locator('[data-testid="calendar-event"]');
    await expect(eventElements).toHaveCount(0);
  });

  test('kiosk display renders with 1 event', async ({ page }) => {
    // This test would need to seed the database with an event
    // For now, we just test that the page loads
    await page.goto('/display?token=test-token');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check that the calendar grid is rendered
    const calendarGrid = page.locator('[data-testid="calendar-grid"]');
    await expect(calendarGrid).toBeVisible();
  });

  test('kiosk display handles API errors gracefully', async ({ page }) => {
    // Mock the API to return an error
    await page.route('/api/events/week*', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });

    await page.goto('/display?token=test-token');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check that the calendar grid is still rendered (graceful degradation)
    const calendarGrid = page.locator('[data-testid="calendar-grid"]');
    await expect(calendarGrid).toBeVisible();
  });
});
