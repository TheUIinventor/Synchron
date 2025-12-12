"use client"

import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Single QueryClient instance for the app. Keep this minimal and deterministic
// so server builds remain fast and predictable.
const queryClient = new QueryClient()

export function QueryClientProviderWrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

// Hydration helper — keep as a safe no-op if no snapshot available.
export function hydrateFromProcessedSnapshot(): void {
  if (typeof window === 'undefined') return
  try {
    const key = 'synchron-processed-snapshot'
    const raw = localStorage.getItem(key)
    if (!raw) return
    // We intentionally do not enforce structure; this is a light hook for
    // historical compatibility. Consumers can implement richer hydration.
    try { JSON.parse(raw) } catch (e) { /* ignore malformed */ }
  } catch (e) {
    // swallow errors — hydration is optional
  }
}

export default QueryClientProviderWrapper
