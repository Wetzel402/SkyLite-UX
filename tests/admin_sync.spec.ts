import { test, expect } from '@playwright/test';

test.describe('Admin Sync Endpoints', () => {
  const baseURL = process.env.BASE_URL || 'http://localhost:3000';
  const adminToken = process.env.ADMIN_API_TOKEN || 'test-admin';
  const displayToken = process.env.DISPLAY_TOKEN || 'test-token';

  test('should list calendar sources with admin token', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/admin/sources`, {
      headers: {
        'X-Admin-Token': adminToken
      }
    });

    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('sources');
    expect(data).toHaveProperty('count');
    expect(data).toHaveProperty('timestamp');
    expect(Array.isArray(data.sources)).toBe(true);
    
    // Should have at least one ICS source from test setup
    expect(data.count).toBeGreaterThan(0);
    expect(data.sources.length).toBeGreaterThan(0);
    
    // Check that usernames are masked
    data.sources.forEach((source: any) => {
      if (source.username) {
        expect(source.username).toMatch(/\*+/);
      }
    });
  });

  test('should reject requests without admin token', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/admin/sources`);
    expect(response.status()).toBe(401);
  });

  test('should reject requests with invalid admin token', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/admin/sources`, {
      headers: {
        'X-Admin-Token': 'invalid-token'
      }
    });
    expect(response.status()).toBe(401);
  });

  test('should trigger manual sync with admin token', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/admin/sync`, {
      headers: {
        'X-Admin-Token': adminToken
      }
    });

    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('summary');
    expect(data).toHaveProperty('timestamp');
    expect(data.summary).toHaveProperty('sources');
    expect(data.summary).toHaveProperty('fetched');
    expect(data.summary).toHaveProperty('upserts');
    expect(data.summary).toHaveProperty('errors');
  });

  test('should display calendar with events in kiosk mode', async ({ page }) => {
    await page.goto(`${baseURL}/display?token=${displayToken}`);
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check that the kiosk mode is active
    await expect(page.locator('.kiosk-mode')).toBeVisible();
    
    // Check that the calendar is displayed
    await expect(page.locator('.kiosk-calendar-board')).toBeVisible();
    
    // Check for calendar grid
    await expect(page.locator('.calendar-grid')).toBeVisible();
    
    // Check for day columns
    const dayColumns = page.locator('.day-column');
    await expect(dayColumns).toHaveCount(7); // 7 days of the week
    
    // Check for week header
    await expect(page.locator('.week-header')).toBeVisible();
  });

  test('should show sync status without errors', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/sync/status`);
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('connectedClients');
    expect(data).toHaveProperty('timestamp');
    
    // Should not have errors even with no sources
    expect(data.status).toBeDefined();
  });
});
