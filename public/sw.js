// Service Worker for SkyLite-UX Kiosk Mode
// Provides offline support and auto-refresh capabilities
// SECURITY: Only caches kiosk-specific assets and read-only endpoints

const CACHE_NAME = 'skylite-kiosk-v1';
const CACHE_URLS = [
  '/display',
  '/skylite.svg',
  '/manifest.json'
];

// Allowed API endpoints for caching (read-only)
const ALLOWED_API_PATHS = [
  '/api/events/week'
];

// Blocked patterns (never cache)
const BLOCKED_PATTERNS = [
  /\/api\/.*\/(create|update|delete|post|put|patch)/,
  /\/api\/auth/,
  /\/api\/users/,
  /\/api\/integrations/,
  /\/api\/sync/
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching resources');
        return cache.addAll(CACHE_URLS);
      })
      .then(() => {
        console.log('Service Worker: Installation complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Installation failed', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('Service Worker: Activation complete');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Security: Check if URL is allowed for caching
  const url = new URL(event.request.url);
  const pathname = url.pathname;
  
  // Block sensitive endpoints
  if (BLOCKED_PATTERNS.some(pattern => pattern.test(pathname))) {
    console.log('Service Worker: Blocked caching for sensitive endpoint', pathname);
    return;
  }

  // Only cache allowed API paths
  if (pathname.startsWith('/api/') && !ALLOWED_API_PATHS.includes(pathname)) {
    console.log('Service Worker: Blocked caching for unauthorized API endpoint', pathname);
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Return cached version if available
        if (cachedResponse) {
          console.log('Service Worker: Serving from cache', event.request.url);
          return cachedResponse;
        }

        // Fetch from network and cache for future use
        return fetch(event.request)
          .then((response) => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response for caching
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch((error) => {
            console.error('Service Worker: Fetch failed', error);
            
            // For kiosk mode, return a basic offline page
            if (event.request.url.includes('/display')) {
              return new Response(`
                <!DOCTYPE html>
                <html>
                <head>
                  <title>SkyLite-UX - Offline</title>
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <style>
                    body { 
                      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      height: 100vh;
                      margin: 0;
                      background: #F9FAFB;
                      color: #374151;
                    }
                    .offline-container {
                      text-align: center;
                      padding: 2rem;
                      background: white;
                      border-radius: 0.5rem;
                      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                    }
                    .offline-icon {
                      font-size: 4rem;
                      margin-bottom: 1rem;
                    }
                    .offline-title {
                      font-size: 1.5rem;
                      font-weight: 600;
                      margin-bottom: 0.5rem;
                    }
                    .offline-message {
                      color: #6B7280;
                      margin-bottom: 1rem;
                    }
                    .retry-button {
                      background: #3B82F6;
                      color: white;
                      border: none;
                      padding: 0.5rem 1rem;
                      border-radius: 0.375rem;
                      cursor: pointer;
                      font-size: 0.875rem;
                    }
                    .retry-button:hover {
                      background: #2563EB;
                    }
                  </style>
                </head>
                <body>
                  <div class="offline-container">
                    <div class="offline-icon">📡</div>
                    <div class="offline-title">Offline Mode</div>
                    <div class="offline-message">
                      SkyLite-UX is currently offline.<br>
                      Calendar data will refresh when connection is restored.
                    </div>
                    <button class="retry-button" onclick="window.location.reload()">
                      Retry Connection
                    </button>
                  </div>
                </body>
                </html>
              `, {
                headers: {
                  'Content-Type': 'text/html',
                },
              });
            }
            
            throw error;
          });
      })
  );
});

// Message event - handle refresh requests
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'REFRESH_CACHE') {
    console.log('Service Worker: Refreshing cache...');
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then((cache) => {
          return cache.addAll(CACHE_URLS);
        })
        .then(() => {
          console.log('Service Worker: Cache refreshed');
          event.ports[0].postMessage({ success: true });
        })
        .catch((error) => {
          console.error('Service Worker: Cache refresh failed', error);
          event.ports[0].postMessage({ success: false, error: error.message });
        })
    );
  }
});

// Background sync for kiosk mode
self.addEventListener('sync', (event) => {
  if (event.tag === 'kiosk-refresh') {
    console.log('Service Worker: Background sync - refreshing kiosk data');
    event.waitUntil(
      fetch('/api/events/week')
        .then((response) => {
          if (response.ok) {
            console.log('Service Worker: Background sync successful');
            // Notify clients of successful sync
            return self.clients.matchAll().then((clients) => {
              clients.forEach((client) => {
                client.postMessage({
                  type: 'KIOSK_DATA_UPDATED',
                  timestamp: new Date().toISOString()
                });
              });
            });
          }
        })
        .catch((error) => {
          console.error('Service Worker: Background sync failed', error);
        })
    );
  }
});
