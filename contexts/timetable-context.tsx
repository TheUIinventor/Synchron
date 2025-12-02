"use client"

import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from "react"
import { applySubstitutionsToTimetable } from "@/lib/api/data-adapters"
import { PortalScraper } from "@/lib/api/portal-scraper"
import { getTimeUntilNextPeriod, isSchoolDayOver, getNextSchoolDay, getCurrentDay } from "@/utils/time-utils"

// Define the period type
export type Period = {
  id?: number
  period: string
  time: string
  subject: string
  teacher: string
  room: string
  weekType?: "A" | "B"
  isSubstitute?: boolean // New: Indicates a substitute teacher
  isRoomChange?: boolean // New: Indicates a room change
}

// Define the bell time type
export type BellTime = {
  period: string
  time: string
}

// Define the timetable context type
type TimetableContextType = {
  currentWeek: "A" | "B" | null
  selectedDay: string // Day for the main timetable display (e.g., "Monday")
  selectedDateObject: Date // The actual Date object for the selectedDay
  setSelectedDay: (day: string) => void
  setSelectedDateObject: (d: Date) => void
  timetableData: Record<string, Period[]>
  currentMomentPeriodInfo: {
    // Renamed from nextPeriodInfo to be clearer
    nextPeriod: Period | null
    timeUntil: string
    isCurrentlyInClass: boolean
    currentPeriod: Period | null
  }
  // Backwards-compatible alias name used across older components
  nextPeriodInfo?: {
    nextPeriod: Period | null
    timeUntil: string
    isCurrentlyInClass: boolean
    currentPeriod: Period | null
  }
  isShowingCachedWhileLoading?: boolean
  bellTimes: Record<string, BellTime[]>
  isShowingNextDay: boolean // Indicates if the main timetable is showing next day
  timetableSource?: string | null // indicates where timetable data came from (e.g. 'fallback-sample' or external url)
  isLoading: boolean
  error: string | null
  // Trigger an in-place retry (handshake + fetch) to attempt to load live timetable again
  refreshExternal?: () => Promise<void>
  // Full A/B grouped timetable when available from the server
  timetableByWeek?: Record<string, { A: Period[]; B: Period[]; unknown: Period[] }>
  externalWeekType?: "A" | "B" | null // authoritative week type reported by the server
}

// Create the context
const TimetableContext = createContext<TimetableContextType | undefined>(undefined)

// Updated bell times for different day groups
const bellTimesData = {
  "Mon/Tues": [
    { period: "Period 1", time: "9:00 - 10:05" },
    { period: "Period 2", time: "10:05 - 11:05" },
    { period: "Recess", time: "11:05 - 11:25" },
    { period: "Period 3", time: "11:25 - 12:30" },
    { period: "Period 4", time: "12:30 - 1:30" },
    { period: "Lunch 1", time: "1:30 - 1:50" },
    { period: "Lunch 2", time: "1:50 - 2:10" },
    { period: "Period 5", time: "2:10 - 3:10" },
    { period: "End of Day", time: "3:10" },
  ],
  "Wed/Thurs": [
    { period: "Period 1", time: "9:00 - 10:05" },
    { period: "Period 2", time: "10:05 - 11:05" },
    { period: "Recess", time: "11:05 - 11:25" },
    { period: "Period 3", time: "11:25 - 12:25" },
    { period: "Lunch 1", time: "12:25 - 12:45" },
    { period: "Lunch 2", time: "12:45 - 1:05" },
    { period: "Period 4", time: "1:05 - 2:10" },
    { period: "Period 5", time: "2:10 - 3:10" },
    { period: "End of Day", time: "3:10" },
  ],
  Fri: [
    { period: "Period 1", time: "9:25 - 10:20" },
    { period: "Period 2", time: "10:20 - 11:10" },
    { period: "Recess", time: "11:10 - 11:40" },
    { period: "Period 3", time: "11:40 - 12:35" },
    { period: "Lunch 1", time: "12:35 - 12:55" },
    { period: "Lunch 2", time: "12:55 - 1:15" },
    { period: "Period 4", time: "1:15 - 2:15" },
    { period: "Period 5", time: "2:15 - 3:10" },
    { period: "End of Day", time: "3:10" },
  ],
}

// Shared helpers for bell ordering/time parsing used across the provider
const canonicalIndex = (label?: string) => {
  if (!label) return 999
  const s = String(label).toLowerCase()
  if (/period\s*1|^p\s*1|\b1\b/.test(s)) return 0
  if (/period\s*2|^p\s*2|\b2\b/.test(s)) return 1
  if (/recess|break|interval|morning break/.test(s)) return 2
  if (/period\s*3|^p\s*3|\b3\b/.test(s)) return 3
  if (/lunch\s*1|lunch1/.test(s)) return 4
  if (/lunch\s*2|lunch2/.test(s)) return 5
  if (/period\s*4|^p\s*4|\b4\b/.test(s)) return 6
  if (/period\s*5|^p\s*5|\b5\b/.test(s)) return 7
  return 998
}

const parseStartMinutesForDay = (dayPeriods: Period[], timeStr: string) => {
  try {
    const part = (timeStr || '').split('-')[0].trim()
    const [hRaw, mRaw] = part.split(':').map((s) => parseInt(s, 10))
    if (!Number.isFinite(hRaw)) return 0
    const m = Number.isFinite(mRaw) ? mRaw : 0
    let h = hRaw
    const hasMorning = dayPeriods.some((p) => {
      try {
        const ppart = (p.time || '').split('-')[0].trim()
        const hh = parseInt(ppart.split(':')[0], 10)
        return Number.isFinite(hh) && hh >= 8
      } catch (e) { return false }
    })
    if (h < 8 && hasMorning) h += 12
    return h * 60 + m
  } catch (e) { return 0 }
}

// Build a normalized external bellTimes mapping from the server payload.
// If the server provided explicit `bellTimes`, prefer those. When a
// bucket is missing or empty, fall back to using `upstream` bell data if
// available in the payload (same-origin data from the server).
const buildBellTimesFromPayload = (payload: any) => {
  const result: Record<string, { period: string; time: string }[]> = {
    'Mon/Tues': [],
    'Wed/Thurs': [],
    'Fri': [],
  }

  try {
    const src = payload?.bellTimes || {}
    if (src['Mon/Tues'] && Array.isArray(src['Mon/Tues']) && src['Mon/Tues'].length) result['Mon/Tues'] = src['Mon/Tues']
    if (src['Wed/Thurs'] && Array.isArray(src['Wed/Thurs']) && src['Wed/Thurs'].length) result['Wed/Thurs'] = src['Wed/Thurs']
    if (src['Fri'] && Array.isArray(src['Fri']) && src['Fri'].length) result['Fri'] = src['Fri']

    if ((result['Mon/Tues'] && result['Mon/Tues'].length) && (result['Wed/Thurs'] && result['Wed/Thurs'].length) && (result['Fri'] && result['Fri'].length)) {
      return result
    }

    // Try upstream/day bells and map them into the correct bucket. Some
    // servers include the upstream payload inside `diagnostics.upstream`, so
    // check that location too. IMPORTANT: only populate the bucket that the
    // upstream bells actually apply to (e.g. a Wednesday-only bells array
    // should populate `Wed/Thurs`), instead of duplicating the same array
    // across all buckets.
    const candidateUpstream = payload?.upstream || payload?.diagnostics?.upstream || {}
    try {
      if (candidateUpstream?.day && Array.isArray(candidateUpstream.day.bells) && candidateUpstream.day.bells.length) {
        const rawDay = String(candidateUpstream.day.dayName || candidateUpstream.day.day || candidateUpstream.day.date || candidateUpstream.day.dayname || '').toLowerCase()
        const target = rawDay.includes('fri') ? 'Fri' : (rawDay.includes('wed') || rawDay.includes('thu') || rawDay.includes('thur')) ? 'Wed/Thurs' : 'Mon/Tues'
        const mapped = (candidateUpstream.day.bells || []).map((b: any) => {
          const label = b.bellDisplay || b.period || b.bell || String(b.period)
          const time = b.startTime ? (b.startTime + (b.endTime ? ' - ' + b.endTime : '')) : (b.time || '')
          return { period: String(label), time }
        })
        if ((!result[target] || result[target].length === 0) && mapped.length) result[target] = mapped.slice()
      } else if (candidateUpstream?.bells && Array.isArray(candidateUpstream.bells.bells) && candidateUpstream.bells.bells.length) {
        const rawDay = String(candidateUpstream.bells.day || candidateUpstream.bells.date || candidateUpstream.bells.dayName || '').toLowerCase()
        if (rawDay) {
          const target = rawDay.includes('fri') ? 'Fri' : (rawDay.includes('wed') || rawDay.includes('thu') || rawDay.includes('thur')) ? 'Wed/Thurs' : 'Mon/Tues'
          const mapped = (candidateUpstream.bells.bells || []).map((b: any) => {
            const label = b.bellDisplay || b.period || b.bell || String(b.period)
            const time = b.startTime ? (b.startTime + (b.endTime ? ' - ' + b.endTime : '')) : (b.time || '')
            return { period: String(label), time }
          })
          if ((!result[target] || result[target].length === 0) && mapped.length) result[target] = mapped.slice()
        }
      }
    } catch (e) {
      // ignore and return what we could assemble
    }
  } catch (e) {
    // ignore and return what we could assemble
  }

  return result
}

// Explicit empty timetable used when the upstream API reports "no timetable".
const emptyByDay: Record<string, Period[]> = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] }

const payloadHasNoTimetable = (payload: any) => {
  try {
    if (!payload) return false
    if (payload.error) return true
    if (payload.timetable === false) return true
    if (payload.upstream && payload.upstream.day && (payload.upstream.day.timetable === false || String(payload.upstream.day.status).toLowerCase() === 'error')) return true
    if (payload.diagnostics && payload.diagnostics.upstream && payload.diagnostics.upstream.day && (payload.diagnostics.upstream.day.timetable === false || String(payload.diagnostics.upstream.day.status).toLowerCase() === 'error')) return true
  } catch (e) {}
  return false
}

