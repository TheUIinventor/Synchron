import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient()

export function QueryClientProviderWrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

// Hydration helper — keep as a safe no-op if no snapshot available.
export function hydrateFromProcessedSnapshot() {
  if (typeof window === 'undefined') return
  try {
    const key = 'synchron-processed-snapshot'
    const raw = localStorage.getItem(key)
    if (!raw) return
    // Snapshot format may vary; we intentionally do not enforce structure here.
    // Consumers can implement richer hydration if required.
    try { JSON.parse(raw) } catch (e) { /* ignore malformed */ }
  } catch (e) {
    // swallow errors — hydration is optional
  }
}

export default QueryClientProviderWrapper
