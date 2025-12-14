"use client"

import React, { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider, QueryCache } from '@tanstack/react-query'

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
  
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

// Re-export query client getter for external access (e.g. manual cache invalidation)
export { getQueryClient }

export default QueryClientProviderWrapper
