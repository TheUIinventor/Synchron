"use client"

/**
 * React Query hooks for SBHS API endpoints
 * Following the pattern from Timetabl app - simple hooks using useQuery
 * that fetch from API routes and parse with Zod schemas.
 * 
 * Caching is handled automatically by react-query:
 * - gcTime: Infinity - keeps data in cache forever (until manual clear)
 * - staleTime: 5 minutes - data stays fresh for 5 minutes
 * - refetchInterval: 5 minutes - auto-refresh in background
 */

import { useQuery } from "@tanstack/react-query"
import type { Period } from "@/contexts/timetable-context"

// Query key generator - ensures consistent keys for caching
export const sbhsKey = (endpoint: string) => (params?: Record<string, string>) => {
  const base = ["sbhs", endpoint] as const
  if (!params || Object.keys(params).length === 0) {
    return base
  }
  return [...base, params] as const
}

// Types for API responses
export interface DayTimetableResponse {
  timetable: Record<string, Period[]>
  timetableByWeek: Record<string, { A: Period[]; B: Period[] }> | null
  bellTimes?: any
  source: string
  weekType: "A" | "B" | null
  date?: string
  upstream?: any
}

export interface FullTimetableResponse {
  timetable: Record<string, Period[]>
  timetableByWeek: Record<string, { A: Period[]; B: Period[] }> | null
  bellTimes?: any
  source: string
  weekType: "A" | "B" | null
}

// Fetch functions - these call our Next.js API routes which proxy SBHS
async function fetchDayTimetable(date?: string): Promise<DayTimetableResponse> {
  const url = date 
    ? `/api/timetable?date=${encodeURIComponent(date)}`
    : `/api/timetable`
  
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Accept": "application/json",
    },
  })
  
  if (!response.ok) {
    throw new Error(`Failed to fetch day timetable: ${response.status}`)
  }
  
  return response.json()
}

async function fetchFullTimetable(): Promise<FullTimetableResponse> {
  const response = await fetch("/api/timetable", {
    credentials: "include",
    headers: {
      "Accept": "application/json",
    },
  })
  
  if (!response.ok) {
    throw new Error(`Failed to fetch full timetable: ${response.status}`)
  }
  
  return response.json()
}

// Query key generators
const dayTimetableKey = sbhsKey("timetable/daytimetable")
const fullTimetableKey = sbhsKey("timetable/timetable")

/**
 * Hook for fetching day-specific timetable with subs applied
 * This is the PRIMARY hook for getting today's or a specific day's timetable
 * with all classVariations (substitute teachers) and roomVariations applied.
 * 
 * @param date - Optional YYYY-MM-DD date string. If not provided, fetches today.
 */
export function useDtt(date?: string) {
  return useQuery({
    queryKey: dayTimetableKey(date ? { date } : undefined),
    queryFn: () => fetchDayTimetable(date),
    // Caching configuration
    staleTime: 5 * 60 * 1000, // Data is fresh for 5 minutes
    gcTime: Infinity, // Keep in cache forever
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
    refetchIntervalInBackground: true,
    // On error, retry 3 times with exponential backoff
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

// Attach query key getter to hook for external cache invalidation
useDtt.getQueryKey = dayTimetableKey

/**
 * Hook for fetching the full 10-day cycle timetable (no subs)
 * This returns the clean cycle timetable organized by day and week.
 * Use this for viewing the full schedule, not for current-day display.
 */
export function useTimetable() {
  return useQuery({
    queryKey: fullTimetableKey(),
    queryFn: fetchFullTimetable,
    // Caching configuration - cycle timetable changes less often
    staleTime: 30 * 60 * 1000, // Data is fresh for 30 minutes
    gcTime: Infinity, // Keep in cache forever
    refetchInterval: 30 * 60 * 1000, // Auto-refresh every 30 minutes
    refetchIntervalInBackground: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

// Attach query key getter to hook for external cache invalidation
useTimetable.getQueryKey = fullTimetableKey

/**
 * Combined hook that uses day timetable when available, falls back to full timetable
 * This is the recommended hook for components that need the "best available" data.
 * 
 * Priority:
 * 1. Day timetable (has subs applied) for the selected date
 * 2. Full timetable as fallback
 */
export function useCombinedTimetable(date?: string) {
  const dttQuery = useDtt(date)
  const fullQuery = useTimetable()
  
  // Use day timetable if available, otherwise fall back to full
  const data = dttQuery.data || fullQuery.data
  const isLoading = dttQuery.isLoading && fullQuery.isLoading
  const isFetching = dttQuery.isFetching || fullQuery.isFetching
  const error = dttQuery.error || fullQuery.error
  
  return {
    data,
    isLoading,
    isFetching,
    error,
    // Expose underlying queries for advanced usage
    dttQuery,
    fullQuery,
    // Which data source is being used
    source: dttQuery.data ? "day" : fullQuery.data ? "full" : null,
  }
}

export default {
  useDtt,
  useTimetable,
  useCombinedTimetable,
  sbhsKey,
}
