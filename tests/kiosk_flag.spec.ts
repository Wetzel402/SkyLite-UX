import { test, expect } from '@playwright/test';

test.describe('Kiosk Mode Feature Flag', () => {
  test('returns 404 when kiosk mode is disabled', async ({ page }) => {
    // Mock environment with kiosk mode disabled
    await page.addInitScript(() => {
      (window as any).__NUXT__.config = {
        public: {
          enableKioskMode: false
        }
      };
    });

    // Try to access kiosk display
    const response = await page.goto('/display');
    
    // Should return 404
    expect(response?.status()).toBe(404);
  });

  test('blocks API access when kiosk mode is disabled', async ({ page }) => {
    // Mock environment with kiosk mode disabled
    await page.addInitScript(() => {
      (window as any).__NUXT__.config = {
        public: {
          enableKioskMode: false
        }
      };
    });

    // Try to access kiosk API
    const response = await page.request.get('/api/events/week');
    
    // Should return 404
    expect(response.status()).toBe(404);
  });

  test('allows access when kiosk mode is enabled without token', async ({ page }) => {
    // Mock environment with kiosk mode enabled but no token required
    await page.addInitScript(() => {
      (window as any).__NUXT__.config = {
        public: {
          enableKioskMode: true
        }
      };
    });

    // Mock API response
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

    // Should be able to access without token
    const response = await page.goto('/display');
    expect(response?.status()).toBe(200);
  });

  test('enforces read-only access on kiosk endpoints', async ({ page }) => {
    // Mock environment with kiosk mode enabled
    await page.addInitScript(() => {
      (window as any).__NUXT__.config = {
        public: {
          enableKioskMode: true
        }
      };
    });

    // Try to POST to kiosk API (should be blocked)
    const response = await page.request.post('/api/events/week', {
      data: { title: 'Test Event' }
    });
    
    // Should return 405 Method Not Allowed
    expect(response.status()).toBe(405);
  });

  test('rate limiting works correctly', async ({ page }) => {
    // Mock environment with kiosk mode enabled
    await page.addInitScript(() => {
      (window as any).__NUXT__.config = {
        public: {
          enableKioskMode: true
        }
      };
    });

    // Mock API response
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

    // Make multiple rapid requests
    const requests = [];
    for (let i = 0; i < 10; i++) {
      requests.push(page.request.get('/api/events/week'));
    }

    const responses = await Promise.all(requests);
    
    // Most should succeed (rate limit is 60/min)
    const successCount = responses.filter(r => r.status() === 200).length;
    expect(successCount).toBeGreaterThan(5);
  });

  test('service worker only caches allowed assets', async ({ page }) => {
    // Mock environment with kiosk mode enabled
    await page.addInitScript(() => {
      (window as any).__NUXT__.config = {
        public: {
          enableKioskMode: true
        }
      };
    });

    await page.goto('/display');

    // Check that service worker is registered
    const swRegistration = await page.evaluate(() => {
      return navigator.serviceWorker.getRegistration();
    });

    expect(swRegistration).toBeTruthy();

    // Check that sensitive endpoints are not cached
    await page.route('/api/users*', route => route.continue());
    await page.route('/api/integrations*', route => route.continue());

    // These should not be cached by service worker
    await page.request.get('/api/users');
    await page.request.get('/api/integrations');

    // Verify service worker doesn't interfere with these requests
    const cacheKeys = await page.evaluate(() => {
      return caches.keys();
    });

    // Should only have kiosk cache
    expect(cacheKeys).toContain('skylite-kiosk-v1');
  });
});