// Mock data for the timetable - memoized
const timetableWeekA = {
  Monday: [
    { id: 1, period: "1", time: "9:00 - 10:05", subject: "English", teacher: "Ms. Smith", room: "301" },
    { id: 2, period: "2", time: "10:05 - 11:05", subject: "Mathematics", teacher: "Mr. Johnson", room: "304" },
    { id: 3, period: "Recess", time: "11:05 - 11:25", subject: "Break", teacher: "", room: "" },
    { id: 4, period: "3", time: "11:25 - 12:30", subject: "Science", teacher: "Dr. Williams", room: "402" },
    { id: 5, period: "4", time: "12:30 - 1:30", subject: "History", teacher: "Mr. Brown", room: "205" },
    { id: 6, period: "Lunch 1", time: "1:30 - 1:50", subject: "Break", teacher: "", room: "" },
    { id: 7, period: "Lunch 2", time: "1:50 - 2:10", subject: "Break", teacher: "", room: "" },
    { id: 8, period: "5", time: "2:10 - 3:10", subject: "Geography", teacher: "Ms. Taylor", room: "207" },
  ],
  Tuesday: [
    { id: 1, period: "1", time: "9:00 - 10:05", subject: "Mathematics", teacher: "Mr. Johnson", room: "304" },
    { id: 2, period: "2", time: "10:05 - 11:05", subject: "English", teacher: "Ms. Smith", room: "301" },
    { id: 3, period: "Recess", time: "11:05 - 11:25", subject: "Break", teacher: "", room: "" },
    { id: 4, period: "3", time: "11:25 - 12:30", subject: "History", teacher: "Mr. Brown", room: "205" },
    { id: 5, period: "4", time: "12:30 - 1:30", subject: "Science", teacher: "Dr. Williams", room: "402" },
    { id: 6, period: "Lunch 1", time: "1:30 - 1:50", subject: "Break", teacher: "", room: "" },
    { id: 7, period: "Lunch 2", time: "1:50 - 2:10", subject: "Break", teacher: "", room: "" },
    { id: 8, period: "5", time: "2:10 - 3:10", subject: "Science", teacher: "Dr. Williams", room: "Lab 2" },
  ],
  Wednesday: [
    { id: 1, period: "1", time: "9:00 - 10:05", subject: "Science", teacher: "Dr. Williams", room: "Lab 2" },
    { id: 2, period: "2", time: "10:05 - 11:05", subject: "Mathematics", teacher: "Mr. Johnson", room: "304" },
    { id: 3, period: "Recess", time: "11:05 - 11:25", subject: "Break", teacher: "", room: "" },
    { id: 4, period: "3", time: "11:25 - 12:25", subject: "English", teacher: "Ms. Smith", room: "301" },
    { id: 5, period: "Lunch 1", time: "12:25 - 12:45", subject: "Break", teacher: "", room: "" },
    { id: 6, period: "Lunch 2", time: "12:45 - 1:05", subject: "Break", teacher: "", room: "" },
    { id: 7, period: "4", time: "1:05 - 2:10", subject: "Geography", teacher: "Ms. Taylor", room: "207" },
    { id: 8, period: "5", time: "2:10 - 3:10", subject: "Computing", teacher: "Ms. Lee", room: "405" },
  ],
  Thursday: [
    { id: 1, period: "1", time: "9:00 - 10:05", subject: "English", teacher: "Ms. Smith", room: "301" },
    { id: 2, period: "2", time: "10:05 - 11:05", subject: "Geography", teacher: "Ms. Taylor", room: "207" },
    { id: 3, period: "Recess", time: "11:05 - 11:25", subject: "Break", teacher: "", room: "" },
    { id: 4, period: "3", time: "11:25 - 12:25", subject: "History", teacher: "Mr. Brown", room: "205" },
    { id: 5, period: "Lunch 1", time: "12:25 - 12:45", subject: "Break", teacher: "", room: "" },
    { id: 6, period: "Lunch 2", time: "12:45 - 1:05", subject: "Break", teacher: "", room: "" },
    { id: 7, period: "4", time: "1:05 - 2:10", subject: "Computing", teacher: "Ms. Lee", room: "405" },
    { id: 8, period: "5", time: "2:10 - 3:10", subject: "Science", teacher: "Dr. Williams", room: "402" },
  ],
  Friday: [
    { id: 1, period: "1", time: "9:25 - 10:20", subject: "Mathematics", teacher: "Mr. Johnson", room: "304" },
    { id: 2, period: "2", time: "10:20 - 11:10", subject: "History", teacher: "Mr. Brown", room: "205" },
    { id: 3, period: "Recess", time: "11:10 - 11:40", subject: "Break", teacher: "", room: "" },
    { id: 4, period: "3", time: "11:40 - 12:35", subject: "Science", teacher: "Dr. Williams", room: "Lab 2" },
    { id: 5, period: "Lunch 1", time: "12:35 - 12:55", subject: "Break", teacher: "", room: "" },
    { id: 6, period: "Lunch 2", time: "12:55 - 1:15", subject: "Break", teacher: "", room: "" },
    { id: 7, period: "4", time: "1:15 - 2:15", subject: "Music", teacher: "Mr. Anderson", room: "501" },
    { id: 8, period: "5", time: "2:15 - 3:10", subject: "Geography", teacher: "Ms. Taylor", room: "207" },
  ],
}

const timetableWeekB = {
  Monday: [
    { id: 1, period: "1", time: "9:00 - 10:05", subject: "Geography", teacher: "Ms. Taylor", room: "207" },
    { id: 2, period: "2", time: "10:05 - 11:05", subject: "Art", teacher: "Ms. Wilson", room: "Art Studio" },
    { id: 3, period: "Recess", time: "11:05 - 11:25", subject: "Break", teacher: "", room: "" },
    { id: 4, period: "3", time: "11:25 - 12:30", subject: "Computing", teacher: "Ms. Lee", room: "Computer Lab" },
    { id: 5, period: "4", time: "12:30 - 1:30", subject: "PE", teacher: "Mr. Davis", room: "101" },
    { id: 6, period: "Lunch 1", time: "1:30 - 1:50", subject: "Break", teacher: "", room: "" },
    { id: 7, period: "Lunch 2", time: "1:50 - 2:10", subject: "Break", teacher: "", room: "" },
    { id: 8, period: "5", time: "2:10 - 3:10", subject: "Mathematics", teacher: "Mr. Johnson", room: "304" },
  ],
  Tuesday: [
    { id: 1, period: "1", time: "9:00 - 10:05", subject: "Music", teacher: "Mr. Anderson", room: "501" },
    { id: 2, period: "2", time: "10:05 - 11:05", subject: "PE", teacher: "Mr. Davis", room: "101" },
    { id: 3, period: "Recess", time: "11:05 - 11:25", subject: "Break", teacher: "", room: "" },
    { id: 4, period: "3", time: "11:25 - 12:30", subject: "Art", teacher: "Ms. Wilson", room: "505" },
    { id: 5, period: "4", time: "12:30 - 1:30", subject: "Science", teacher: "Dr. Williams", room: "Lab 2" },
    { id: 6, period: "Lunch 1", time: "1:30 - 1:50", subject: "Break", teacher: "", room: "" },
    { id: 7, period: "Lunch 2", time: "1:50 - 2:10", subject: "Break", teacher: "", room: "" },
    { id: 8, period: "5", time: "2:10 - 3:10", subject: "History", teacher: "Mr. Brown", room: "205" },
  ],
  Wednesday: [
    { id: 1, period: "1", time: "9:00 - 10:05", subject: "Computing", teacher: "Ms. Lee", room: "405" },
    { id: 2, period: "2", time: "10:05 - 11:05", subject: "Music", teacher: "Mr. Anderson", room: "501" },
    { id: 3, period: "Recess", time: "11:05 - 11:25", subject: "Break", teacher: "", room: "" },
    { id: 4, period: "3", time: "11:25 - 12:25", subject: "PE", teacher: "Mr. Davis", room: "101" },
    { id: 5, period: "Lunch 1", time: "12:25 - 12:45", subject: "Break", teacher: "", room: "" },
    { id: 6, period: "Lunch 2", time: "12:45 - 1:05", subject: "Break", teacher: "", room: "" },
    { id: 7, period: "4", time: "1:05 - 2:10", subject: "Art", teacher: "Ms. Wilson", room: "505" },
    { id: 8, period: "5", time: "2:10 - 3:10", subject: "English", teacher: "Ms. Smith", room: "301" },
  ],
  Thursday: [
    { id: 1, period: "1", time: "9:00 - 10:05", subject: "English", teacher: "Ms. Smith", room: "301" },
    { id: 2, period: "2", time: "10:05 - 11:05", subject: "Geography", teacher: "Ms. Taylor", room: "207" },
    { id: 3, period: "Recess", time: "11:05 - 11:25", subject: "Break", teacher: "", room: "" },
    { id: 4, period: "3", time: "11:25 - 12:25", subject: "History", teacher: "Mr. Brown", room: "205" },
    { id: 5, period: "Lunch 1", time: "12:25 - 12:45", subject: "Break", teacher: "", room: "" },
    { id: 6, period: "Lunch 2", time: "12:45 - 1:05", subject: "Break", teacher: "", room: "" },
    { id: 7, period: "4", time: "1:05 - 2:10", subject: "Computing", teacher: "Ms. Lee", room: "405" },
    { id: 8, period: "5", time: "2:10 - 3:10", subject: "Science", teacher: "Dr. Williams", room: "402" },
  ],
  Friday: [
    { id: 1, period: "1", time: "9:25 - 10:20", subject: "Mathematics", teacher: "Mr. Johnson", room: "304" },
    { id: 2, period: "2", time: "10:20 - 11:10", subject: "History", teacher: "Mr. Brown", room: "205" },
    { id: 3, period: "Recess", time: "11:10 - 11:40", subject: "Break", teacher: "", room: "" },
    { id: 4, period: "3", time: "11:40 - 12:35", subject: "Science", teacher: "Dr. Williams", room: "Lab 2" },
    { id: 5, period: "Lunch 1", time: "12:35 - 12:55", subject: "Break", teacher: "", room: "" },
    { id: 6, period: "Lunch 2", time: "12:55 - 1:15", subject: "Break", teacher: "", room: "" },
    { id: 7, period: "4", time: "1:15 - 2:15", subject: "Music", teacher: "Mr. Anderson", room: "501" },
    { id: 8, period: "5", time: "2:15 - 3:10", subject: "Geography", teacher: "Ms. Taylor", room: "207" },
  ],
}

