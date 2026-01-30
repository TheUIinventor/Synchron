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

/**
 * Day information from calendar/days.json API
 * Keyed by date string (YYYY-MM-DD)
 */
export interface DayInfo {
  date: string           // YYYY-MM-DD
  term: number | null    // Term number (1-4)
  week: number | null    // Week of term
  weekType: string | null // "A" or "B" week in cycle
  dayNumber: number | null // Day in timetable cycle (1-10 for A/B, 1-15 for A/B/C)
  dayName: string | null  // e.g. "MonA", "TueB", "WedA"
}

export type DaysResponse = Record<string, DayInfo>

/**
 * Term information from calendar/terms.json API
 */
export interface TermInfo {
  term: number
  start: string  // YYYY-MM-DD
  end: string    // YYYY-MM-DD
}

export type TermsResponse = TermInfo[]

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

/**
 * Fetch day info from calendar/days.json API
 * Returns info about term, week, weekType, dayNumber for each date in range
 */
async function fetchCalendarDays(from: string, to: string): Promise<DaysResponse> {
  const url = `/api/calendar?endpoint=days&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
  
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Accept": "application/json",
    },
  })
  
  if (!response.ok) {
    throw new Error(`Failed to fetch calendar days: ${response.status}`)
  }
  
  return response.json()
}

/**
 * Fetch term dates from calendar/terms.json API
 * Returns start/end dates for each term
 */
async function fetchCalendarTerms(): Promise<TermsResponse> {
  const url = `/api/calendar?endpoint=terms`
  
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Accept": "application/json",
    },
  })
  
  if (!response.ok) {
    throw new Error(`Failed to fetch calendar terms: ${response.status}`)
  }
  
  return response.json()
}

// Query key generators
const dayTimetableKey = sbhsKey("timetable/daytimetable")
const fullTimetableKey = sbhsKey("timetable/timetable")
const calendarDaysKey = sbhsKey("calendar/days")
const calendarTermsKey = sbhsKey("calendar/terms")

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
    // Caching configuration - reduced from 5 minutes to lower CPU usage
    staleTime: 15 * 60 * 1000, // Data is fresh for 15 minutes
    gcTime: Infinity, // Keep in cache forever
    refetchInterval: 15 * 60 * 1000, // Auto-refresh every 15 minutes (reduced from 5)
    refetchIntervalInBackground: false, // Disable background refresh
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
    staleTime: 60 * 60 * 1000, // Data is fresh for 60 minutes (increased from 30)
    gcTime: Infinity, // Keep in cache forever
    refetchInterval: 60 * 60 * 1000, // Auto-refresh every 60 minutes (increased from 30)
    refetchIntervalInBackground: false, // Disable background refresh
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

/**
 * Hook for fetching calendar day information
 * Returns term, week, weekType, dayNumber, dayName for each date in range.
 * This is the authoritative source for determining which week (A/B) a date is.
 * 
 * @param from - Start date YYYY-MM-DD
 * @param to - End date YYYY-MM-DD
 * 
 * Usage example:
 * ```tsx
 * const today = new Date().toISOString().split('T')[0]
 * const { data } = useDay(today, today)
 * // data[today] contains { term, week, weekType, dayNumber, dayName }
 * // dayName like "MonA" tells you it's Monday of Week A
 * ```
 */
export function useDay(from?: string, to?: string) {
  return useQuery({
    queryKey: calendarDaysKey(from && to ? { from, to } : undefined),
    queryFn: () => fetchCalendarDays(from!, to!),
    enabled: !!from && !!to, // Only fetch if both dates provided
    staleTime: 24 * 60 * 60 * 1000, // Calendar data is fresh for 24 hours (increased)
    gcTime: Infinity,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

// Attach query key getter to hook for external cache invalidation
useDay.getQueryKey = calendarDaysKey

/**
 * Hook for fetching term dates
 * Returns start/end dates for each school term.
 * Useful for determining term boundaries, holidays, etc.
 * 
 * Usage example:
 * ```tsx
 * const { data: terms } = useTerms()
 * // terms is array of { term, start, end }
 * ```
 */
export function useTerms() {
  return useQuery({
    queryKey: calendarTermsKey(),
    queryFn: fetchCalendarTerms,
    staleTime: 7 * 24 * 60 * 60 * 1000, // Term dates are fresh for 7 days
    gcTime: Infinity,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

// Attach query key getter to hook for external cache invalidation
useTerms.getQueryKey = calendarTermsKey

/**
 * Helper hook to get today's calendar info
 * Convenient wrapper around useDay for the common case of needing today's info
 */
export function useToday() {
  const today = new Date().toISOString().split('T')[0]
  const query = useDay(today, today)
  
  return {
    ...query,
    // Extract today's info from the response for convenience
    dayInfo: query.data?.[today] ?? null,
    // Quick accessors for common properties
    term: query.data?.[today]?.term ?? null,
    week: query.data?.[today]?.week ?? null,
    weekType: query.data?.[today]?.weekType as "A" | "B" | null ?? null,
    dayNumber: query.data?.[today]?.dayNumber ?? null,
    dayName: query.data?.[today]?.dayName ?? null,
  }
}

export default {
  useDtt,
  useTimetable,
  useCombinedTimetable,
  useDay,
  useTerms,
  useToday,
  sbhsKey,
}
