"use client"

import React from 'react'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30s
      cacheTime: 1000 * 60 * 60 * 24, // 24h
      retry: 0,
    },
  },
})

const persister = typeof window !== 'undefined' ? createSyncStoragePersister({ storage: window.localStorage }) : null

export function QueryClientProviderWrapper({ children }: { children: React.ReactNode }) {
  // If persister is not available (SSR), fall back to normal QueryClientProvider
  if (!persister) return <>{children}</>

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
      {children}
    </PersistQueryClientProvider>
  )
}

// Utility to hydrate query cache from a processed snapshot (synchron-last-processed)
export function hydrateFromProcessedSnapshot() {
  try {
    if (typeof window === 'undefined') return
    const raw = localStorage.getItem('synchron-last-processed')
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (!parsed) return
    if (parsed.timetable) {
      queryClient.setQueryData(['timetable', 'snapshot'], parsed.timetable)
    }
    if (parsed.bellTimes) {
      queryClient.setQueryData(['bellTimes', 'snapshot'], parsed.bellTimes)
    }
  } catch (e) {
    // ignore
  }
}
