"use client"

import React, { useState } from 'react'
import { QueryClient, QueryClientProvider, QueryCache } from '@tanstack/react-query'

/**
 * Simplified QueryClient with better performance settings
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 30 * 60 * 1000, // Keep data for 30 minutes instead of forever
        staleTime: 5 * 60 * 1000, // Data is fresh for 5 minutes
        refetchInterval: false, // Disable automatic refetching to reduce background load
        refetchIntervalInBackground: false, // No background refetch
        networkMode: 'online', // Only run queries when online
        retry: 2, // Reduce retry attempts
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      },
    },
    queryCache: new QueryCache({
      onError: (error) => {
        if (error instanceof Error) {
          console.warn('[QueryClient] Query error:', error.message)
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
    // Browser: make a new client if we don't already have one
    if (!browserQueryClient) browserQueryClient = makeQueryClient()
    return browserQueryClient
  }
}

export function QueryClientProviderWrapper({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => getQueryClient())
  
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

// Re-export query client getter for external access
export { getQueryClient }

export default QueryClientProviderWrapper