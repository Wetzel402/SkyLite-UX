// PWA Service Worker Registration for Kiosk Mode
// Handles offline support and background sync

export default defineNuxtPlugin(() => {
  // Only register service worker in browser and for kiosk mode
  if (process.client && typeof window !== 'undefined') {
    if ('serviceWorker' in navigator) {
      // Register service worker
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('PWA: Service Worker registered successfully', registration.scope);
          
          // Handle updates
          registration.addEventListener('updatefound', () => {
            console.log('PWA: Service Worker update found');
            const newWorker = registration.installing;
            
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('PWA: New service worker available');
                  // Auto-update for kiosk mode
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                  window.location.reload();
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error('PWA: Service Worker registration failed', error);
        });

      // Handle service worker messages
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'KIOSK_DATA_UPDATED') {
          console.log('PWA: Kiosk data updated via background sync');
          // Trigger a soft refresh of the page
          if (window.location.pathname === '/display') {
            window.location.reload();
          }
        }
      });

      // Register for background sync (if supported)
      if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        navigator.serviceWorker.ready.then((registration) => {
          // Register for periodic background sync
          registration.sync.register('kiosk-refresh')
            .then(() => {
              console.log('PWA: Background sync registered for kiosk mode');
            })
            .catch((error) => {
              console.error('PWA: Background sync registration failed', error);
            });
        });
      }

      // Handle online/offline events for kiosk mode
      const handleOnline = () => {
        console.log('PWA: Connection restored - refreshing kiosk data');
        if (window.location.pathname === '/display') {
          // Trigger background sync
          navigator.serviceWorker.ready.then((registration) => {
            if ('sync' in registration) {
              registration.sync.register('kiosk-refresh');
            }
          });
        }
      };

      const handleOffline = () => {
        console.log('PWA: Connection lost - kiosk mode will use cached data');
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      // Cleanup on unmount
      onUnmounted(() => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      });
    } else {
      console.warn('PWA: Service Worker not supported in this browser');
    }
  }
});
