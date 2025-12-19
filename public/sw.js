// Lightweight service worker for offline caching and navigation fallback
// Bump this value on breaking deploys so older service workers and caches
// are invalidated. Update to a new value for the next build when making
// runtime-critical fixes.
const CACHE_NAME = 'synchron-static-v2'
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => { if (k !== CACHE_NAME) return caches.delete(k); return null }))).then(() => self.clients.claim())
  )
})

// Notify clients once this new Service Worker is active so they can reload
// and pick up the new assets immediately.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const all = await self.clients.matchAll({ includeUncontrolled: true })
        for (const c of all) {
          try { c.postMessage({ type: 'sw-activated', cache: CACHE_NAME }) } catch (e) {}
        }
      } catch (e) {}
    })()
  )
})

// Simple runtime caching strategy: network-first for navigation, cache-first for other requests
self.addEventListener('fetch', (event) => {
  const request = event.request
  // Only handle GET
  if (request.method !== 'GET') return

  // Avoid caching API responses for timetable/calendar/portal endpoints
  // to ensure clients always see the authoritative live data.
  try {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/timetable') || url.pathname.startsWith('/api/calendar') || url.pathname.startsWith('/api/portal')) {
      event.respondWith(
        fetch(request).then((res) => {
          return res
        }).catch(() => caches.match(request))
      )
      return
    }
  } catch (e) {}

  // Navigation requests: try network, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((res) => {
        // put a copy in cache
        const copy = res.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        return res
      }).catch(() => caches.match(request).then((r) => r || caches.match('/')))
    )
    return
  }

  // For other requests: prefer cache, then network
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((res) => {
      try { caches.open(CACHE_NAME).then((cache) => cache.put(request, res.clone())) } catch (e) {}
      return res
    })).catch(() => cached)
  )
})

// Basic message handler to allow clients to clear caches
self.addEventListener('message', (event) => {
  if (!event.data) return
  if (event.data === 'clear-cache') {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
  }
})
