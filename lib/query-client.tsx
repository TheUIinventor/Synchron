"use client"

import React, { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider, QueryCache } from '@tanstack/react-query'
import { persistQueryClient } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

/**
 * QueryClient configured following Timetabl app patterns:
 * - gcTime: Infinity - data stays in cache forever (cleared only on logout)
 * - refetchInterval: 5 minutes - auto-refresh in background
 * - networkMode: 'always' - queries run even when offline (from cache)
 * 
 * This gives us:
 * 1. Fast initial loads from cached data
 * 2. Automatic background refreshes
 * 3. Offline support with cached data
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: Infinity, // Keep data in cache forever
        staleTime: 5 * 60 * 1000, // Data is fresh for 5 minutes
        refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
        refetchIntervalInBackground: true,
        networkMode: 'always', // Run queries even when offline
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      },
    },
    queryCache: new QueryCache({
      onError: (error) => {
        // Log errors for debugging, but don't show toast for network errors
        if (error instanceof Error) {
          console.error('[QueryClient] Query error:', error.message)
        }
      },
    }),
  })
}

// Keep a singleton on the client
let browserQueryClient: QueryClient | undefined = undefined

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient()
  } else {
    // Browser: use singleton
    if (!browserQueryClient) {
      browserQueryClient = makeQueryClient()
    }
    return browserQueryClient
  }
}

export function QueryClientProviderWrapper({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => getQueryClient())
  
  // Initialize persistence on mount (browser only)
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const persister = createSyncStoragePersister({
        storage: window.localStorage,
        key: 'synchron-react-query',
      })
      // Persist the query client with an effectively infinite maxAge (gcTime handled by QueryClient)
      persistQueryClient({
        queryClient,
        persister,
        maxAge: Infinity,
        // throttle to avoid excessive writes
        throttleTime: 1000,
      })
    } catch (e) {
      // ignore persistence failures
      try { console.debug('[QueryClient] persistence init failed', e) } catch (err) {}
    }
    // Migrate any existing `synchron-processed-<hash>` entries into the
    // react-query cache so previously-processed timetables (with
    // substitutions applied) become available when viewing past dates.
    try {
      const keys = Object.keys(window.localStorage || {})
      for (const k of keys) {
        try {
          if (k && k.startsWith('synchron-processed-')) {
            const raw = window.localStorage.getItem(k)
            if (!raw) continue
            const parsed = JSON.parse(raw)
            if (parsed && parsed.savedAt) {
              const dateIso = (new Date(parsed.savedAt)).toISOString().slice(0,10)
              // Store under ['timetable', dateIso] so provider can read it
              try { queryClient.setQueryData(['timetable', dateIso], parsed) } catch (e) {}
            }
          }
        } catch (e) { /* ignore per-key errors */ }
      }
    } catch (e) {}
  }, [queryClient])

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

// Re-export query client getter for external access (e.g. manual cache invalidation)
export { getQueryClient }

export default QueryClientProviderWrapper
