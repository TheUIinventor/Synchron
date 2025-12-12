"use client"

import React, { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// Minimal QueryClient provider wrapper used by the app layout.
export function QueryClientProviderWrapper({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient({}))
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

// Hydrate processed snapshot from localStorage if present. This is a best-effort
// helper — when no snapshot is available it is a no-op.
export function hydrateFromProcessedSnapshot(): void {
  try {
    if (typeof window === 'undefined') return
    // Historically this project stored a processed snapshot under
    // `synchron:processed-snapshot`. Keep this as a no-op hook for now.
    // If needed in future, implement hydrate/dehydrate using React Query methods.
    return
  } catch (e) {
    return
  }
}

export default QueryClientProviderWrapper
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
