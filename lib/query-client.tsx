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
            if (parsed) {
              // Try to infer an authoritative date for this processed payload.
              // Prefer explicit upstream day/date fields, then an explicit `date` field,
              // then any ISO-like keys on the timetable object, and finally fall back
              // to the persisted `savedAt` timestamp.
              let dateIso: string | null = null
              try {
                const candidateDates: Array<string | null> = []
                // upstream.day.date or upstream.dayInfo.date
                try { candidateDates.push(parsed.upstream?.day?.date || parsed.upstream?.dayInfo?.date || null) } catch (e) { candidateDates.push(null) }
                // top-level date
                try { candidateDates.push(parsed.date || parsed.day || null) } catch (e) { candidateDates.push(null) }
                // If timetable is keyed by ISO dates, prefer those keys
                try {
                  if (parsed.timetable && typeof parsed.timetable === 'object') {
                    const keys = Object.keys(parsed.timetable)
                    const isoKey = keys.find((kk: string) => /^\d{4}-\d{2}-\d{2}$/.test(kk))
                    if (isoKey) candidateDates.push(isoKey)
                  }
                } catch (e) { }

                // Finally, fallback to savedAt timestamp
                try { candidateDates.push(parsed.savedAt ? (new Date(parsed.savedAt)).toISOString().slice(0,10) : null) } catch (e) { candidateDates.push(null) }

                for (const c of candidateDates) {
                  if (!c) continue
                  // Normalize strings like '/Date(...)' and partials
                  try {
                    const s = String(c).trim()
                    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { dateIso = s; break }
                    // try parsing flexible formats
                    const dt = new Date(s)
                    if (!Number.isNaN(dt.getTime())) { dateIso = dt.toISOString().slice(0,10); break }
                  } catch (e) { continue }
                }
              } catch (e) {}

              if (!dateIso && parsed.savedAt) {
                try { dateIso = (new Date(parsed.savedAt)).toISOString().slice(0,10) } catch (e) { dateIso = null }
              }

              if (dateIso) {
                try { queryClient.setQueryData(['timetable', dateIso], parsed) } catch (e) {}

                // Also attempt to populate authoritative variations map in localStorage
                try {
                  const mapRaw = window.localStorage.getItem('synchron-authoritative-variations')
                  const mapObj = mapRaw ? JSON.parse(mapRaw) : {}
                  // Extract any variations present in the processed payload's timetable
                  try {
                    const tt = parsed.timetable || {}
                    const varData: Record<string, any[]> = {}
                    let foundAny = false
                    for (const rawDayKey of Object.keys(tt || {})) {
                      try {
                        const arr = (tt as any)[rawDayKey] || []
                        // Normalize keys: if the timetable uses ISO-date keys (YYYY-MM-DD),
                        // convert them to the weekday name (e.g., 'Monday') which the
                        // provider expects when applying authoritative variations.
                        let dayKey = String(rawDayKey)
                        try {
                          if (/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
                            const dt = new Date(dayKey)
                            if (!Number.isNaN(dt.getTime())) dayKey = dt.toLocaleDateString('en-US', { weekday: 'long' })
                          }
                        } catch (e) {}
                        const vars = (arr || []).filter((p: any) => p && (p.isSubstitute || p.isRoomChange)).map((p: any) => ({ period: p.period, isSubstitute: !!p.isSubstitute, isRoomChange: !!p.isRoomChange, displayRoom: p.displayRoom, displayTeacher: p.displayTeacher, casualSurname: p.casualSurname, originalTeacher: p.originalTeacher, originalRoom: p.originalRoom }))
                        if (vars && vars.length) { varData[dayKey] = vars; foundAny = true }
                      } catch (e) { /* ignore per-day errors */ }
                    }
                    if (foundAny) {
                      // Only set when we have actual variations
                      mapObj[dateIso] = mapObj[dateIso] || {}
                      // merge days without overwriting existing per-period entries
                      for (const d of Object.keys(varData)) {
                        mapObj[dateIso][d] = mapObj[dateIso][d] || []
                        // Append any new entries that aren't duplicates by period+room+teacher
                        const existing = mapObj[dateIso][d] || []
                        const combined = existing.slice()
                        for (const v of varData[d]) {
                          const dup = combined.find((e: any) => String(e.period) === String(v.period) && String(e.displayRoom || '') === String(v.displayRoom || '') && String(e.displayTeacher || '') === String(v.displayTeacher || ''))
                          if (!dup) combined.push(v)
                        }
                        mapObj[dateIso][d] = combined
                      }
                      try { window.localStorage.setItem('synchron-authoritative-variations', JSON.stringify(mapObj)) } catch (e) {}
                    }
                  } catch (e) {}
                } catch (e) {}
              }
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