// Create the provider component
export function TimetableProvider({ children }: { children: ReactNode }) {
  const [currentWeek, setCurrentWeek] = useState<"A" | "B" | null>(null)
  const [selectedDay, setSelectedDay] = useState<string>("") // Day for main timetable
  const [selectedDateObject, setSelectedDateObject] = useState<Date>(new Date()) // Date object for selectedDay
  const [isShowingNextDay, setIsShowingNextDay] = useState(false) // For main timetable
  // Track when the user manually selected a date so we don't auto-override it
  const lastUserSelectedRef = useRef<number | null>(null)
  const loadTimingStartedRef = useRef(false)
  const [currentMomentPeriodInfo, setCurrentMomentPeriodInfo] = useState({
    // For header status
    nextPeriod: null as Period | null,
    timeUntil: "",
    isCurrentlyInClass: false,
    currentPeriod: null as Period | null,
  })

  // Memoize the current timetable based on selected week
  // Try to synchronously hydrate last-known timetable from localStorage so the UI
  // can display cached data instantly while we fetch fresh data in the background.
  const [externalTimetable, setExternalTimetable] = useState<Record<string, Period[]> | null>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('synchron-last-timetable') : null
      try { if (raw) { console.debug('[timetable.provider] found synchron-last-timetable in storage') } } catch (e) {}
      if (raw) {
        const parsed = JSON.parse(raw)
        if (!parsed) return null
        // Support either the payload shape { timetable: {...} } or a plain day->period map
        if (parsed.timetable && typeof parsed.timetable === 'object') return parsed.timetable
        // If the stored object looks like { Monday: [...], Tuesday: [...] } treat it as the timetable directly
        const keys = Object.keys(parsed)
        const daySet = new Set(['monday','tuesday','wednesday','thursday','friday'])
        const lcKeys = keys.map(k => String(k).toLowerCase())
        const hasDayKeys = lcKeys.some(k => daySet.has(k))
        if (hasDayKeys) return parsed as Record<string, Period[]>
      }
    } catch (e) {
      // ignore parse errors
    }
    return null
  })
  const [lastRecordedTimetable, setLastRecordedTimetable] = useState<Record<string, Period[]> | null>(externalTimetable)
  const [timetableSource, setTimetableSource] = useState<string | null>(null)
  const [externalTimetableByWeek, setExternalTimetableByWeek] = useState<Record<string, { A: Period[]; B: Period[]; unknown: Period[] }> | null>(null)
  const [lastRecordedTimetableByWeek, setLastRecordedTimetableByWeek] = useState<Record<string, { A: Period[]; B: Period[]; unknown: Period[] }> | null>(externalTimetableByWeek)
  // Record the authoritative week type provided by the server (A/B) when available
  const [externalWeekType, setExternalWeekType] = useState<"A" | "B" | null>(null)
  // Debug: record last fetched date and a small payload summary for diagnostics
  const [lastFetchedDate, setLastFetchedDate] = useState<string | null>(null)
  const [lastFetchedPayloadSummary, setLastFetchedPayloadSummary] = useState<any | null>(null)
  const [externalBellTimes, setExternalBellTimes] = useState<Record<string, { period: string; time: string }[]> | null>(null)
  const lastSeenBellTimesRef = useRef<Record<string, { period: string; time: string }[]> | null>(null)
  const lastSeenBellTsRef = useRef<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  // Start a simple mount->ready timer so we can measure app load time
  useEffect(() => {
    if (typeof window === 'undefined') return
    try { console.time('[timetable] mount->ready') } catch (e) {}
    loadTimingStartedRef.current = true
  }, [])

  // Persist the last successful external timetable to localStorage so the
  // app can immediately show the most-recent real data after a reload.
  useEffect(() => {
    try {
      if (externalTimetable && timetableSource && timetableSource !== 'fallback-sample') {
        const payload = {
          timetable: externalTimetable,
          timetableByWeek: externalTimetableByWeek || null,
          bellTimes: externalBellTimes || null,
          source: timetableSource,
          weekType: externalWeekType || null,
          savedAt: (new Date()).toISOString(),
        }
        try {
          localStorage.setItem('synchron-last-timetable', JSON.stringify(payload))
          try { console.debug('[timetable.provider] wrote synchron-last-timetable (externalTimetable payload)') } catch (e) {}
        } catch (e) {
          // ignore storage errors
        }
        setLastRecordedTimetable(externalTimetable)
        if (externalTimetableByWeek) setLastRecordedTimetableByWeek(externalTimetableByWeek)
        if (externalBellTimes) { lastSeenBellTimesRef.current = externalBellTimes; lastSeenBellTsRef.current = Date.now() }
        try { console.log('[timetable.provider] persisted last external timetable', { source: timetableSource }) } catch (e) {}
      }
    } catch (e) {
      // ignore
    }
  }, [externalTimetable, externalTimetableByWeek, externalBellTimes, timetableSource, externalWeekType])

  const timetableData: Record<string, Period[]> = useMemo(() => {
    try { console.log('[timetable.provider] building timetableData', { currentWeek, hasByWeek: !!externalTimetableByWeek, hasTimetable: !!externalTimetable, hasBellTimes: !!externalBellTimes }) } catch (e) {}

    // When loading fresh API data, prefer showing the last recorded external
    // timetable so the UI doesn't flash empty while a reload completes.
    const useExternalTimetable = (isLoading && lastRecordedTimetable) ? lastRecordedTimetable : externalTimetable
    const useExternalTimetableByWeek = (isLoading && lastRecordedTimetableByWeek) ? lastRecordedTimetableByWeek : externalTimetableByWeek
    const useExternalBellTimes = externalBellTimes || lastSeenBellTimesRef.current

    // Cleanup helper: remove roll-call entries and orphaned period '0' placeholders
    const normalizePeriodLabel = (p?: string) => String(p || '').trim().toLowerCase()
    const isRollCallEntry = (p: any) => {
      const subj = String(p?.subject || '').toLowerCase()
      const per = normalizePeriodLabel(p?.period)
      return subj.includes('roll call') || subj === 'rollcall' || per === 'rc' || subj === 'rc' || subj.includes('roll')
    }
    const cleanupMap = (m: Record<string, Period[]>) => {
      for (const [day, arr] of Object.entries(m)) {
        try {
          const hasReal0 = arr.some(p => normalizePeriodLabel(p.period) === '0' && String(p.subject || '').trim() !== '')
          m[day] = arr.filter(p => {
            if (isRollCallEntry(p)) return false
            if (!hasReal0 && normalizePeriodLabel(p.period) === '0') return false
            return true
          })
        } catch (e) { /* ignore cleanup errors */ }
      }
      return m
    }
    // Normalize any explicit to-room fields left on period objects so the UI
    // displays the destination room (toRoom / roomTo / room_to) in place of
    // the original room. This is defensive: some upstream payloads include
    // room variations directly on period objects instead of separate
    // substitutions; prefer those when present.
    const preferToRoomOnMap = (m: Record<string, Period[]>) => {
      for (const day of Object.keys(m)) {
        try {
          m[day] = (m[day] || []).map((p) => {
            // Check several common variant keys that might exist on the
            // incoming period object.
            const candidate = (p as any).toRoom || (p as any).roomTo || (p as any)["room_to"] || (p as any).newRoom || (p as any).to || undefined
            if (candidate && String(candidate).trim() && candidate !== p.room) {
              return { ...p, room: String(candidate), isRoomChange: true }
            }
            return p
          })
        } catch (e) {
          // ignore normalization errors
        }
      }
      return m
    }
    // Prefer grouped timetableByWeek when available (server now returns `timetableByWeek`).
    
    if (useExternalTimetableByWeek) {
      const filtered: Record<string, Period[]> = {}
      for (const [day, groups] of Object.entries(useExternalTimetableByWeek as Record<string, { A: Period[]; B: Period[]; unknown: Period[] }>)) {
        const list = ((currentWeek === 'A' || currentWeek === 'B') && groups && Array.isArray(groups[currentWeek])) ? (groups[currentWeek] as Period[]) : []
        filtered[day] = list.slice()
      }
      // Ensure break periods (Recess, Lunch 1, Lunch 2) exist using bellTimesData
      const getBellForDay = (dayName: string) => {
        // If the server provided bell times at all, always prefer the API's
        // bucket for that day and respect its ordering. Only fall back to the
        // built-in `bellTimesData` when no `externalBellTimes` object exists.
        if (useExternalBellTimes) {
          return dayName === 'Friday' ? useExternalBellTimes.Fri : (dayName === 'Wednesday' || dayName === 'Thursday' ? useExternalBellTimes['Wed/Thurs'] : useExternalBellTimes['Mon/Tues']) || []
        }
        return dayName === 'Friday' ? bellTimesData.Fri : (dayName === 'Wednesday' || dayName === 'Thursday' ? bellTimesData['Wed/Thurs'] : bellTimesData['Mon/Tues'])
      }
      

      for (const day of Object.keys(filtered)) {
        let bells = (getBellForDay(day) || []).slice()
        const dayPeriods = filtered[day]
        // If the server provided `externalBellTimes`, always respect the
        // API ordering; otherwise, sort bells by canonical order.
        if (!useExternalBellTimes) {
          // Sort bells by canonical order, falling back to time when labels are ambiguous
          bells.sort((a, b) => {
            const ai = canonicalIndex(a?.period)
            const bi = canonicalIndex(b?.period)
            if (ai !== bi) return ai - bi
            return parseStartMinutesForDay(dayPeriods, a.time) - parseStartMinutesForDay(dayPeriods, b.time)
          })
        }

        for (const b of bells) {
          // Use the API ordering and decide whether this bell represents a
          // break by checking whether its start time already matches an
          // existing class start time. If no class starts at this minute,
          // treat it as a Break and insert it using the API's label/time.
          try {
            const bellStart = parseStartMinutesForDay(dayPeriods, b.time)
            const classStarts = dayPeriods.map((p) => ({ p, s: parseStartMinutesForDay(dayPeriods, p.time) }))
            const matching = classStarts.filter((c) => Math.abs(c.s - bellStart) <= 1)
            const hasMatchingClass = matching.length > 0
            try { console.log('[timetable.provider] bell-check', { day: day, bell: b.period || b, bellTime: b.time, bellStart, hasMatchingClass, matchingStarts: matching.map(m => ({ period: m.p.period, time: m.p.time, start: m.s })) }) } catch (e) {}
            if (hasMatchingClass) continue
            const label = b.period || 'Break'
            const exists = dayPeriods.some((p) => p.subject === 'Break' && (p.period || '').toLowerCase() === String(label).toLowerCase())
            if (!exists) {
              dayPeriods.push({ period: label, time: b.time, subject: 'Break', teacher: '', room: '' })
            }
          } catch (e) {
            // If parsing fails, fall back to label-based detection
            const label = b.period
            if (!/(recess|lunch|break)/i.test(label)) continue
            const exists = dayPeriods.some((p) => p.subject === 'Break' && (p.period || '').toLowerCase() === label.toLowerCase())
            if (!exists) {
              dayPeriods.push({ period: label, time: b.time, subject: 'Break', teacher: '', room: '' })
            }
          }
        }
        dayPeriods.sort((a, z) => {
          const aIsBreak = /(?:recess|lunch|break)/i.test(String(a.subject || a.period || ''))
          const zIsBreak = /(?:recess|lunch|break)/i.test(String(z.subject || z.period || ''))
          if (!aIsBreak && !zIsBreak) {
            const ai = canonicalIndex(a.period)
            const zi = canonicalIndex(z.period)
            if (ai < 998 && zi < 998 && ai !== zi) return ai - zi
          }
          return parseStartMinutesForDay(dayPeriods, a.time) - parseStartMinutesForDay(dayPeriods, z.time)
        })
        filtered[day] = dayPeriods
      }

      preferToRoomOnMap(filtered)
      return cleanupMap(filtered)
    }

    if (useExternalTimetable) {
      const filtered: Record<string, Period[]> = {}
      for (const [day, periods] of Object.entries(useExternalTimetable)) {
        const list = Array.isArray(periods) ? periods : []
        // Only show entries that explicitly match the API-determined week. Do not
        // include untagged entries when `currentWeek` is unknown.
        filtered[day] = (currentWeek === 'A' || currentWeek === 'B') ? list.filter((p) => p.weekType === currentWeek) : []
      }
      // If the server explicitly reported that there is no timetable for the
      // requested date, return the empty-by-day map as-is (do not insert
      // Break rows based on bell times). This keeps the UI blank like a
      // weekend when upstream reports "no timetable".
      if (timetableSource === 'external-empty') {
        preferToRoomOnMap(filtered)
        return cleanupMap(filtered)
      }
      // Ensure break periods (Recess, Lunch 1, Lunch 2) exist using bellTimesData
      const getBellForDay = (dayName: string) => {
        const source = useExternalBellTimes || bellTimesData
        const bucket = dayName === 'Friday' ? source.Fri : (dayName === 'Wednesday' || dayName === 'Thursday' ? source['Wed/Thurs'] : source['Mon/Tues'])
        const hasBreakLike = Array.isArray(bucket) && bucket.some((b) => /(?:recess|lunch|break)/i.test(String(b?.period || '')))
        if (!hasBreakLike && useExternalBellTimes) {
          return dayName === 'Friday' ? bellTimesData.Fri : (dayName === 'Wednesday' || dayName === 'Thursday' ? bellTimesData['Wed/Thurs'] : bellTimesData['Mon/Tues'])
        }
        return bucket || (dayName === 'Friday' ? bellTimesData.Fri : (dayName === 'Wednesday' || dayName === 'Thursday' ? bellTimesData['Wed/Thurs'] : bellTimesData['Mon/Tues']))
      }

      const parseStartMinutes = (timeStr: string) => {
        try {
          const part = (timeStr || '').split('-')[0].trim()
          const [h, m] = part.split(':').map((s) => parseInt(s, 10))
          if (Number.isFinite(h) && Number.isFinite(m)) return h * 60 + m
        } catch (e) {}
        return 0
      }

      for (const day of Object.keys(filtered)) {
        const bells = getBellForDay(day) || []
        const dayPeriods = filtered[day]

        // If the server provided an explicit bellTimes object, respect the
        // original API ordering for that day's bucket. Otherwise, sort bells
        // into canonical order as a fallback.
        const externalBucket = useExternalBellTimes ? (day === 'Friday' ? useExternalBellTimes.Fri : (day === 'Wednesday' || day === 'Thursday' ? useExternalBellTimes['Wed/Thurs'] : useExternalBellTimes['Mon/Tues'])) : null
        const shouldRespectApiOrder = !!externalBucket && Array.isArray(externalBucket)

        if (!shouldRespectApiOrder) {
          bells.sort((a, b) => {
            const ai = canonicalIndex(a?.period)
            const bi = canonicalIndex(b?.period)
            if (ai !== bi) return ai - bi
            return parseStartMinutesForDay(dayPeriods, a.time) - parseStartMinutesForDay(dayPeriods, b.time)
          })
        }

        for (const b of bells) {
          try {
            const bellStart = parseStartMinutesForDay(dayPeriods, b.time)
            const classStarts = dayPeriods.map((p) => ({ p, s: parseStartMinutesForDay(dayPeriods, p.time) }))
            const matching = classStarts.filter((c) => Math.abs(c.s - bellStart) <= 1)
            const hasMatchingClass = matching.length > 0
            try { console.log('[timetable.provider] bell-check', { day: day, bell: b.period || b, bellTime: b.time, bellStart, hasMatchingClass, matchingStarts: matching.map(m => ({ period: m.p.period, time: m.p.time, start: m.s })) }) } catch (e) {}
            if (hasMatchingClass) continue
            const label = b.period || 'Break'
            const exists = dayPeriods.some((p) => p.subject === 'Break' && (p.period || '').toLowerCase() === String(label).toLowerCase())
            if (!exists) {
              dayPeriods.push({ period: label, time: b.time, subject: 'Break', teacher: '', room: '' })
            }
          } catch (e) {
            const label = b.period
            if (!/(recess|lunch|break)/i.test(label)) continue
            const exists = dayPeriods.some((p) => p.subject === 'Break' && (p.period || '').toLowerCase() === label.toLowerCase())
            if (!exists) {
              dayPeriods.push({ period: label, time: b.time, subject: 'Break', teacher: '', room: '' })
            }
          }
        }

        dayPeriods.sort((a, z) => {
          const aIsBreak = /(?:recess|lunch|break)/i.test(String(a.subject || a.period || ''))
          const zIsBreak = /(?:recess|lunch|break)/i.test(String(z.subject || z.period || ''))
          if (!aIsBreak && !zIsBreak) {
            const ai = canonicalIndex(a.period)
            const zi = canonicalIndex(z.period)
            if (ai < 998 && zi < 998 && ai !== zi) return ai - zi
          }
          return parseStartMinutesForDay(dayPeriods, a.time) - parseStartMinutesForDay(dayPeriods, z.time)
        })
        filtered[day] = dayPeriods
      }

      preferToRoomOnMap(filtered)
      return cleanupMap(filtered)
    }

    // If we don't have an external timetable but we do have bell times from
    // the API, apply those bell buckets to our sample timetable so the UI
    // continues to FOLLOW THE API (insert breaks) instead of reverting to
    // a view that lacks the API's break rows. This addresses a race where
    // the timetable payload may be lost or fall back to sample after bells
    // have already arrived.
    if (useExternalBellTimes) {
      const emptyByDay: Record<string, Period[]> = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] }
      const sample = (timetableSource === 'fallback-sample' && (currentWeek !== 'A' && currentWeek !== 'B'))
        ? emptyByDay
        : (currentWeek === "B" ? timetableWeekB : timetableWeekA)
      const filtered: Record<string, Period[]> = {}
      for (const [day, periods] of Object.entries(sample)) filtered[day] = (periods || []).slice()

      const getBellForDay = (dayName: string) => {
        const source = useExternalBellTimes || bellTimesData
        const bucket = dayName === 'Friday' ? source.Fri : (dayName === 'Wednesday' || dayName === 'Thursday' ? source['Wed/Thurs'] : source['Mon/Tues'])
        const hasBreakLike = Array.isArray(bucket) && bucket.some((b) => /(?:recess|lunch|break)/i.test(String(b?.period || '')))
        if (!hasBreakLike && useExternalBellTimes) {
          return dayName === 'Friday' ? bellTimesData.Fri : (dayName === 'Wednesday' || dayName === 'Thursday' ? bellTimesData['Wed/Thurs'] : bellTimesData['Mon/Tues'])
        }
        return bucket || (dayName === 'Friday' ? bellTimesData.Fri : (dayName === 'Wednesday' || dayName === 'Thursday' ? bellTimesData['Wed/Thurs'] : bellTimesData['Mon/Tues']))
      }

      for (const day of Object.keys(filtered)) {
        let bells = (getBellForDay(day) || []).slice()
        const dayPeriods = filtered[day]
        // When externalBellTimes is present we should respect API ordering.
        if (!externalBellTimes) {
          bells.sort((a, b) => {
            const ai = canonicalIndex(a?.period)
            const bi = canonicalIndex(b?.period)
            if (ai !== bi) return ai - bi
            return parseStartMinutesForDay(dayPeriods, a.time) - parseStartMinutesForDay(dayPeriods, b.time)
          })
        }

        for (const b of bells) {
          try {
            const bellStart = parseStartMinutesForDay(dayPeriods, b.time)
            const classStarts = dayPeriods.map((p) => ({ p, s: parseStartMinutesForDay(dayPeriods, p.time) }))
            const matching = classStarts.filter((c) => Math.abs(c.s - bellStart) <= 1)
            const hasMatchingClass = matching.length > 0
            try { console.log('[timetable.provider] bell-check', { day: day, bell: b.period || b, bellTime: b.time, bellStart, hasMatchingClass, matchingStarts: matching.map(m => ({ period: m.p.period, time: m.p.time, start: m.s })) }) } catch (e) {}
            if (hasMatchingClass) continue
            const label = b.period || 'Break'
            const exists = dayPeriods.some((p) => p.subject === 'Break' && (p.period || '').toLowerCase() === String(label).toLowerCase())
            if (!exists) {
              dayPeriods.push({ period: label, time: b.time, subject: 'Break', teacher: '', room: '' })
            }
          } catch (e) {
            const label = b.period
            if (!/(recess|lunch|break)/i.test(label)) continue
            const exists = dayPeriods.some((p) => p.subject === 'Break' && (p.period || '').toLowerCase() === label.toLowerCase())
            if (!exists) {
              dayPeriods.push({ period: label, time: b.time, subject: 'Break', teacher: '', room: '' })
            }
          }
        }

        dayPeriods.sort((a, z) => {
          const aIsBreak = /(?:recess|lunch|break)/i.test(String(a.subject || a.period || ''))
          const zIsBreak = /(?:recess|lunch|break)/i.test(String(z.subject || z.period || ''))
          if (!aIsBreak && !zIsBreak) {
            const ai = canonicalIndex(a.period)
            const zi = canonicalIndex(z.period)
            if (ai < 998 && zi < 998 && ai !== zi) return ai - zi
          }
          return parseStartMinutesForDay(dayPeriods, a.time) - parseStartMinutesForDay(dayPeriods, z.time)
        })
        filtered[day] = dayPeriods
      }

      preferToRoomOnMap(filtered)
      return cleanupMap(filtered)
    }

    // If we're displaying the bundled sample because live data couldn't be obtained,
    // and the API hasn't explicitly specified A/B (currentWeek is null), do not
    // assume a default week — return an empty timetable so the UI can show a
    // clear message instead of presenting potentially incorrect week data.
    if (timetableSource === 'fallback-sample' && (currentWeek !== 'A' && currentWeek !== 'B')) {
      return { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] }
    }

    return currentWeek === "B" ? timetableWeekB : timetableWeekA
  }, [currentWeek, externalTimetable, externalTimetableByWeek, externalBellTimes, lastRecordedTimetable, lastRecordedTimetableByWeek, isLoading])

  // Track whether substitutions have been applied to the current external timetable
  const subsAppliedRef = useRef<number | null>(null)
  // Track the last date string we requested from /api/timetable to avoid
  // redundant concurrent or repeated fetches for the same date.
  const lastRequestedDateRef = useRef<string | null>(null)

  // Helper: fetch substitutions from our server route. Supports JSON responses
  // and HTML fallbacks by scraping via PortalScraper when necessary.
  const getPortalSubstitutions = async (): Promise<any[]> => {
    try {
      // Prefer the AI timetable endpoint which does not require portal sign-in.
      // Use the provider's selected date (fall back to today) to request date-specific substitutions.
      const dateObj = selectedDateObject || new Date()
      const y = dateObj.getFullYear()
      const m = String(dateObj.getMonth() + 1).padStart(2, '0')
      const d = String(dateObj.getDate()).padStart(2, '0')
      const dateParam = `${y}-${m}-${d}`
      const aiUrl = `/api/timetable?date=${dateParam}`

      try {
        const res = await fetch(aiUrl, { credentials: 'include' })
        const ct = res.headers.get('content-type') || ''
        if (res.ok && ct.includes('application/json')) {
          const j = await res.json()
          try { console.debug('[timetable.provider] ai timetable fetched', aiUrl, (j && (Array.isArray(j.variations) ? j.variations.length : (j.substitutions ? j.substitutions.length : undefined)) ) ) } catch (e) {}
          // Try to extract variations from known fields in the AI payload first
          const fromUpstream = PortalScraper.extractVariationsFromJson(j)
          try { console.debug('[timetable.provider] extracted variations from /api/timetable payload', Array.isArray(fromUpstream) ? fromUpstream.length : 0, fromUpstream && fromUpstream[0] || null) } catch (e) {}
          if (Array.isArray(fromUpstream) && fromUpstream.length) return fromUpstream
          // fall back to commonly named keys
          if (Array.isArray(j.substitutions)) return j.substitutions
          if (Array.isArray(j.variations)) return j.variations
        }
        // If AI endpoint returned HTML, attempt to scrape it
        if (res.ok && ct.includes('text/html')) {
          const text = await res.text()
          try {
            const extracted = PortalScraper.extractVariationsFromHtml(text)
            try { console.debug('[timetable.provider] ai timetable extracted from HTML', extracted.length) } catch (e) {}
            return extracted || []
          } catch (e) {}
        }
      } catch (e) {
        // ignore and fall through to other strategies
      }

      // As a last resort we may try the legacy portal route, but avoid it if possible
      try {
        const res2 = await fetch('/api/portal/substitutions', { credentials: 'include' })
        const ctype = res2.headers.get('content-type') || ''
        if (res2.ok && ctype.includes('application/json')) {
          const j = await res2.json()
          try { console.debug('[timetable.provider] portal subs fallback', Array.isArray(j.substitutions) ? j.substitutions.length : 0) } catch (e) {}
          return j.substitutions || []
        }
        if (res2.ok && ctype.includes('text/html')) {
          const text = await res2.text()
          try {
            const extracted = PortalScraper.extractVariationsFromHtml(text)
            try { console.debug('[timetable.provider] portal subs extracted from HTML', extracted.length) } catch (e) {}
            return extracted || []
          } catch (e) {}
        }
      } catch (e) {
        // ignore
      }
    } catch (e) {
      // ignore network errors
    }
    return []
  }

  // When an external timetable is loaded, attempt to fetch live substitutions and apply them once.
  useEffect(() => {
    // If we hydrated a cached timetable, mark the source so UI can show it's cached
    if (externalTimetable && !timetableSource) {
      setTimetableSource('cache')
    }
  }, [externalTimetable, timetableSource])

  // If we hydrated a cached externalTimetable on load, ensure the lastRecorded
  // pointer is set so other fallback logic and persistence pick it up.
  useEffect(() => {
    try {
      if (externalTimetable && !lastRecordedTimetable) {
        setLastRecordedTimetable(externalTimetable)
        try { console.debug('[timetable.provider] hydrated lastRecordedTimetable from storage') } catch (e) {}
      }
      if (externalTimetableByWeek && !lastRecordedTimetableByWeek) {
        setLastRecordedTimetableByWeek(externalTimetableByWeek)
      }
    } catch (e) {
      // ignore
    }
  }, [externalTimetable, externalTimetableByWeek, lastRecordedTimetable, lastRecordedTimetableByWeek])

  // Debounced persistence of the last-known timetable to localStorage. This
  // avoids lots of synchronous I/O if the timetable is updated repeatedly in
  // quick succession (for example when substitutions are applied).
  const persistTimerRef = useRef<number | null>(null)
  useEffect(() => {
    try {
      if (persistTimerRef.current != null) {
        window.clearTimeout(persistTimerRef.current)
        persistTimerRef.current = null
      }
      persistTimerRef.current = window.setTimeout(() => {
          try {
            if (lastRecordedTimetable) {
              const payload = {
                timetable: lastRecordedTimetable,
                source: timetableSource ?? 'external',
                ts: Date.now(),
                // Persist the last-seen bell times so UI can hydrate them
                bellTimes: lastSeenBellTimesRef.current || externalBellTimes || null,
              }
              localStorage.setItem('synchron-last-timetable', JSON.stringify(payload))
              try { console.debug('[timetable.provider] wrote synchron-last-timetable (lastRecordedTimetable persist)') } catch (e) {}
            }
        } catch (e) {
          // ignore storage errors
        }
      }, 500)
    } catch (e) {
      // ignore
    }
    return () => {
      if (persistTimerRef.current != null) {
        window.clearTimeout(persistTimerRef.current)
        persistTimerRef.current = null
      }
    }
  }, [lastRecordedTimetable, timetableSource])

  // Hydrate bell times from the last-recorded localStorage payload so the
  // timetable daily view has bell buckets immediately on startup instead of
  // waiting for the network fetch to provide them.
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('synchron-last-timetable') : null
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!parsed) return
      const persistedBellTimes = parsed.bellTimes || parsed.bells || null
      if (persistedBellTimes) {
        // Only set if we don't already have live external bell times
        if (!externalBellTimes) {
          setExternalBellTimes(persistedBellTimes)
        }
        lastSeenBellTimesRef.current = persistedBellTimes
        lastSeenBellTsRef.current = parsed.ts || Date.now()
      }
    } catch (e) {
      // ignore parse errors
    }
  }, [])

  useEffect(() => {
    if (!externalTimetable) return
    if (!timetableSource) return
    if (timetableSource === 'fallback-sample') return
    if (subsAppliedRef.current) return

    let cancelled = false

    ;(async () => {
      try {
        const subs = await getPortalSubstitutions()
        if (!cancelled && subs.length > 0) {
          try {
            const applied = applySubstitutionsToTimetable(externalTimetable, subs, { debug: true })
            setExternalTimetable(applied)
            subsAppliedRef.current = Date.now()
          } catch (e) {
            // ignore apply errors
          }
        } else {
          subsAppliedRef.current = Date.now()
        }
      } catch (e) {
        // ignore network errors
      }
    })()

    return () => { cancelled = true }
  }, [externalTimetable, timetableSource])

  // Remember last known-good external timetable data so we can continue
  // showing it while a reload is in progress or when a refresh falls back.
  useEffect(() => {
    if (externalTimetable && timetableSource && timetableSource !== 'fallback-sample') {
      setLastRecordedTimetable(externalTimetable)
    }
  }, [externalTimetable, timetableSource])

  useEffect(() => {
    if (externalTimetableByWeek) setLastRecordedTimetableByWeek(externalTimetableByWeek)
  }, [externalTimetableByWeek])

  // Try to fetch external timetable on mount
  useEffect(() => {
    let cancelled = false
    // Helper: attempt to parse timetable HTML into per-day map
    function parseTimetableHtml(html: string): Record<string, Period[]> {
      const byDay: Record<string, Period[]> = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] }
      try {
        const parser = new DOMParser()
        const doc = parser.parseFromString(html, 'text/html')

        // 1) Look for sections with day headings followed by a table
        const headings = Array.from(doc.querySelectorAll('h2, h3, h4'))
        const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
        for (const h of headings) {
          const text = (h.textContent || '').trim()
          const matched = dayNames.find((d) => text.toLowerCase().includes(d.toLowerCase()))
          if (matched) {
            // try to find next table sibling
            let next: Element | null = h.nextElementSibling
            while (next && next.tagName.toLowerCase() !== 'table') next = next.nextElementSibling
            if (next && next.tagName.toLowerCase() === 'table') {
              const rows = Array.from(next.querySelectorAll('tr'))
              for (let i = 0; i < rows.length; i++) {
                const cols = Array.from(rows[i].querySelectorAll('td, th')).map((c) => (c.textContent || '').trim())
                if (cols.length >= 3) {
                  byDay[matched].push({ period: cols[0] || '', time: cols[1] || '', subject: cols[2] || '', teacher: cols[3] || '' , room: cols[4] || '' })
                }
              }
            }
          }
        }

        // 2) If no per-day tables found, look for a table with class 'timetable' or first table and attempt to parse rows
        const anyHasData = Object.values(byDay).some((arr) => arr.length > 0)
        if (!anyHasData) {
          const table = doc.querySelector('table.timetable, table[class*=timetable], .timetable table, table')
          if (table) {
            const rows = Array.from(table.querySelectorAll('tr'))
            // Try to detect a day column in the table header
            const headerCols = Array.from(table.querySelectorAll('tr:first-child th, tr:first-child td')).map((h) => (h.textContent || '').toLowerCase())
            const hasDayCol = headerCols.some((h) => /day|weekday|date/.test(h))
            for (let i = 1; i < rows.length; i++) {
              const cols = Array.from(rows[i].querySelectorAll('td, th')).map((c) => (c.textContent || '').trim())
              if (cols.length >= 3) {
                let day = 'Monday'
                if (hasDayCol) {
                  const dayCell = cols[0]
                  const matched = dayNames.find((d) => dayCell.toLowerCase().includes(d.toLowerCase()))
                  if (matched) day = matched
                } else {
                  // Best-effort: assign to current day
                  day = getCurrentDay()
                }
                byDay[day].push({ period: cols[0] || '', time: cols[1] || '', subject: cols[2] || '', teacher: cols[3] || '' , room: cols[4] || '' })
              }
            }
          }
        }
      } catch (e) {
        // parsing failed; return empty map
      }
      return byDay
    }

    async function loadExternal() {
      try {
        await refreshExternal()
      } catch (e) {
        // ignore errors from refreshExternal
      } finally {
        // no-op
      }
    }
    loadExternal()
    return () => { cancelled = true }
  }, [])

  // Expose a refresh function so UI can trigger a retry without reloading the page
  async function refreshExternal(attemptedRefresh = false): Promise<void> {
    setIsLoading(true)
    try { console.time('[timetable] refreshExternal') } catch (e) {}
    setError(null)
    // First try the server-scraped homepage endpoint
    try {
      const ht = await fetch('/api/portal/home-timetable', { credentials: 'include' })
      const htctype = ht.headers.get('content-type') || ''
      if (ht.ok && htctype.includes('application/json')) {
        const jht = await ht.json()
        if (jht) {
          if (payloadHasNoTimetable(jht)) {
              setExternalTimetable(emptyByDay)
              setExternalTimetableByWeek(null)
              setExternalBellTimes(null)
              setTimetableSource('external-empty')
              setExternalWeekType(null)
              setCurrentWeek(null)
            return
          }
          if (jht.timetable && typeof jht.timetable === 'object' && !Array.isArray(jht.timetable)) {
            setExternalTimetable(jht.timetable)
            setTimetableSource(jht.source ?? 'external-homepage')
            if (jht.weekType === 'A' || jht.weekType === 'B') {
              setExternalWeekType(jht.weekType)
              setCurrentWeek(jht.weekType)
            }
            return
          }
        }
      } else if (htctype.includes('text/html')) {
        const html = await ht.text()
        const parsedHt = parseTimetableHtmlLocal(html)
        const hasHt = Object.values(parsedHt).some((arr) => arr.length > 0)
        if (hasHt) {
          setExternalTimetable(parsedHt)
          setTimetableSource('external-homepage')
          return
        }
      }
    } catch (e) {
      // ignore and continue to next strategies
    }

    // Reuse the parsing logic from above by creating a DOMParser here as well
    function parseTimetableHtmlLocal(html: string): Record<string, Period[]> {
      const byDay: Record<string, Period[]> = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] }
      try {
        const parser = new DOMParser()
        const doc = parser.parseFromString(html, 'text/html')

        const headings = Array.from(doc.querySelectorAll('h2, h3, h4'))
        const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
        for (const h of headings) {
          const text = (h.textContent || '').trim()
          const matched = dayNames.find((d) => text.toLowerCase().includes(d.toLowerCase()))
          if (matched) {
            let next: Element | null = h.nextElementSibling
            while (next && next.tagName.toLowerCase() !== 'table') next = next.nextElementSibling
            if (next && next.tagName.toLowerCase() === 'table') {
              const rows = Array.from(next.querySelectorAll('tr'))
              for (let i = 0; i < rows.length; i++) {
                const cols = Array.from(rows[i].querySelectorAll('td, th')).map((c) => (c.textContent || '').trim())
                if (cols.length >= 3) {
                  byDay[matched].push({ period: cols[0] || '', time: cols[1] || '', subject: cols[2] || '', teacher: cols[3] || '' , room: cols[4] || '' })
                }
              }
            }
          }
        }

        const anyHasData = Object.values(byDay).some((arr) => arr.length > 0)
        if (!anyHasData) {
          const table = doc.querySelector('table.timetable, table[class*=timetable], .timetable table, table')
          if (table) {
            const rows = Array.from(table.querySelectorAll('tr'))
            const headerCols = Array.from(table.querySelectorAll('tr:first-child th, tr:first-child td')).map((h) => (h.textContent || '').toLowerCase())
            const hasDayCol = headerCols.some((h) => /day|weekday|date/.test(h))
            for (let i = 1; i < rows.length; i++) {
              const cols = Array.from(rows[i].querySelectorAll('td, th')).map((c) => (c.textContent || '').trim())
              if (cols.length >= 3) {
                let day = 'Monday'
                if (hasDayCol) {
                  const dayCell = cols[0]
                  const matched = dayNames.find((d) => dayCell.toLowerCase().includes(d.toLowerCase()))
                  if (matched) day = matched
                } else {
                  day = getCurrentDay()
                }
                byDay[day].push({ period: cols[0] || '', time: cols[1] || '', subject: cols[2] || '', teacher: cols[3] || '' , room: cols[4] || '' })
              }
            }
          }
        }
      } catch (e) {
        // ignore
      }
      return byDay
    }

    try {
      // Try a quick probe to determine if userinfo is authenticated
      let userinfoOk = false
      try {
        const ui = await fetch('/api/portal/userinfo', { credentials: 'include' })
        const ctype = ui.headers.get('content-type') || ''
        if (ui.ok && ctype.includes('application/json')) userinfoOk = true
      } catch (e) {
        // ignore
      }

      // Always try timetable first regardless of userinfo; the API route will forward HTML if login is required
      try {
        const r = await fetch('/api/timetable', { credentials: 'include' })
        if (r.status === 401) {
          if (!attemptedRefresh) {
            try {
              await fetch('/api/auth/refresh', { credentials: 'include' })
            } catch (e) {
              // ignore
            }
              return refreshExternal(true)
          }
        }
        const rctype = r.headers.get('content-type') || ''
        if (rctype.includes('application/json')) {
          const j = await r.json()
          if (j && j.timetable) {
            if (payloadHasNoTimetable(j)) {
              setExternalTimetable(emptyByDay)
              setExternalTimetableByWeek(null)
              setExternalBellTimes(null)
              setTimetableSource('external-empty')
              setExternalWeekType(null)
              setCurrentWeek(null)
              try {
                setLastFetchedDate((new Date()).toISOString().slice(0,10))
                setLastFetchedPayloadSummary({ error: j.error ?? 'no timetable' })
              } catch (e) {}
              return
            }
            if (typeof j.timetable === 'object' && !Array.isArray(j.timetable)) {
              let finalTimetable = j.timetable
              let finalByWeek = j.timetableByWeek || null
              try {
                const subs = PortalScraper.extractVariationsFromJson(j.upstream || j)
                if (Array.isArray(subs) && subs.length) {
                  try {
                    // Apply all substitutions (date-specific + generic) to the
                    // per-day timetable so the daily view reflects exact dates.
                    finalTimetable = applySubstitutionsToTimetable(j.timetable, subs, { debug: true })
                  } catch (e) { /* ignore substitution apply errors */ }

                  // For the cycle/grouped view (timetableByWeek), only apply
                  // substitutions that do NOT have a specific date attached.
                  // Date-bound substitutions should only affect the single
                  // calendar date (daily view), not both Week A and Week B.
                  const genericSubs = subs.filter((s: any) => !s || !s.date)

                  if (j.timetableByWeek && genericSubs.length) {
                      try {
                      const byWeekSrc = j.timetableByWeek as Record<string, { A: Period[]; B: Period[]; unknown: Period[] }>
                      const transformed: Record<string, { A: Period[]; B: Period[]; unknown: Period[] }> = {}
                      // Copy to avoid mutating original
                      for (const d of Object.keys(byWeekSrc)) {
                        transformed[d] = {
                          A: Array.isArray(byWeekSrc[d].A) ? byWeekSrc[d].A.map((p) => ({ ...p })) : [],
                          B: Array.isArray(byWeekSrc[d].B) ? byWeekSrc[d].B.map((p) => ({ ...p })) : [],
                          unknown: Array.isArray(byWeekSrc[d].unknown) ? byWeekSrc[d].unknown.map((p) => ({ ...p })) : [],
                        }
                      }

                      // For each week (A/B/unknown) build a day->periods map and apply only generic substitutions
                      const applyToWeek = (weekKey: 'A' | 'B' | 'unknown') => {
                        const weekMap: Record<string, Period[]> = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] }
                        for (const d of Object.keys(transformed)) {
                          weekMap[d] = transformed[d][weekKey] || []
                        }
                        const applied = applySubstitutionsToTimetable(weekMap, genericSubs)
                        for (const d of Object.keys(transformed)) {
                          transformed[d][weekKey] = applied[d] || []
                        }
                      }

                      // Apply generic substitutions to grouped week maps (debug enabled)
                      applyToWeek('A')
                      applyToWeek('B')
                      applyToWeek('unknown')

                      finalByWeek = transformed
                    } catch (e) {
                      // ignore by-week substitution failures
                    }
                  }
                }
              } catch (e) {
                // ignore substitution extraction errors
              }
              if (finalByWeek) setExternalTimetableByWeek(finalByWeek)
              setExternalTimetable(finalTimetable)
              try {
                const dayName = (new Date()).toLocaleDateString('en-US', { weekday: 'long' })
                const summary = {
                  weekType: j.weekType ?? null,
                  counts: j.timetableByWeek && j.timetableByWeek[dayName]
                    ? { A: j.timetableByWeek[dayName].A?.length || 0, B: j.timetableByWeek[dayName].B?.length || 0, unknown: j.timetableByWeek[dayName].unknown?.length || 0 }
                    : null,
                }
                setLastFetchedDate((new Date()).toISOString().slice(0,10))
                setLastFetchedPayloadSummary(summary)
              } catch (e) {}
              setTimetableSource(j.source ?? 'external')
              if (j.weekType === 'A' || j.weekType === 'B') {
                setExternalWeekType(j.weekType)
                setCurrentWeek(j.weekType)
              }
              return
            }
            if (Array.isArray(j.timetable)) {
              const byDay: Record<string, Period[]> = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] }
              for (const p of j.timetable) {
                const day = p.day || p.weekday || 'Monday'
                if (!byDay[day]) byDay[day] = []
                byDay[day].push(p)
              }
              setExternalTimetable(byDay)
              setTimetableSource(j.source ?? 'external')
              if (j.weekType === 'A' || j.weekType === 'B') {
                setExternalWeekType(j.weekType)
                setCurrentWeek(j.weekType)
              }
              return
            }
          }
        }
        if (rctype.includes('text/html')) {
          const text = await r.text()
          const parsed = parseTimetableHtmlLocal(text)
          const hasData = Object.values(parsed).some((arr) => arr.length > 0)
          if (hasData) {
            setExternalTimetable(parsed)
            setTimetableSource('external-scraped')
            return
          }
        }
      } catch (e) {
        // fallthrough to handshake
      }

      // If not authenticated or no usable timetable, try handshake then refetch once
      try {
        await fetch('/api/portal/handshake', { method: 'POST', credentials: 'include' })
      } catch (e) {
        // ignore
      }
      // wait briefly
      await new Promise((res) => setTimeout(res, 900))

      try {
        const r2 = await fetch('/api/timetable', { credentials: 'include' })
        if (r2.status === 401) {
          if (!attemptedRefresh) {
            try {
              await fetch('/api/auth/refresh', { credentials: 'include' })
            } catch (e) {
              // ignore
            }
              return refreshExternal(true)
          }
        }
        const rctype2 = r2.headers.get('content-type') || ''
        if (rctype2.includes('application/json')) {
          const j = await r2.json()
          if (j == null) return
          if (payloadHasNoTimetable(j)) {
            if (!cancelled) {
              setExternalTimetable(emptyByDay)
              setExternalTimetableByWeek(null)
              setExternalBellTimes(null)
              setTimetableSource('external-empty')
              setExternalWeekType(null)
              setCurrentWeek(null)
              try {
                setLastFetchedDate((new Date()).toISOString().slice(0,10))
                setLastFetchedPayloadSummary({ error: j.error ?? 'no timetable' })
              } catch (e) {}
            }
            return
          }

          if (typeof j.timetable === 'object' && !Array.isArray(j.timetable)) {
            if (j.timetableByWeek) setExternalTimetableByWeek(j.timetableByWeek)
            if (j.bellTimes || j.upstream) {
              try {
                const computed = buildBellTimesFromPayload(j)
                const finalBellTimes: Record<string, any[]> = { 'Mon/Tues': [], 'Wed/Thurs': [], 'Fri': [] }
                const src = j.bellTimes || {}
                for (const k of ['Mon/Tues', 'Wed/Thurs', 'Fri']) {
                  if (src[k] && Array.isArray(src[k]) && src[k].length) finalBellTimes[k] = src[k]
                  else if (computed[k] && Array.isArray(computed[k]) && computed[k].length) finalBellTimes[k] = computed[k]
                  else finalBellTimes[k] = []
                }
                const hasAny = Object.values(finalBellTimes).some((arr) => Array.isArray(arr) && arr.length > 0)
                if (hasAny || !lastSeenBellTimesRef.current) {
                  try { console.log('[timetable.provider] setExternalBellTimes (merged retry)', finalBellTimes) } catch (e) {}
                  setExternalBellTimes(finalBellTimes)
                  lastSeenBellTimesRef.current = finalBellTimes
                  lastSeenBellTsRef.current = Date.now()
                } else {
                  try { console.log('[timetable.provider] skipping empty external bellTimes merge (retry)') } catch (e) {}
                }
              } catch (e) {
                if (j.bellTimes && Object.values(j.bellTimes).some((arr: any) => Array.isArray(arr) && arr.length > 0)) {
                  try { console.log('[timetable.provider] setExternalBellTimes (raw retry)', j.bellTimes) } catch (e) {}
                  setExternalBellTimes(j.bellTimes)
                  lastSeenBellTimesRef.current = j.bellTimes
                  lastSeenBellTsRef.current = Date.now()
                }
              }
            }
            setExternalTimetable(j.timetable)
            setTimetableSource(j.source ?? 'external')
            if (j.weekType === 'A' || j.weekType === 'B') {
              setExternalWeekType(j.weekType)
              setCurrentWeek(j.weekType)
            }
            try {
              const dayName = (new Date()).toLocaleDateString('en-US', { weekday: 'long' })
              const summary = { weekType: j.weekType ?? null, hasByWeek: !!j.timetableByWeek }
              setLastFetchedDate((new Date()).toISOString().slice(0,10))
              setLastFetchedPayloadSummary(summary)
            } catch (e) {}
            return
          }

          if (Array.isArray(j.timetable)) {
            const byDay: Record<string, Period[]> = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] }
            for (const p of j.timetable) {
              const day = p.day || p.weekday || 'Monday'
              if (!byDay[day]) byDay[day] = []
              byDay[day].push(p)
            }
            setExternalTimetable(byDay)
            setTimetableSource(j.source ?? 'external')
            if (j.weekType === 'A' || j.weekType === 'B') {
              setExternalWeekType(j.weekType)
              setCurrentWeek(j.weekType)
            }
            return
          }
        }
        if (rctype2.includes('text/html')) {
          const text = await r2.text()
          const parsed = parseTimetableHtmlLocal(text)
          const hasData = Object.values(parsed).some((arr) => arr.length > 0)
          if (hasData) {
            setExternalTimetable(parsed)
            setTimetableSource('external-scraped')
            return
          }
        }
      } catch (e) {
        // ignore
      }

      // If we still don't have live data, fall back to cached timetable for
      // authenticated users. Do NOT clear previously-discovered
      // `externalBellTimes` here — preserve bucket information so the UI
      // continues to follow API-derived break rows.
      try { console.log('[timetable.provider] falling back to sample timetable (refresh)') } catch (e) {}
      if (lastRecordedTimetable) {
        // Prefer showing cached real data when available regardless of auth state.
        setExternalTimetable(lastRecordedTimetable)
        setTimetableSource('cache')
        setError(null)
      } else if (isAuthenticated) {
        setExternalTimetable(null)
        setTimetableSource('fallback-sample')
        setError("Could not refresh timetable. Showing sample data.")
      } else {
        // No cached data and auth unknown/false: keep whatever we have and surface an error
        setExternalTimetable(null)
        setTimetableSource('fallback-sample')
        setError("Could not refresh timetable. Showing sample data.")
      }
    } catch (e) {
      try { console.log('[timetable.provider] falling back to sample timetable (refresh error)') } catch (e) {}
      if (lastRecordedTimetable) {
        setExternalTimetable(lastRecordedTimetable)
        setTimetableSource('cache')
        setError(null)
      } else if (isAuthenticated) {
        setExternalTimetable(null)
        setTimetableSource('fallback-sample')
        setError("An error occurred while refreshing timetable.")
      } else {
        setExternalTimetable(null)
        setTimetableSource('fallback-sample')
        setError("An error occurred while refreshing timetable.")
      }
    } finally {
      try { console.timeEnd('[timetable] refreshExternal') } catch (e) {}
      setIsLoading(false)
    }
  }

  // End the mount->ready timer when the provider finishes loading
  useEffect(() => {
    if (loadTimingStartedRef.current && !isLoading) {
      try { console.timeEnd('[timetable] mount->ready') } catch (e) {}
      loadTimingStartedRef.current = false
    }
  }, [isLoading])

  // Function to update all relevant time-based states
  const updateAllTimeStates = useCallback(() => {
    const currentSelectedIso = (selectedDateObject || new Date()).toISOString().slice(0,10)
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    const now = new Date()

    // 1. Determine day for main timetable display
      let dayForMainTimetable = now
      let showingNextDayFlag = false

      // If today is a weekend, show the next school day (e.g., Monday)
      const todayDow = now.getDay()
      if (todayDow === 0 || todayDow === 6) {
        dayForMainTimetable = getNextSchoolDay(now)
        showingNextDayFlag = true
      } else if (isSchoolDayOver()) {
        // If it's a weekday but the school day is over, show tomorrow's school day
        dayForMainTimetable = getNextSchoolDay(now)
        showingNextDayFlag = true
      }
    const mainTimetableDayName = days[dayForMainTimetable.getDay()]
    // Respect a recent manual selection by the user: do not override if the user
    // selected a date within the grace period.
    const GRACE_MS = 2 * 60 * 1000 // 2 minutes
    const nowMs = Date.now()
    const lastUser = lastUserSelectedRef.current
    const shouldRespectUser = lastUser && (nowMs - lastUser) < GRACE_MS

    if (!shouldRespectUser) {
      const targetDayName = mainTimetableDayName === "Sunday" || mainTimetableDayName === "Saturday" ? "Monday" : mainTimetableDayName
      const targetIso = dayForMainTimetable.toISOString().slice(0,10)
      // Only update if the selected date actually changed to avoid triggering
      // repeated fetches every tick when the date is identical.
      if (targetIso !== currentSelectedIso) {
        setSelectedDay(targetDayName)
        setSelectedDateObject(dayForMainTimetable) // Set the actual Date object
        setIsShowingNextDay(showingNextDayFlag)
      }
    }

    // 2. Calculate current moment's period info (always based on actual current day)
    const actualCurrentDayName = getCurrentDay() // Use getCurrentDay for the actual day
    if (actualCurrentDayName !== "Sunday" && actualCurrentDayName !== "Saturday") {
      const actualTodayTimetable = timetableData[actualCurrentDayName]
      const info = getTimeUntilNextPeriod(actualTodayTimetable)
      setCurrentMomentPeriodInfo(info)
    } else {
      setCurrentMomentPeriodInfo({
        nextPeriod: null,
        timeUntil: "No classes",
        isCurrentlyInClass: false,
        currentPeriod: null,
      })
    }
  }, [timetableData, selectedDateObject]) // include selectedDateObject to compare and avoid redundant updates

  // Initial update and 1-second interval for all time-based states
  useEffect(() => {
    // Adaptive ticking: update frequently while the document is visible, but
    // reduce frequency (or pause) when hidden to save CPU and battery.
    let intervalId: number | null = null

    function startFastTick() {
      if (intervalId != null) window.clearInterval(intervalId)
      updateAllTimeStates()
      intervalId = window.setInterval(updateAllTimeStates, 1000)
    }

    function startSlowTick() {
      if (intervalId != null) window.clearInterval(intervalId)
      // slow update every 15s when tab is hidden
      intervalId = window.setInterval(updateAllTimeStates, 15000)
    }

    function handleVisibility() {
      if (typeof document === 'undefined') return
      if (document.visibilityState === 'visible') startFastTick()
      else startSlowTick()
    }

    // Initialize based on current visibility and keep listeners to adjust.
    handleVisibility()
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleVisibility)

    return () => {
      if (intervalId != null) window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleVisibility)
    }
  }, [updateAllTimeStates])

  // When the selected date changes, fetch the authoritative timetable for that date
  useEffect(() => {
    let cancelled = false
    const fetchForDate = async () => {
      try {
        const ds = (selectedDateObject || new Date()).toISOString().slice(0, 10)
        // If we've just requested this same date, skip duplicate fetch
        if (lastRequestedDateRef.current === ds) return
        lastRequestedDateRef.current = ds
        const res = await fetch(`/api/timetable?date=${encodeURIComponent(ds)}`, { credentials: 'include' })
        const ctype = res.headers.get('content-type') || ''
        if (!res.ok) return
        if (ctype.includes('application/json')) {
          const j = await res.json()
          if (cancelled) return
          if (j && payloadHasNoTimetable(j)) {
            if (!cancelled) {
              setExternalTimetable(emptyByDay)
              setExternalTimetableByWeek(null)
              setExternalBellTimes(null)
              setTimetableSource('external-empty')
              setExternalWeekType(null)
              setCurrentWeek(null)
              try {
                setLastFetchedDate((new Date()).toISOString().slice(0,10))
                setLastFetchedPayloadSummary({ error: j.error ?? 'no timetable' })
              } catch (e) {}
            }
            return
          }
          if (j && j.timetable && typeof j.timetable === 'object') {
            // If the server returned substitutions separately, attempt to fetch
            // them and apply in-place so the day-by-day timetable JSON includes
            // substitute teachers and room changes.
            let finalTimetable = j.timetable
            let finalByWeek = j.timetableByWeek || null
            try {
              // First try to extract variations embedded in the timetable payload
              let subs = PortalScraper.extractVariationsFromJson(j.upstream || j)

    
              // If none found in upstream, request from the AI timetable endpoint
              if ((!Array.isArray(subs) || subs.length === 0)) {
                try {
                  const fetched = await getPortalSubstitutions()
                  if (Array.isArray(fetched) && fetched.length) subs = fetched
                } catch (e) {
                  // ignore
                }
              }

              if (Array.isArray(subs) && subs.length) {
                try {
                  // Apply all substitutions (date-specific + generic) to the per-day timetable
                  finalTimetable = applySubstitutionsToTimetable(j.timetable, subs, { debug: true })
                } catch (e) { /* ignore substitution apply errors */ }

                const genericSubs = subs.filter((s: any) => !s || !s.date)

                if (j.timetableByWeek && genericSubs.length) {
                  try {
                    const byWeekSrc = j.timetableByWeek as Record<string, { A: Period[]; B: Period[]; unknown: Period[] }>
                    const transformed: Record<string, { A: Period[]; B: Period[]; unknown: Period[] }> = {}
                    // Copy to avoid mutating original
                    for (const d of Object.keys(byWeekSrc)) {
                      transformed[d] = {
                        A: Array.isArray(byWeekSrc[d].A) ? byWeekSrc[d].A.map((p) => ({ ...p })) : [],
                        B: Array.isArray(byWeekSrc[d].B) ? byWeekSrc[d].B.map((p) => ({ ...p })) : [],
                        unknown: Array.isArray(byWeekSrc[d].unknown) ? byWeekSrc[d].unknown.map((p) => ({ ...p })) : [],
                      }
                    }

                    // For each week (A/B/unknown) build a day->periods map and apply only generic substitutions
                    const applyToWeek = (weekKey: 'A' | 'B' | 'unknown') => {
                      const weekMap: Record<string, Period[]> = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] }
                      for (const d of Object.keys(transformed)) {
                        weekMap[d] = transformed[d][weekKey] || []
                      }
                      const applied = applySubstitutionsToTimetable(weekMap, genericSubs, { debug: true })
                      for (const d of Object.keys(transformed)) {
                        transformed[d][weekKey] = applied[d] || []
                      }
                    }

                    applyToWeek('A')
                    applyToWeek('B')
                    applyToWeek('unknown')

                    finalByWeek = transformed
                  } catch (e) {
                    // ignore by-week substitution failures
                  }
                }
              }
            } catch (e) {
              // ignore substitution extraction/apply errors
            }

            if (finalByWeek) setExternalTimetableByWeek(finalByWeek)
            setExternalTimetable(finalTimetable)
            setTimetableSource(j.source ?? 'external')
            // record debug summary
            try {
              const dayName = (new Date()).toLocaleDateString('en-US', { weekday: 'long' })
              const summary = {
                weekType: j.weekType ?? null,
                counts: finalByWeek && finalByWeek[dayName]
                  ? { A: finalByWeek[dayName].A?.length || 0, B: finalByWeek[dayName].B?.length || 0, unknown: finalByWeek[dayName].unknown?.length || 0 }
                  : null,
              }
              setLastFetchedDate((new Date()).toISOString().slice(0,10))
              setLastFetchedPayloadSummary(summary)
            } catch (e) {}
            if (j.bellTimes) setExternalBellTimes(j.bellTimes)
            if (j.weekType === 'A' || j.weekType === 'B') {
              setExternalWeekType(j.weekType)
              setCurrentWeek(j.weekType)
            } else {
              // if the API explicitly left weekType null, clear the externalWeekType
              setExternalWeekType(null)
            }
          }
        }
      } catch (e) {
        // ignore fetch errors here; provider has existing fallback logic
      } finally {
        // Allow subsequent attempts for the same date by clearing the marker
        try { lastRequestedDateRef.current = null } catch (e) {}
      }
    }
    fetchForDate()
    return () => { cancelled = true }
  }, [selectedDateObject])

  // Keep currentWeek synchronized with the server-provided externalWeekType
  useEffect(() => {
    if (externalWeekType && currentWeek !== externalWeekType) {
      try { console.log('[timetable.provider] syncing currentWeek to externalWeekType', externalWeekType) } catch (e) {}
      setCurrentWeek(externalWeekType)
    }
  }, [externalWeekType, currentWeek])

  // Wrapped setters that record a user selection timestamp so automatic
  // time-based updates can respect manual choices for a short grace period.
  const userSetSelectedDay = (day: string) => {
    lastUserSelectedRef.current = Date.now()
    setSelectedDay(day)
  }
  const userSetSelectedDateObject = (d: Date) => {
    lastUserSelectedRef.current = Date.now()
    setSelectedDateObject(d)
  }

  return (
    <TimetableContext.Provider
      value={{
        currentWeek,
        externalWeekType,
        lastFetchedDate,
        lastFetchedPayloadSummary,
        selectedDay,
        selectedDateObject, // Provide the new state
        setSelectedDay: userSetSelectedDay,
        setSelectedDateObject: userSetSelectedDateObject,
        timetableData,
        currentMomentPeriodInfo, // Provide the new state
        // Backwards-compatible alias for older components
        nextPeriodInfo: currentMomentPeriodInfo,
        bellTimes: externalBellTimes || lastSeenBellTimesRef.current || bellTimesData,
        isShowingNextDay,
        timetableSource,
        timetableByWeek: lastRecordedTimetableByWeek || externalTimetableByWeek || undefined,
        externalWeekType,
        isLoading,
        isShowingCachedWhileLoading: Boolean(isLoading && lastRecordedTimetable),
        error,
        refreshExternal,
      }}
    >
      {children}
    </TimetableContext.Provider>
  )
}

// Create a hook to use the timetable context
export function useTimetable() {
  const context = useContext(TimetableContext)
  if (context === undefined) {
    throw new Error("useTimetable must be used within a TimetableProvider")
  }
  return context
}

