/**
 * ECHONIX Sales & Field CRM - Service Worker
 * Provides offline caching, app shell pre-caching, and background sync support.
 */

const CACHE_NAME = 'echonix-sales-pwa-v1';

// Critical app shell assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-192x192.png',
  '/icons/icon-maskable-512x512.png',
  '/icons/apple-touch-icon.png',
  'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap'
];

// Domains/APIs to bypass (handled by Firebase's own IndexedDB offline engine)
const BYPASS_ORIGINS = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'www.googleapis.com',
  'firebaseinstallations.googleapis.com',
  'content-firebaseappcheck.googleapis.com'
];

// Install: pre-cache assets and activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Precache local files and best-effort on external CDNs
      for (const asset of PRECACHE_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn('[SW] Precache failed for asset (will fetch on demand):', asset, err);
        }
      }
    }).then(() => self.skipWaiting())
  );
});

// Activate: delete old cache versions and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Deleting deprecated cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Strategy depending on request type
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Bypass Firebase Backend / Auth APIs to let Firebase SDK manage its own IndexedDB
  if (BYPASS_ORIGINS.some((domain) => url.hostname.includes(domain))) {
    return;
  }

  // Bypass chrome-extension requests
  if (url.protocol.startsWith('chrome-extension')) {
    return;
  }

  // 1. Navigation Requests (HTML pages / routes like /leads, /report, /expenses)
  // Strategy: Network-first, fallback to cached /index.html (Essential for React SPA offline reload)
  if (request.mode === 'navigate' || (request.headers.get('accept') && request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // If valid response, update cache copy of the root shell
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          }
          return response;
        })
        .catch(async () => {
          // Network failed (Offline): Serve cached SPA index.html
          const cache = await caches.open(CACHE_NAME);
          const cachedIndex = await cache.match('/index.html') || await cache.match('/');
          if (cachedIndex) {
            return cachedIndex;
          }
          return new Response(
            `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ECHONIX Offline</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:sans-serif;padding:30px;text-align:center;background:#0f172a;color:#f8fafc"><h1>ECHONIX Sales</h1><p>You are currently offline. Please reconnect to load fresh content.</p></body></html>`,
            { headers: { 'Content-Type': 'text/html' } }
          );
        })
    );
    return;
  }

  // 2. Static Assets (JS chunks, CSS, Images, Fonts, SVG)
  // Strategy: Stale-While-Revalidate (serve from cache fast, update in background)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Network error: If we had a cachedResponse, it will be returned below.
        });

      return cachedResponse || fetchPromise;
    })
  );
});

// Listen for update messages from UI
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
