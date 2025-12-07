// Lightweight service worker for offline caching and navigation fallback
const CACHE_NAME = 'synchron-static-v1'
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

// Simple runtime caching strategy: network-first for navigation, cache-first for other requests
self.addEventListener('fetch', (event) => {
  const request = event.request
  // Only handle GET
  if (request.method !== 'GET') return

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
