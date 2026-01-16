"use client"

import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, startTransition, type ReactNode } from "react"
import { startTimer } from '@/utils/profiler2'
import { useToast } from "@/hooks/use-toast"
import { applySubstitutionsToTimetable } from "@/lib/api/data-adapters"
import { PortalScraper } from "@/lib/api/portal-scraper"
import { getTimeUntilNextPeriod, isSchoolDayOver, getNextSchoolDay, getCurrentDay, findFirstNonBreakPeriodOnDate, formatDurationShort } from "@/utils/time-utils"
import { stripLeadingCasualCode } from "@/lib/utils"

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
  // Optional fields populated during normalization
  fullTeacher?: string
  casualSurname?: string
  displayTeacher?: string
  // Subject colour (hex without # prefix, e.g., "448ae6")
  colour?: string
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
  timetableSource?: string | null // indicates where timetable data came from (e.g. 'cache' or external url)
  isLoading: boolean
  isRefreshing?: boolean
  error: string | null
  // Trigger an in-place retry (handshake + fetch) to attempt to load live timetable again
  refreshExternal?: () => Promise<void>
  // Full A/B grouped timetable when available from the server
  timetableByWeek?: Record<string, { A: Period[]; B: Period[]; unknown: Period[] }>
  externalWeekType?: "A" | "B" | null // authoritative week type reported by the server
}

// Explicit empty timetable used when the upstream API reports "no timetable".
const emptyByDay: Record<string, Period[]> = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] }

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
    { period: "End of Day", time: "15:10" },
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
    { period: "End of Day", time: "15:10" },
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
    { period: "End of Day", time: "15:10" },
  ],
}
const canonicalIndex = (label?: string) => {
  if (!label) return 999
  const s = String(label).toLowerCase()
  if (/period\s*0|^p\s*0/.test(s)) return -1
  if (/roll\s*call|homeroom|registration|wellbeing|tutorial|rc\b/.test(s)) return -0.5
  if (/period\s*1|^p\s*1|\b1\b/.test(s)) return 1
  if (/period\s*2|^p\s*2|\b2\b/.test(s)) return 2
  if (/recess|break|interval|morning break/.test(s)) return 3
  if (/period\s*3|^p\s*3|\b3\b/.test(s)) return 4
  if (/lunch|lunch\s*1|lunch1/.test(s)) return 5
  if (/lunch\s*2|lunch2/.test(s)) return 6
  if (/period\s*4|^p\s*4|\b4\b/.test(s)) return 7
  if (/period\s*5|^p\s*5|\b5\b/.test(s)) return 8
  if (/end of day|eod\b/.test(s)) return 999
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

  // Lightweight deterministic hash for JSON payloads (djb2 on stringified input)
  const computePayloadHash = (input: any) => {
    try {
      const s = typeof input === 'string' ? input : JSON.stringify(input)
      let h = 5381
      for (let i = 0; i < s.length; i++) {
        h = ((h << 5) + h) + s.charCodeAt(i)
        h = h & 0xffffffff
      }
      return String(h >>> 0)
    } catch (e) {
      return null
    }
  }



  // Explicit empty timetable used when the upstream API reports "no timetable".
  // Restored to module scope to avoid potential reference errors in minified code
  // const emptyByDay: Record<string, Period[]> = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] }

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

  // Try to extract an authoritative ISO date string from various payload locations
  const extractDateFromPayload = (payload: any): string | null => {
    try {
      if (!payload) return null
      const maybe = (p: any) => {
        if (!p) return null
        if (typeof p === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p)) return p
        if (p.date && typeof p.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.date)) return p.date
        return null
      }

    // Common locations seen in API payloads
    const paths = [
      payload.date,
      payload.day,
      payload.dayInfo && payload.dayInfo.date,
      payload.upstream && payload.upstream.day && payload.upstream.day.date,
      payload.upstream && payload.upstream.dayInfo && payload.upstream.dayInfo.date,
      payload.diagnostics && payload.diagnostics.upstream && payload.diagnostics.upstream.day && payload.diagnostics.upstream.day.date,
      payload.upstream && payload.upstream.full && payload.upstream.full.dayInfo && payload.upstream.full.dayInfo.date,
    ]

    for (const p of paths) {
      const found = maybe(p)
      if (found) return found
    }

    return null
  } catch (e) {
    return null
  }
}

// Mock data for the timetable - removed
// (Declarations for timetableWeekA/B removed as they are no longer used)


// Create the provider component
export function TimetableProvider({ children }: { children: ReactNode }) {
  const [currentWeek, setCurrentWeek] = useState<"A" | "B" | null>(null)
  // Attempt a single synchronous read of the last-persisted timetable so we
  // can synchronously show cached data (including bell times and by-week
  // groupings) and avoid a loading spinner on first render when a cache
  // exists.
  let __initialRawCache: string | null = null
  let __initialParsedCache: any = null
  try {
    if (typeof window !== 'undefined') __initialRawCache = localStorage.getItem('synchron-last-timetable')
    if (__initialRawCache) __initialParsedCache = JSON.parse(__initialRawCache)
    try { console.debug('[timetable.provider] initial raw cache present=', Boolean(__initialRawCache)) } catch (e) {}
  } catch (e) {
    __initialRawCache = null
    __initialParsedCache = null
  }
  // If the persisted last-timetable explicitly included a `forDate` field
  // capture it now so we can use it to initialise `externalTimetableDateRef`
  // later (the ref is declared further below).
  let __initialCachedForDate: string | null = null
  try {
    if (__initialParsedCache && __initialParsedCache.forDate) __initialCachedForDate = __initialParsedCache.forDate
    else {
      try {
        const maybe = extractDateFromPayload(__initialParsedCache)
        if (maybe) __initialCachedForDate = maybe
      } catch (e) {}
    }
  } catch (e) {}
  // Look for any previously-processed payloads cached under
  // `synchron-processed-<hash>` and prefer the most-recent one for
  // instant hydration. This allows us to load a fully-applied timetable
  // (with substitutions/room-changes/bellTimes) synchronously on start.
  let __initialProcessedCache: any = null
  try {
    if (typeof window !== 'undefined') {
      try {
        const keys = Object.keys(localStorage || {}).filter(k => k && k.startsWith('synchron-processed-'))
        let best: { savedAt: number; key: string; parsed: any } | null = null
        for (const k of keys) {
          try {
            const raw = localStorage.getItem(k)
            if (!raw) continue
            const parsed = JSON.parse(raw)
            const when = parsed && (parsed.savedAt || parsed.ts || parsed.savedAt === 0) ? Number(parsed.savedAt || parsed.ts || 0) : 0
            if (!best || when > (best.savedAt || 0)) best = { savedAt: when, key: k, parsed }
          } catch (e) { /* ignore parse errors */ }
        }
        if (best && best.parsed) __initialProcessedCache = best.parsed
      } catch (e) {}
    }
  } catch (e) {}
  const __extractMapFromCache = (raw: any): Record<string, Period[]> | null => {
    try {
      if (!raw) return null
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (!parsed) return null
      const maybe = parsed.timetable && typeof parsed.timetable === 'object' ? parsed.timetable : parsed
      if (!maybe || typeof maybe !== 'object') return null
      const keys = Object.keys(maybe)
      const daySet = new Set(['monday','tuesday','wednesday','thursday','friday'])
      const lcKeys = keys.map(k => String(k).toLowerCase())
      const hasDayKeys = lcKeys.some(k => daySet.has(k))
      if (hasDayKeys) return maybe as Record<string, Period[]>
    } catch (e) {}
    return null
  }
  let __initialExternalTimetable = __extractMapFromCache(__initialParsedCache)
  // If we found a processed cache, extract its timetable map synchronously
  try {
    if (!__initialExternalTimetable && __initialProcessedCache && __initialProcessedCache.timetable) {
      try {
        const maybe = __initialProcessedCache.timetable
        const map = __extractMapFromCache(maybe)
        if (map) __initialExternalTimetable = map
      } catch (e) {}
    }
  } catch (e) {}
  const __initialExternalTimetableByWeek = ((): Record<string, { A: Period[]; B: Period[]; unknown: Period[] } | null> | null => {
    try {
      // Prefer a processed cache payload when available
      const src = __initialProcessedCache || __initialParsedCache
      if (!src) return null
      if (src.timetableByWeek && typeof src.timetableByWeek === 'object') return src.timetableByWeek
    } catch (e) {}
    return null
  })()
  const __initialExternalBellTimes = ((): Record<string, { period: string; time: string }[]> | null => {
    try {
      const src = __initialProcessedCache || __initialParsedCache
      if (!src) return null
      if (src.bellTimes && typeof src.bellTimes === 'object') return src.bellTimes
      // Also support a dedicated bell-times cache key for faster hydrate
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem('synchron-last-belltimes')
          if (raw) {
            const parsed = JSON.parse(raw)
            if (parsed && typeof parsed === 'object') return parsed
          }
        } catch (e) {
          // ignore parse errors
        }
      }
    } catch (e) {}
    return null
  })()
  // Try to hydrate previously-cached substitutions and break-layouts
  const __initialCachedSubs = ((): any[] | null => {
    try {
      if (typeof window === 'undefined') return null
      const raw = localStorage.getItem('synchron-last-subs')
      return raw ? JSON.parse(raw) : null
    } catch (e) { return null }
  })()
  // Hydrate authoritative variations from localStorage
  const __initialAuthoritativeVariations = ((): Map<string, Record<string, any[]>> => {
    try {
      if (typeof window === 'undefined') return new Map()
      const raw = localStorage.getItem('synchron-authoritative-variations')
      if (!raw) { try { console.debug('[timetable.provider] no authoritative variations in localStorage') } catch (e) {} return new Map() }
      const parsed = JSON.parse(raw)
      // Convert from object to Map
      const map = new Map<string, Record<string, any[]>>()
      for (const [key, value] of Object.entries(parsed)) {
        map.set(key, value as Record<string, any[]>)
      }
      try { console.debug('[timetable.provider] hydrated authoritative variations from localStorage, dates:', Array.from(map.keys())) } catch (e) {}
      return map
    } catch (e) { return new Map() }
  })()
  const __initialBreakLayouts = ((): Record<string, Period[]> | null => {
    try {
      if (typeof window === 'undefined') return null
      const raw = localStorage.getItem('synchron-break-layouts')
      return raw ? JSON.parse(raw) : null
    } catch (e) { return null }
  })()
  const __initialTimetableSource = ((): string | null => {
    try { return __initialParsedCache?.source ?? null } catch (e) { return null }
  })()
  const __initialWeekType = ((): "A" | "B" | null => {
    try { const src = __initialProcessedCache || __initialParsedCache; const w = src?.weekType; return (w === 'A' || w === 'B') ? w : null } catch (e) { return null }
  })()
  const [selectedDay, setSelectedDay] = useState<string>("") // Day for main timetable
  const [selectedDateObject, setSelectedDateObject] = useState<Date>(new Date()) // Date object for selectedDay
  // Track the currently selected date as a ref so interval callbacks can access the latest value
  // without stale closure issues - MUST be declared before first useEffect that references it
  const selectedDateObjectRef = useRef<Date | null>(null)
  // Keep selectedDateObjectRef in sync with state so interval callbacks can access the latest value
  useEffect(() => {
    selectedDateObjectRef.current = selectedDateObject
  }, [selectedDateObject])
  
  // Clear substitution state when date changes so we re-fetch for the new date
  useEffect(() => {
    subsAppliedRef.current = null
    lastSubsAttemptRef.current = null
  }, [selectedDateObject])
  
  const [isShowingNextDay, setIsShowingNextDay] = useState(false) // For main timetable
  // Track when the user manually selected a date so we don't auto-override it
  const lastUserSelectedRef = useRef<number | null>(null)
  const loadTimingStartedRef = useRef(false)
  const loadProfilerRef = useRef<any>(null)
  const _initialMomentInfo = (() => {
    try {
      // Only initialise from a cached timetable when the client is offline
      // to avoid briefly showing cached classes on a holiday before the
      // calendar check completes.
      const isOffline = (typeof navigator !== 'undefined') ? (navigator.onLine === false) : false
      if (!isOffline) return { nextPeriod: null, timeUntil: "", isCurrentlyInClass: false, currentPeriod: null }
      if (!__initialExternalTimetable) return { nextPeriod: null, timeUntil: "", isCurrentlyInClass: false, currentPeriod: null }
      const today = getCurrentDay()
      const todays = (__initialExternalTimetable as any)[today] || []
      try {
        return getTimeUntilNextPeriod(todays as any)
      } catch (e) {
        return { nextPeriod: null, timeUntil: "", isCurrentlyInClass: false, currentPeriod: null }
      }
    } catch (e) {
      return { nextPeriod: null, timeUntil: "", isCurrentlyInClass: false, currentPeriod: null }
    }
  })()

  const [currentMomentPeriodInfo, setCurrentMomentPeriodInfo] = useState(() => _initialMomentInfo)

  // Initialize currentMomentPeriodInfo from any cached timetable on mount
  // so header cards (Home/CombinedStatus) don't flash before the first tick.
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      // Avoid hydrating header cards from cache while online; only use
      // cached timetable when offline so we don't flash classes on holiday
      const isOffline = (typeof navigator !== 'undefined') ? (navigator.onLine === false) : false
      if (!isOffline) return
      const map = __initialExternalTimetable || null
      if (!map) return
      try {
        const today = getCurrentDay()
        const todays = map[today] || []
        const info = getTimeUntilNextPeriod(todays as any)
        setCurrentMomentPeriodInfo(info as any)
      } catch (e) {
        // ignore
      }
    } catch (e) {}
  }, [])

  // Defer applying the cached timetable until after a quick calendar check so
  // we don't show stale cached periods on a date that the official calendar
  // marks as a holiday. The cached payload is still available in
  // `__initialParsedCache`/`__initialProcessedCache` for hydration after the
  // calendar check completes.
  const [externalTimetable, setExternalTimetable] = useState<Record<string, Period[]> | null>(null)
  const [lastRecordedTimetable, setLastRecordedTimetable] = useState<Record<string, Period[]> | null>(externalTimetable)
  const [timetableSource, setTimetableSource] = useState<string | null>(() => {
    try {
      if (__initialTimetableSource) return __initialTimetableSource
      if (__initialExternalTimetable) return 'cache'
    } catch (e) {}
    return null
  })
  const [externalTimetableByWeek, setExternalTimetableByWeek] = useState<Record<string, { A: Period[]; B: Period[]; unknown: Period[] }> | null>(() => {
    try { return __initialExternalTimetableByWeek || null } catch (e) { return null }
  })
  const [lastRecordedTimetableByWeek, setLastRecordedTimetableByWeek] = useState<Record<string, { A: Period[]; B: Period[]; unknown: Period[] }> | null>(externalTimetableByWeek)
  // Record the authoritative week type provided by the server (A/B) when available
  const [externalWeekType, setExternalWeekType] = useState<"A" | "B" | null>(() => __initialWeekType)
  // Debug: record last fetched date and a small payload summary for diagnostics
  const [lastFetchedDate, setLastFetchedDate] = useState<string | null>(null)
  const [lastFetchedPayloadSummary, setLastFetchedPayloadSummary] = useState<any | null>(null)
  const [selectedDateIsHoliday, setSelectedDateIsHoliday] = useState<boolean>(false)
  // Whether we've applied the locally-cached timetable after completing
  // the initial calendar check. Prevents briefly showing cached classes
  // before we've confirmed the date is not a holiday.
  const [cacheHydrated, setCacheHydrated] = useState<boolean>(false)
  const [initialCalendarChecked, setInitialCalendarChecked] = useState<boolean>(false)
  const [selectedDateCalendarChecked, setSelectedDateCalendarChecked] = useState<boolean>(false)
  const [externalBellTimes, setExternalBellTimes] = useState<Record<string, { period: string; time: string }[]> | null>(() => __initialExternalBellTimes)
  const lastSeenBellTimesRef = useRef<Record<string, { period: string; time: string }[]> | null>(null)
  const lastSeenBellTsRef = useRef<number | null>(null)

  // Try to parse a fetch Response for bell times and apply them to state.
  const extractBellTimesFromResponse = async (res: Response | null) => {
    if (!res) return
    try {
      const ctype = res.headers.get('content-type') || ''
      if (!ctype.includes('application/json')) return
      // clone/parse safely
      let j: any = null
      try { j = await res.clone().json() } catch (e) { return }
      if (!j) return
      try {
        const computed = buildBellTimesFromPayload(j)
        const finalBellTimes: Record<string, any[]> = { 'Mon/Tues': [], 'Wed/Thurs': [], 'Fri': [] }
        const src = j.bellTimes || {}
        for (const k of ['Mon/Tues', 'Wed/Thurs', 'Fri']) {
          if (src[k] && Array.isArray(src[k]) && src[k].length) finalBellTimes[k] = src[k]
          else if (computed[k] && Array.isArray(computed[k]) && computed[k].length) finalBellTimes[k] = computed[k]
          else if (lastSeenBellTimesRef.current && lastSeenBellTimesRef.current[k] && lastSeenBellTimesRef.current[k].length) finalBellTimes[k] = lastSeenBellTimesRef.current[k]
          else finalBellTimes[k] = []
        }
        const hasAny = Object.values(finalBellTimes).some((arr) => Array.isArray(arr) && arr.length > 0)
        if (hasAny) {
          try { console.log('[timetable.provider] extracted bellTimes from response (status', res.status, ')', finalBellTimes) } catch (e) {}
          try { console.debug('[timetable.provider] setExternalBellTimes (from response)', { status: res.status, finalBellTimes }) } catch (e) {}
          setExternalBellTimes(finalBellTimes)
          lastSeenBellTimesRef.current = finalBellTimes
          lastSeenBellTsRef.current = Date.now()
        }
      } catch (e) {
        // ignore
      }
    } catch (e) {
      // ignore
    }
  }
  // Track when authoritative bell times have been set from /api/timetable
  // to prevent fallback paths from overwriting them with generic/stale data
  const authoritativeBellsDateRef = useRef<string | null>(null)
  // Track authoritative variation data (subs/room changes) for MULTIPLE dates to prevent
  // fallback paths from overwriting date-specific variations with stale data.
  // Key is ISO date string (YYYY-MM-DD), value is variations for that date.
  const authoritativeVariationsRef = useRef<Map<string, Record<string, { period: string; isSubstitute?: boolean; isRoomChange?: boolean; displayRoom?: string; displayTeacher?: string; casualSurname?: string; originalTeacher?: string; originalRoom?: string }[]>>>(__initialAuthoritativeVariations)
  
  // CRITICAL HELPER: Strip all variations from timetableByWeek before setting it
  // The server includes substitutions in the grouped structure, but we only want
  // date-specific variations in the flat timetable to prevent carry-over between weeks
  const cleanTimetableByWeek = (data: any) => {
    if (!data || typeof data !== 'object') return data
    const cleaned: Record<string, { A: Period[]; B: Period[]; unknown: Period[] }> = {}
    for (const day in data) {
      cleaned[day] = {
        A: (data[day]?.A || []).map((p: any) => ({ ...p, isSubstitute: false, isRoomChange: false })),
        B: (data[day]?.B || []).map((p: any) => ({ ...p, isSubstitute: false, isRoomChange: false })),
        unknown: (data[day]?.unknown || []).map((p: any) => ({ ...p, isSubstitute: false, isRoomChange: false }))
      }
    }
    return cleaned
  }
  
  // Debug: log authoritative variations presence on mount and when selected date changes
  useEffect(() => {
    try {
      const map = authoritativeVariationsRef.current
      const keys = Array.from(map.keys())
      try { console.debug('[timetable.provider] authoritativeVariations keys count=', keys.length, 'keys=', keys.slice(0,10)) } catch (e) {}
      const selIso = selectedDateObject ? selectedDateObject.toISOString().slice(0,10) : null
      if (selIso) {
        try { console.debug('[timetable.provider] selectedIso=', selIso, 'hasAuthVars=', map.has(selIso), 'authVarsForSelected=', map.get(selIso)) } catch (e) {}
      }
    } catch (e) {}
  }, [selectedDateObject])

  useEffect(() => {
    try { console.debug('[timetable.provider] selectedDateCalendarChecked=', selectedDateCalendarChecked, 'selectedDateIsHoliday=', selectedDateIsHoliday) } catch (e) {}
  }, [selectedDateCalendarChecked, selectedDateIsHoliday])

  // Watch for selected date changes and consult the calendar API to
  // determine whether the chosen date is a holiday. If the calendar
  // reports a holiday for the selected date, ensure the UI does not
  // display classes by setting the external timetable to an explicit
  // empty map and marking the source accordingly.
  useEffect(() => {
    if (typeof window === 'undefined') return
    let cancelled = false
    ;(async () => {
      // Mark that we're about to check the calendar for the newly-selected date
      try { setSelectedDateCalendarChecked(false) } catch (e) {}
      try {
        const sel = selectedDateObject
        if (!sel) return
        const ds = sel.toISOString().slice(0,10)
        try {
          const res = await fetch(`/api/calendar?endpoint=days&from=${encodeURIComponent(ds)}&to=${encodeURIComponent(ds)}`, { credentials: 'include' })
          const ctype = res.headers.get('content-type') || ''
          if (res.ok && ctype.includes('application/json')) {
            const calJson = await res.json()
            let dayInfo: any = null
            if (Array.isArray(calJson) && calJson.length) dayInfo = calJson[0]
            else if (calJson && typeof calJson === 'object' && calJson[ds]) dayInfo = calJson[ds]
            else if (calJson && typeof calJson === 'object') {
              for (const k of Object.keys(calJson)) {
                const v = calJson[k]
                if (v && (v.date === ds || String(k) === ds)) { dayInfo = v; break }
              }
            }

            let isHoliday = Boolean(
              dayInfo && (
                dayInfo.isHoliday === true ||
                dayInfo.holiday === true ||
                String(dayInfo.is_school_day).toLowerCase() === 'false' ||
                String(dayInfo.status || '').toLowerCase().includes('holiday') ||
                String(dayInfo.type || '').toLowerCase().includes('holiday') ||
                String(dayInfo.dayType || '').toLowerCase().includes('holiday')
              )
            )

            // If calendar/days didn't explicitly mark this date as a holiday,
            // consult the terms endpoint for public holidays/development days
            // as an additional authoritative source.
            if (!isHoliday) {
              try {
                const year = ds.slice(0,4)
                const tRes = await fetch(`/api/calendar?endpoint=terms&year=${encodeURIComponent(year)}`, { credentials: 'include' })
                const tctype = tRes.headers.get('content-type') || ''
                if (tRes.ok && tctype.includes('application/json')) {
                  const tJson = await tRes.json()
                  const scanForDate = (obj: any): boolean => {
                    try {
                      if (!obj) return false
                      if (Array.isArray(obj)) {
                        for (const it of obj) {
                          if (scanForDate(it)) return true
                        }
                        return false
                      }
                      if (typeof obj === 'object') {
                        // common fields: publicHolidays, publicholidays, developmentDays
                        for (const k of Object.keys(obj)) {
                          const v = obj[k]
                          if (!v) continue
                          if (typeof v === 'string' && String(v).trim() === ds) return true
                          if (typeof v === 'object') {
                            // If object has a `date` property
                            if (v.date && String(v.date).slice(0,10) === ds) return true
                            if (Array.isArray(v)) {
                              for (const item of v) {
                                if (scanForDate(item)) return true
                              }
                            } else if (typeof v === 'object') {
                              // check nested
                              if (scanForDate(v)) return true
                            }
                          }
                        }
                        return false
                      }
                      return false
                    } catch (e) { return false }
                  }
                  if (scanForDate(tJson.publicHolidays || tJson.publicholidays || tJson) || scanForDate(tJson.developmentDays || tJson.developmentdays || tJson)) {
                    isHoliday = true
                  }
                }
              } catch (e) {
                // ignore terms fetch errors
              }
            }

            if (cancelled) return
            setSelectedDateIsHoliday(isHoliday)
            try { holidayDateRef.current = isHoliday } catch (e) {}
            if (isHoliday) {
              try { console.debug('[timetable.provider] selected date is holiday according to calendar/terms:', ds) } catch (e) {}
              
              // We no longer clear the timetable on holidays, allowing the term
              // timetable to show even when there are no classes.
              
              setTimetableSource('calendar-holiday')
              setExternalWeekType(null)
              try { setLastFetchedDate(ds); setLastFetchedPayloadSummary({ holiday: true, source: 'calendar/terms' }) } catch (e) {}
            }
          }
        } catch (e) {
          // ignore calendar fetch errors; do not alter holiday flag
        }
      } catch (e) {}
    })()
    return () => { cancelled = true }
  }, [selectedDateObject])
  // Track the date that the current externalTimetable data is actually FOR (not the selected date)
  // This is critical for correctly associating variations with the right date when capturing them
  const externalTimetableDateRef = useRef<string | null>(null)
  // If we discovered a cached-for-date at startup, seed the ref so the
  // hydration gating logic can make use of it immediately.
  try { if (__initialCachedForDate) externalTimetableDateRef.current = __initialCachedForDate } catch (e) {}
  // selectedDateObjectRef is declared earlier in the component (before useEffect references)
  const cachedSubsRef = useRef<any[] | null>(__initialCachedSubs)
  const cachedBreakLayoutsRef = useRef<Record<string, Period[]> | null>(__initialBreakLayouts)
  const lastRefreshTsRef = useRef<number | null>(null)
  const lastFocusTsRef = useRef<number | null>(null)
  const holidayDateRef = useRef<boolean>(false)
  // Track whether substitutions have been applied - declared here before first usage
  const subsAppliedRef = useRef<number | null>((__initialCachedSubs && __initialExternalTimetable && Array.isArray(__initialCachedSubs) && __initialCachedSubs.length) ? Date.now() : null)

  // Aggressive background refresh tuning
  // NOTE: reduced intervals to make visible-refresh more responsive.
  // MIN_REFRESH_MS is the minimum time between *non-forced* refreshes.
  // Reduce background refresh aggressiveness to avoid frequent network calls
  // while keeping reasonably fresh data when visible.
  const MIN_REFRESH_MS = 30 * 1000 // never refresh faster than ~30s
  const VISIBLE_REFRESH_MS = 60 * 1000 // target interval while visible (~60s)
  const HIDDEN_REFRESH_MS = 5 * 60 * 1000 // target interval while hidden (~5m)
  // Hydrate last-seen bell refs from the initial cache so components that
  // read `lastSeenBellTimesRef` synchronously can access bell buckets.
  try {
    if (typeof window !== 'undefined' && __initialExternalBellTimes) {
      lastSeenBellTimesRef.current = __initialExternalBellTimes
      lastSeenBellTsRef.current = __initialParsedCache?.savedAt ? Date.parse(__initialParsedCache.savedAt) : Date.now()
    }
  } catch (e) {}

  // If we have locally cached substitutions and no fresh substitution run
  // has occurred yet, we will use them as a best-effort while the live
  // refresh completes in the background.
  try {
    if (typeof window !== 'undefined' && __initialCachedSubs && !subsAppliedRef?.current) {
      cachedSubsRef.current = __initialCachedSubs
    }
  } catch (e) {}
  // If we have an initial cached timetable, avoid showing the global loading
  // spinner ΓÇö show cached data immediately while we refresh in the
  // background.
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    try {
      return !Boolean(__initialExternalTimetable)
    } catch (e) {
      return true
    }
  })
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  // Debug hooks: when sessionStorage['synchron:debug-refresh'] === 'true',
  // install temporary capture/bubble listeners during refresh to diagnose
  // click/pointer swallowing that may occur while a background refresh runs.
  const refreshDebugHandlersRef = useRef<{ capture?: any; bubble?: any } | null>(null)
  const { toast } = useToast()
  const [error, setError] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [reauthRequired, setReauthRequired] = useState<boolean>(false)
  const [lastUserSelectedAt, setLastUserSelectedAt] = useState<number | null>(null)

  // Start a simple mount->ready timer so we can measure app load time
  useEffect(() => {
    if (typeof window === 'undefined') return
    try { loadProfilerRef.current = startTimer('[timetable] mount->ready') } catch (e) {}
    loadTimingStartedRef.current = true
  }, [])

  // On mount: run a quick calendar check for the currently-selected date
  // and then apply any cached timetable only if the calendar does not mark
  // the date as a holiday. This prevents stale cached timetables from
  // appearing on holiday dates before background refreshes run.
  useEffect(() => {
    if (typeof window === 'undefined') return
    let cancelled = false
    void (async () => {
      try {
        const ds = (selectedDateObject || new Date()).toISOString().slice(0,10)
        let calendarCheckSucceeded = false
        try {
          const calRes = await fetch(`/api/calendar?endpoint=days&from=${encodeURIComponent(ds)}&to=${encodeURIComponent(ds)}`, { credentials: 'include' })
          const cctype = calRes.headers.get('content-type') || ''
          if (calRes.ok && cctype.includes('application/json')) {
            const calJson = await calRes.json()
            let dayInfo: any = null
            if (Array.isArray(calJson) && calJson.length) dayInfo = calJson[0]
            else if (calJson && typeof calJson === 'object' && calJson[ds]) dayInfo = calJson[ds]
            else if (calJson && typeof calJson === 'object') {
              for (const k of Object.keys(calJson)) {
                const v = calJson[k]
                if (v && (v.date === ds || String(k) === ds)) { dayInfo = v; break }
              }
            }
            let isHoliday = Boolean(
              dayInfo && (
                dayInfo.isHoliday === true ||
                dayInfo.holiday === true ||
                String(dayInfo.is_school_day).toLowerCase() === 'false' ||
                String(dayInfo.status || '').toLowerCase().includes('holiday') ||
                String(dayInfo.type || '').toLowerCase().includes('holiday') ||
                String(dayInfo.dayType || '').toLowerCase().includes('holiday')
              )
            )

            // If days endpoint didn't mark holiday, consult terms endpoint
            // for authoritative public holidays/development days (same logic
            // used in per-selected-date effect).
            if (!isHoliday) {
              try {
                const year = ds.slice(0,4)
                const tRes = await fetch(`/api/calendar?endpoint=terms&year=${encodeURIComponent(year)}`, { credentials: 'include' })
                const tctype = tRes.headers.get('content-type') || ''
                if (tRes.ok && tctype.includes('application/json')) {
                  const tJson = await tRes.json()
                  const scanForDate = (obj: any): boolean => {
                    try {
                      if (!obj) return false
                      if (Array.isArray(obj)) {
                        for (const it of obj) {
                          if (scanForDate(it)) return true
                        }
                        return false
                      }
                      if (typeof obj === 'object') {
                        for (const k of Object.keys(obj)) {
                          const v = obj[k]
                          if (!v) continue
                          if (typeof v === 'string' && String(v).trim() === ds) return true
                          if (typeof v === 'object') {
                            if (v.date && String(v.date).slice(0,10) === ds) return true
                            if (Array.isArray(v)) {
                              for (const item of v) {
                                if (scanForDate(item)) return true
                              }
                            } else if (typeof v === 'object') {
                              if (scanForDate(v)) return true
                            }
                          }
                        }
                        return false
                      }
                      return false
                    } catch (e) { return false }
                  }
                  if (scanForDate(tJson.publicHolidays || tJson.publicholidays || tJson) || scanForDate(tJson.developmentDays || tJson.developmentdays || tJson)) {
                    isHoliday = true
                  }
                }
              } catch (e) {
                // ignore terms fetch errors
              }
            }

            if (isHoliday) {
              holidayDateRef.current = true
              try { setSelectedDateIsHoliday(true) } catch (e) {}
              // Do NOT clear caches or set timetable to empty on holidays.
              // This allows the term timetable (cached) to remain visible.
              // Mark that the per-selected-date calendar check has completed
              try { setSelectedDateCalendarChecked(true) } catch (e) {}
              return
            }

            // Mark that the per-selected-date calendar check completed for non-holiday
            try { calendarCheckSucceeded = true } catch (e) {}
            try { setSelectedDateCalendarChecked(true) } catch (e) {}
          }
        } catch (e) {
          // calendar check failed - do NOT fall back to cached data when online
          try { console.debug('[timetable.provider] calendar check failed during mount; will not hydrate cache while online', e) } catch (err) {}
        }

        // If not a holiday, apply cached processed payload (if any) quickly
        try {
          const isOffline = (typeof navigator !== 'undefined') ? (navigator.onLine === false) : false
          // If calendar check did not complete successfully and the client
          // is online, skip hydrating the cache now to avoid flashing stale
          // timetable data before holiday detection completes.
          if (!calendarCheckSucceeded && !isOffline) {
            try { console.debug('[timetable.provider] skipping cache hydration because calendar check did not complete and client is online') } catch (e) {}
            return
          }
          const src = __initialProcessedCache || __initialParsedCache
          let map: Record<string, Period[]> | null = null
          if (src && src.timetable) map = __extractMapFromCache(src.timetable) || __extractMapFromCache(src)
          if (!map && __initialExternalTimetable) map = __initialExternalTimetable
          if (map && !cancelled) {
            // apply cached subs if present
              try {
                const cleaned: Record<string, Period[]> = {}
                for (const day of Object.keys(map)) {
                  cleaned[day] = (map[day] || []).map((p) => {
                    const item: any = { ...(p as any) }
                    const candidateDest = item.toRoom || item.roomTo || item.room_to || item.newRoom
                    if (candidateDest && String(candidateDest).trim()) {
                      const candStr = String(candidateDest).trim()
                      const roomStr = String(item.room || '').trim()
                      if (candStr.toLowerCase() !== roomStr.toLowerCase()) { item.displayRoom = candStr; item.isRoomChange = true }
                    }
                    try { const casual = item.casualSurname || undefined; const candidate = item.fullTeacher || item.teacher || undefined; const dt = casual ? stripLeadingCasualCode(String(casual)) : stripLeadingCasualCode(candidate as any); item.displayTeacher = dt } catch (e) {}
                    if (!candidateDest && (item as any).isRoomChange && !(item as any).displayRoom) delete (item as any).isRoomChange
                    return item
                  })
                }
                const cachedSubs = __initialCachedSubs
                // To avoid a visual "flash" where cached substitutions briefly
                // appear and are then removed by the authoritative refresh, do
                // not apply cached substitutions during initial synchronous
                // hydration when the client is online. If the client is offline
                // (no network), apply cached subs so the user still sees latest
                // known variations.
                const isOffline = (typeof navigator !== 'undefined') ? (navigator.onLine === false) : false
                const shouldApplyCachedSubs = isOffline && (cachedSubs && Array.isArray(cachedSubs) && cachedSubs.length)
                const final = shouldApplyCachedSubs ? applySubstitutionsToTimetable(cleaned, cachedSubs, { debug: false }) : cleaned
                // If the cached payload includes an authoritative date, record
                // which date the cached timetable is FOR so downstream guards
                // can withhold it when the user has selected a different date
                // and the per-date calendar check has not completed.
                try {
                  const srcForDate = __initialProcessedCache || __initialParsedCache || null
                  let payloadDate: string | null = null
                  try {
                    if (srcForDate) payloadDate = extractDateFromPayload(srcForDate) || null
                    // Fallback: if savedAt is present (number or ISO string), derive date
                    if (!payloadDate && srcForDate && srcForDate.savedAt) {
                      const saved = srcForDate.savedAt
                      if (typeof saved === 'number') payloadDate = (new Date(saved)).toISOString().slice(0,10)
                      else if (typeof saved === 'string' && saved.length >= 10) payloadDate = saved.slice(0,10)
                    }
                  } catch (e) {
                    payloadDate = null
                  }
                  if (payloadDate) {
                    externalTimetableDateRef.current = payloadDate
                    try { console.debug('[timetable.provider] hydrate: externalTimetableDateRef set from cache', payloadDate) } catch (e) {}
                  } else {
                    try { console.debug('[timetable.provider] hydrate: no date found in cached payload') } catch (e) {}
                  }
                } catch (e) {}

                // Conservative guard: if calendar checks haven't completed,
                // withhold applying cached payloads to avoid flashing stale
                // classes on potentially-holiday dates. Require both the
                // per-selected-date check and the initial mount check to have
                // completed, unless the client is offline.
                try {
                  const nowTs = (new Date()).toISOString()
                  const selIso = selectedDateObject ? selectedDateObject.toISOString().slice(0,10) : null
                  const payloadDate = externalTimetableDateRef.current
                  const isOffline = (typeof navigator !== 'undefined') ? (navigator.onLine === false) : false

                  // Require the per-selected-date calendar check to complete
                  // before applying cached payloads when online. This is a
                  // stricter guard to prevent any flash of classes on dates
                  // that may be holidays.
                  if (!isOffline && !selectedDateCalendarChecked) {
                    // Allow cached payloads that are explicitly FOR the
                    // currently-selected date to be applied immediately
                    // (useful for past dates), but withhold otherwise until
                    // the per-selected-date calendar check completes.
                    if (!(payloadDate && selIso && payloadDate === selIso)) {
                      try {
                        console.debug('[timetable.provider]', nowTs, 'withholding cache apply: selectedDateCalendarChecked=', selectedDateCalendarChecked, 'payloadDate=', payloadDate, 'selected=', selIso)
                      } catch (e) {}
                      return
                    } else {
                      try { console.debug('[timetable.provider]', nowTs, 'allowing cache apply because payload.forDate matches selected date', payloadDate) } catch (e) {}
                    }
                  }

                  // If cached payload is explicitly for a different date than
                  // the selected date, withhold when calendar check is pending.
                  if (!isOffline && payloadDate && selIso && payloadDate !== selIso && !selectedDateCalendarChecked) {
                    try { console.debug('[timetable.provider]', nowTs, 'skipping cache hydration: cached payload date', payloadDate, 'does not match selected', selIso, 'and per-date calendar check pending') } catch (e) {}
                    return
                  }
                } catch (e) {}

                try {
                  const nowTs = (new Date()).toISOString()
                  console.debug('[timetable.provider]', nowTs, 'applying cached timetable (final) — source=cache, payloadDate=', externalTimetableDateRef.current)
                } catch (e) {}

                setExternalTimetable(final)
                try { setCacheHydrated(true) } catch (e) {}
                setExternalTimetableByWeek(cleanTimetableByWeek(__initialExternalTimetableByWeek) || null)
                try { console.debug('[timetable.provider] hydrate: setExternalBellTimes (initial cache)', __initialExternalBellTimes) } catch (e) {}
                setExternalBellTimes(__initialExternalBellTimes || null)
                setTimetableSource(__initialTimetableSource || 'cache')
                setLastRecordedTimetable(final)
              } catch (e) {
              // apply raw map if processing fails
              if (!cancelled && map) {
                setExternalTimetable(map)
                try { setCacheHydrated(true) } catch (e) {}
                setTimetableSource(__initialTimetableSource || 'cache')
                setLastRecordedTimetable(map)
              }
            }
          }
        } catch (e) {}
      } catch (e) {}
      finally {
        try { if (!cancelled) try { setInitialCalendarChecked(true) } catch (e) {} } catch (e) {}
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Persist the last successful external timetable to localStorage so the
  // app can immediately show the most-recent real data after a reload.
  useEffect(() => {
    try {
      if (externalTimetable && timetableSource) {
        const payload = {
          timetable: externalTimetable,
          timetableByWeek: externalTimetableByWeek || null,
          bellTimes: externalBellTimes || null,
          source: timetableSource,
          weekType: externalWeekType || null,
          savedAt: (new Date()).toISOString(),
          // Record which date this external timetable payload is FOR so
          // startup hydration logic can decide whether to apply cached
          // data when the user has selected a different date.
          forDate: externalTimetableDateRef.current || lastFetchedDate || null,
        }
        try {
          localStorage.setItem('synchron-last-timetable', JSON.stringify(payload))
          try { console.debug('[timetable.provider] wrote synchron-last-timetable (externalTimetable payload)', { forDate: payload.forDate, savedAt: payload.savedAt }) } catch (e) {}
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

    // Prefer the live external timetable when available. The cached
    // `lastRecordedTimetable` is only a fallback for fast initial rendering
    // and should not be used until we've completed the initial calendar
    // check; this prevents a brief flash of cached classes on holiday dates.
    // If we haven't completed the initial calendar check and the client
    // is online, do NOT show cached/initial data (this prevents briefly
    // flashing stale classes on holiday dates). Allow cached data when
    // offline or after we've explicitly hydrated cache.
    try {
      const isOffline = (typeof navigator !== 'undefined') ? (navigator.onLine === false) : false
      const hasCached = Boolean(lastRecordedTimetable || typeof __initialExternalTimetable !== 'undefined' && __initialExternalTimetable)
      
      const selectedIso = selectedDateObject ? selectedDateObject.toISOString().slice(0,10) : null
      const externalDateRefVal = externalTimetableDateRef.current

      // If the currently-held external timetable is for a different date
      // than the one the user just selected, avoid showing it (withhold it)
      // until we've completed the calendar check for the new date and/or
      // a fresh fetch has completed. This prevents stale variations/rows 
      // from flashing briefly before disappearing.
      const isDateMismatch = Boolean(selectedIso && externalDateRefVal && selectedIso !== externalDateRefVal)
      const isLoadingNewDate = Boolean(!selectedDateCalendarChecked && !isOffline)
      
      // CRITICAL: We only withhold if we are NOT on a holiday, because on holidays
      // we usually WANT to see the base cycle/term timetable even if the
      // server only returned an empty "daily" response.
      if (isDateMismatch && isLoadingNewDate && !selectedDateIsHoliday) {
        try { console.debug('[timetable.provider] withholding stale timetable for different date:', externalDateRefVal, 'vs selected:', selectedIso) } catch (e) {}
        // By returning early with empty data, we force the UI to show its
        // loading state instead of old variations.
        // return { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] }
      }
    } catch (e) {}

    // Prefer the live external timetable when available. Fall back to cached.
    // Simple approach: Always use data immediately for instant display
    // The API already applies variations correctly, so just use whatever we have
    const useExternalTimetable = externalTimetable ?? lastRecordedTimetable
    const useExternalTimetableByWeek = externalTimetableByWeek ?? lastRecordedTimetableByWeek
    
    // Simpler bell-times fallback: prefer API-provided `externalBellTimes`,
    // otherwise fall back to the last-seen cached bell times.
    const useExternalBellTimes = externalBellTimes || lastSeenBellTimesRef.current

    // Cleanup helper: previously removed roll-call entries and orphaned period
    // '0' placeholders, but user wants Period 0, Roll Call, and End of Day to
    // show. Now we keep all entries and only normalize labels.
    const normalizePeriodLabel = (p?: string) => String(p || '').trim().toLowerCase()
    const isRollCallEntry = (p: any) => {
      const subj = String(p?.subject || '').toLowerCase()
      const per = normalizePeriodLabel(p?.period)
      return subj.includes('roll call') || subj === 'rollcall' || per === 'rc' || subj === 'rc' || subj.includes('roll')
    }
    const cleanupMap = (m: Record<string, Period[]>) => {
      // No longer filter out roll call or period 0 - user wants them visible
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
            // NOTE: Do NOT include `.to` here - that field is commonly used for
            // end times (e.g., { from: "9:00", to: "10:05" }), not room destinations.
            const candidate = (p as any).toRoom || (p as any).roomTo || (p as any)["room_to"] || (p as any).newRoom || undefined
            // Only treat as a change when a non-empty candidate exists and the
            // normalized value differs from the scheduled room. This avoids
            // false positives caused by casing or surrounding whitespace.
            if (candidate && String(candidate).trim()) {
              const candStr = String(candidate).trim()
              const roomStr = String(p.room || '').trim()
              if (candStr.toLowerCase() !== roomStr.toLowerCase()) {
                // Do not mutate `room` coming from the upstream JSON. Use a
                // non-destructive `displayRoom` field which the UI will
                // prefer when rendering. Keep `isRoomChange` to signal
                // that the displayed destination differs from the schedule.
                return { ...p, displayRoom: candStr, isRoomChange: true }
              }
            }

            // Defensive: clear any stale `isRoomChange` flag only when there
            // was no explicit destination provided on the incoming period
            // and there is no `displayRoom` already present. We must not
            // remove a `displayRoom` that was applied earlier by
            // `applySubstitutionsToTimetable` or other normalization logic.
            if (!(p as any).toRoom && !(p as any).roomTo && !(p as any)["room_to"] && !(p as any).newRoom) {
              // If a `displayRoom` is present, assume it is intentional and
              // preserve it. Only remove the stale `isRoomChange` flag when
              // there is no display override to show.
              if ((p as any).isRoomChange && !(p as any).displayRoom) {
                const clean = { ...p }
                delete (clean as any).isRoomChange
                // Also ensure we compute a normalized displayTeacher for the UI
                try {
                  const casual = (clean as any).casualSurname || undefined
                  const candidate = (clean as any).fullTeacher || (clean as any).teacher || undefined
                  const dt = casual ? stripLeadingCasualCode(String(casual)) : stripLeadingCasualCode(candidate as any)
                  (clean as any).displayTeacher = dt
                } catch (e) {}
                return clean
              }
            }
            // Compute a normalized `displayTeacher` property used by the UI.
            try {
              const casual = (p as any).casualSurname || undefined
              const candidate = (p as any).fullTeacher || (p as any).teacher || undefined
              const dt = casual ? stripLeadingCasualCode(String(casual)) : stripLeadingCasualCode(candidate as any)
              (p as any).displayTeacher = dt
            } catch (e) {}
            return p
          })
        } catch (e) {
          // ignore normalization errors
        }
      }
      return m
    }

    // Merge fresh timetable with previously-seen timetable entries to preserve
    // casually-provided teacher fields (e.g. `casualSurname`). This ensures
    // that when a background refresh returns a timetable lacking `casualSurname`
    // we keep the cached casual display instead of reverting to a short code.

    // Simplified: directly set external timetable without complex preservation.
    // Reverting the previous experimental merge logic to keep behavior stable.
    // Prefer grouped timetableByWeek when available (server now returns `timetableByWeek`).
    
    if (useExternalTimetableByWeek) {
      const filtered: Record<string, Period[]> = {}
      for (const [day, groups] of Object.entries(useExternalTimetableByWeek as Record<string, { A: Period[]; B: Period[]; unknown: Period[] }>)) {
        let list: Period[] = []

        // If an explicit current week is known, use it.
        if (currentWeek === 'A' || currentWeek === 'B') {
          list = Array.isArray(groups[currentWeek]) ? (groups[currentWeek] as Period[]) : []
        } else {
          // When currentWeek is unknown, prefer showing ALL periods from both weeks
          // rather than trying to guess. This prevents classes from disappearing.
          // Combine A + B + unknown, with A taking priority if there are duplicates.
          try {
            const combined: Period[] = []
            const seen = new Set<string>()
            
            // Add Week A periods first
            if (Array.isArray(groups.A)) {
              for (const p of groups.A) {
                const key = `${p.period}-${p.subject}`
                if (!seen.has(key)) {
                  combined.push({ ...p })
                  seen.add(key)
                }
              }
            }
            
            // Add Week B periods (skip duplicates)
            if (Array.isArray(groups.B)) {
              for (const p of groups.B) {
                const key = `${p.period}-${p.subject}`
                if (!seen.has(key)) {
                  combined.push({ ...p })
                  seen.add(key)
                }
              }
            }
            
            // Add unknown periods
            if (Array.isArray(groups.unknown)) {
              for (const p of groups.unknown) {
                const key = `${p.period}-${p.subject}`
                if (!seen.has(key)) {
                  combined.push({ ...p })
                  seen.add(key)
                }
              }
            }
            
            list = combined.length > 0 ? combined : []
          } catch (e) {
            // On error, fall back to showing A or B or unknown
            if (groups.A && groups.A.length) list = groups.A.slice()
            else if (groups.B && groups.B.length) list = groups.B.slice()
            else list = Array.isArray(groups.unknown) ? groups.unknown.slice() : []
          }
        }

        // Deep copy periods to prevent mutation of original timetableByWeek objects
        filtered[day] = list.map(p => ({ ...p }))
        
        // CRITICAL FIX: If filtered[day] is empty but useExternalTimetable (flat structure) has data with variations,
        // use that instead. This handles the case where timetableByWeek was built without variations
        // but the flat timetable structure has them (from date-specific API responses).
        if (filtered[day].length === 0 && useExternalTimetable && Array.isArray((useExternalTimetable as any)[day])) {
          const flatDayData = (useExternalTimetable as any)[day] as Period[]
          if (flatDayData.length > 0) {
            // Check if any period has variations
            const hasVariations = flatDayData.some((p: any) => p.isSubstitute || p.isRoomChange)
            if (hasVariations) {
                console.warn('🔴 [SUBS-DEBUG] Using flat timetable for', day, 'because it has variations. Flat data has:', flatDayData.filter((p: any) => p.isSubstitute || p.isRoomChange).map((p: any) => ({ period: p.period, sub: p.casualSurname || p.displayTeacher })))
              filtered[day] = flatDayData.map(p => ({ ...p }))
            }
          }
        }
        
        // Check for substitutions in filtered output
        const varsInFiltered = filtered[day].filter((p: any) => p.isSubstitute || p.isRoomChange)
        if (varsInFiltered.length > 0) {
          try { console.warn(`🔴 [SUBS-DEBUG] After building filtered[${day}], found ${varsInFiltered.length} substitutions:`, varsInFiltered.map((p: any) => ({ period: p.period, subject: p.subject, sub: p.casualSurname || p.displayTeacher }))) } catch (e) {}
        }
        
        // CRITICAL: Apply variations from authoritative cache FIRST, then overlay fresh data if available.
        // This ensures variations are NEVER lost, even when a background fetch returns data without them.
        try {
          // CRITICAL FIX: Try multiple date keys to find variations
          // Priority order:
          // 1. externalTimetableDateRef (what the data is FOR) - MOST AUTHORITATIVE
          // 2. Selected date (what user is viewing)
          // 3. Today's date (fallback)
          const selectedIso = (selectedDateObject || new Date()).toISOString().slice(0, 10)
          const candidateDates = [
            externalTimetableDateRef.current, // Try data's actual date FIRST
            selectedIso,
            new Date().toISOString().slice(0, 10)
          ].filter(Boolean)
          
          // Try multiple sources for base periods: grouped week data, flat day data, and cached data
          let daySource = useExternalTimetable && Array.isArray((useExternalTimetable as any)[day]) ? (useExternalTimetable as any)[day] as Period[] : []
          
          // If daySource is empty but we have lastRecordedTimetable, use that as fallback
          if (daySource.length === 0 && lastRecordedTimetable && Array.isArray((lastRecordedTimetable as any)[day])) {
            daySource = (lastRecordedTimetable as any)[day] as Period[]
          }
          
          // Check if we have authoritative variations - try multiple date keys
          const authVarsMap = authoritativeVariationsRef.current
          let authVarsForDate = null
          let matchedDate = null
          for (const dateKey of candidateDates) {
            authVarsForDate = authVarsMap.get(dateKey!)
            if (authVarsForDate) {
              matchedDate = dateKey
              break
            }
          }
          
          // Don't check date mismatch - API data already has correct variations for its date
          // The old logic was causing substitutes to disappear
          // if (authVarsForDate && externalTimetableDateRef.current && matchedDate !== externalTimetableDateRef.current) {
          //   authVarsForDate = null
          // }
          
          try { console.debug('[timetable.provider] variation lookup - selectedIso:', selectedIso, 'externalTimetableDateRef:', externalTimetableDateRef.current, 'matched:', matchedDate, 'day', day, '- authVars:', authVarsForDate ? Object.keys(authVarsForDate) : 'none', '- mapSize:', authVarsMap.size) } catch (e) {}

          // If the server/client has captured authoritative variations for
          // this date but the live `filtered[day]` is empty (e.g., a
          // background refresh briefly cleared the timetable), attempt to
          // reconstruct minimal period rows from either the live day source
          // or the last recorded timetable so substitutes/room-changes can
          // remain visible instead of flashing then disappearing.
          try {
            if (Array.isArray(filtered[day]) && filtered[day].length === 0 && authVarsForDate && Array.isArray(authVarsForDate[day]) && authVarsForDate[day].length) {
              const daySource = useExternalTimetable && Array.isArray((useExternalTimetable as any)[day]) ? (useExternalTimetable as any)[day] as Period[] : []
              const lastRecorded = lastRecordedTimetable && Array.isArray((lastRecordedTimetable as any)[day]) ? (lastRecordedTimetable as any)[day] as Period[] : []
              const reconstructed: Period[] = []
              for (const v of authVarsForDate[day]) {
                try {
                  let src = daySource.find((p: any) => String(p.period).trim().toLowerCase() === String(v.period).trim().toLowerCase())
                  if (!src) src = lastRecorded.find((p: any) => String(p.period).trim().toLowerCase() === String(v.period).trim().toLowerCase())
                  const base: any = src ? { ...src } : { period: v.period || '', time: '', subject: '', teacher: '' }
                  if (v.isSubstitute) {
                    base.isSubstitute = true
                    if (v.casualSurname) base.casualSurname = v.casualSurname
                    if (v.displayTeacher) base.displayTeacher = v.displayTeacher
                    if (v.originalTeacher) base.originalTeacher = v.originalTeacher
                  }
                  if (v.isRoomChange && v.displayRoom) {
                    base.isRoomChange = true
                    base.displayRoom = v.displayRoom
                    base.originalRoom = base.room || ''
                  }
                  reconstructed.push(base)
                } catch (e) {
                  // ignore single-item reconstruction errors
                }
              }
              if (reconstructed.length) filtered[day] = reconstructed
            }
          } catch (e) {
            // ignore reconstruction errors
          }

          // Apply variations to all periods in this day
          // STRATEGY: Always apply authoritative variations if they exist for this date.
          // Also overlay fresh match data if it has variations (to update the display with newest data).
          // NOTE: Variation SAVING is handled by a separate useEffect that watches externalTimetable
          for (const p of filtered[day]) {
            const normPeriod = String(p.period).trim().toLowerCase()
            
            // Get authoritative variation for this period (if exists)
            let authVariation: any = null
            try {
              const candidate = authVarsForDate && Array.isArray(authVarsForDate[day]) ? authVarsForDate[day] : []
              if (Array.isArray(candidate)) {
                authVariation = candidate.find((v: any) => String(v.period).trim().toLowerCase() === normPeriod)
              } else {
                try { console.debug('[timetable.provider] unexpected candidate type for authVarsForDate[day]', typeof authVarsForDate?.[day], authVarsForDate?.[day]) } catch (e) {}
                authVariation = null
              }
            } catch (e) {
              try { console.warn('[timetable.provider] unexpected authVarsForDate[day] type', typeof authVarsForDate, typeof authVarsForDate?.[day]) } catch (e2) {}
              authVariation = null
            }
            
            // ALWAYS apply authoritative variation if we have one - this is the source of truth
            if (authVariation) {
              try { console.debug('[timetable.provider] APPLYING auth variation for period', normPeriod, authVariation) } catch (e) {}
              if (authVariation.isSubstitute) {
                try { console.warn(`🔴 [SUBS-DEBUG] Applying auth variation for ${day} Period ${normPeriod}: SUB ${authVariation.casualSurname || authVariation.displayTeacher}`) } catch (e) {}
                (p as any).isSubstitute = true
                if (authVariation.casualSurname) (p as any).casualSurname = authVariation.casualSurname
                if (authVariation.displayTeacher) (p as any).displayTeacher = authVariation.displayTeacher
                if (authVariation.originalTeacher) (p as any).originalTeacher = authVariation.originalTeacher
              }
              if (authVariation.isRoomChange && authVariation.displayRoom) {
                try { console.warn(`🔴 [SUBS-DEBUG] Applying auth variation for ${day} Period ${normPeriod}: ROOM to ${authVariation.displayRoom}`) } catch (e) {}
                const scheduledRoom = String(p.room || '').trim().toLowerCase()
                const variationRoom = String(authVariation.displayRoom || '').trim().toLowerCase()
                if (variationRoom && variationRoom !== scheduledRoom) {
                  (p as any).isRoomChange = true
                  (p as any).displayRoom = authVariation.displayRoom
                  (p as any).originalRoom = p.room
                }
              }
            }
            
            // Also check daySource for FRESH variations that might be newer than cached
            // (This handles the case where a new variation was just added)
            if (Array.isArray(daySource) && daySource.length) {
              const normSubject = String(p.subject || '').trim().toLowerCase()
              const match = daySource.find((src) => {
                const srcPeriod = String(src.period).trim().toLowerCase()
                const srcSubject = String(src.subject || '').trim().toLowerCase()
                if (srcPeriod !== normPeriod) return false
                if (srcSubject === normSubject) return true
                if (srcSubject.includes(normSubject) || normSubject.includes(srcSubject)) return true
                const srcCode = srcSubject.replace(/[^a-z0-9]/g, '')
                const pCode = normSubject.replace(/[^a-z0-9]/g, '')
                if (srcCode && pCode && (srcCode.includes(pCode) || pCode.includes(srcCode))) return true
                return false
              })
              
              // If match has variations, use them (they might be more recent than cached)
              if (match && ((match as any).isSubstitute || (match as any).isRoomChange)) {
                if ((match as any).isSubstitute) {
                  try { console.warn(`🔴 [SUBS-DEBUG] Applying FRESH variation for ${day} Period ${normPeriod}: SUB ${(match as any).casualSurname || (match as any).displayTeacher}`) } catch (e) {}
                  (p as any).isSubstitute = true
                  if ((match as any).casualSurname) (p as any).casualSurname = (match as any).casualSurname
                  if ((match as any).casualToken) (p as any).casualToken = (match as any).casualToken
                  if ((match as any).displayTeacher) (p as any).displayTeacher = (match as any).displayTeacher
                  if ((match as any).originalTeacher) (p as any).originalTeacher = (match as any).originalTeacher
                  if (match.teacher) p.teacher = match.teacher
                }
                
                if ((match as any).isRoomChange && (match as any).displayRoom) {
                  try { console.warn(`🔴 [SUBS-DEBUG] Applying FRESH variation for ${day} Period ${normPeriod}: ROOM to ${(match as any).displayRoom}`) } catch (e) {}
                  const scheduledRoom = String(p.room || '').trim().toLowerCase()
                  const variationRoom = String((match as any).displayRoom || '').trim().toLowerCase()
                  if (variationRoom && variationRoom !== scheduledRoom) {
                    (p as any).isRoomChange = true
                    (p as any).displayRoom = (match as any).displayRoom
                    (p as any).originalRoom = p.room
                  }
                }
              }
            }
          }
        } catch (e) {
          // Ignore merge errors - display will still work without variations
          try { console.error('[timetable.provider] variation merge error', e) } catch (e2) {}
        }
      }
      // Ensure break periods (Recess, Lunch 1, Lunch 2) exist using bellTimesData
      // Also fall back to cached break layouts for instant display during sector switches
      const getBellForDay = (dayName: string) => {
        // Prefer API-provided bell buckets
        if (useExternalBellTimes) {
          const bucket = dayName === 'Friday' ? useExternalBellTimes.Fri : (dayName === 'Wednesday' || dayName === 'Thursday' ? useExternalBellTimes['Wed/Thurs'] : useExternalBellTimes['Mon/Tues'])
          if (bucket && bucket.length) return bucket
        }
        return []
      }
      
      // Helper to get cached breaks for a day (for instant display during sector switches)
      const getCachedBreaksForDay = (dayName: string): Period[] => {
        if (cachedBreakLayoutsRef.current && cachedBreakLayoutsRef.current[dayName]) {
          // Filter to only break periods
          return cachedBreakLayoutsRef.current[dayName].filter((p: any) => 
            /(?:recess|lunch|break)/i.test(String(p.subject || p.period || ''))
          ).map((p: any) => ({
            period: p.period,
            time: p.time,
            subject: 'Break',
            teacher: '',
            room: ''
          }))
        }
        return []
      }
      

      for (const day of Object.keys(filtered)) {
        let bells = (getBellForDay(day) || []).slice()
        const dayPeriods = filtered[day]
        
        // If no bells available from API, use cached break layouts as fallback
        // This ensures breaks show instantly during sector switches
        if (bells.length === 0) {
          const cachedBreaks = getCachedBreaksForDay(day)
          for (const breakPeriod of cachedBreaks) {
            const exists = dayPeriods.some((p) => 
              p.subject === 'Break' && (p.period || '').toLowerCase() === (breakPeriod.period || '').toLowerCase()
            )
            if (!exists) {
              dayPeriods.push({ ...breakPeriod })
            }
          }
        }
        
        // Always sort bells into canonical order, falling back to time when labels are ambiguous.
        // This ensures consistent ordering even when buckets from the API are unsorted.
        bells.sort((a, b) => {
          const ai = canonicalIndex(a?.period)
          const bi = canonicalIndex(b?.period)
          if (ai !== bi) return ai - bi
          return parseStartMinutesForDay(dayPeriods, a.time) - parseStartMinutesForDay(dayPeriods, b.time)
        })

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
            // Only insert break rows for entries that look like actual breaks (Recess, Lunch, etc.)
            // Do NOT treat numeric period labels (1, 2, 3, etc.) as breaks
            const looksLikeBreak = /(recess|lunch|break|l1|l2|r\b)/i.test(String(label))
            if (!looksLikeBreak) continue
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

      // Apply any authoritative variations (subs/room-changes) captured
      // previously so they are not lost when a fresh external timetable
      // arrives. IMPORTANT: Use the selected date (YYYY-MM-DD) for lookup.
      try {
        const selectedIso = (selectedDateObject ? selectedDateObject.toISOString().slice(0,10) : null)
        const authVarsMap = authoritativeVariationsRef.current
        const authVarsForDate = selectedIso && authVarsMap ? authVarsMap.get(selectedIso) : null
        if (authVarsForDate) {
          try { console.debug('[timetable.provider] applying authoritative variations (daily) for', selectedIso) } catch (e) {}
          for (const day of Object.keys(filtered)) {
            const daySource = useExternalTimetable && Array.isArray((useExternalTimetable as any)[day]) ? (useExternalTimetable as any)[day] as Period[] : []
            // If the fresh timetable is empty but we have authoritative
            // variations for this day, attempt to reconstruct minimal rows
            // so substitutes/room-changes remain visible.
            try {
              if (Array.isArray(filtered[day]) && filtered[day].length === 0 && Array.isArray(authVarsForDate[day]) && authVarsForDate[day].length) {
                const lastRecorded = lastRecordedTimetable && Array.isArray((lastRecordedTimetable as any)[day]) ? (lastRecordedTimetable as any)[day] as Period[] : []
                const reconstructed: Period[] = []
                for (const v of authVarsForDate[day]) {
                  try {
                    let src = daySource.find((p: any) => String(p.period).trim().toLowerCase() === String(v.period).trim().toLowerCase())
                    if (!src) src = lastRecorded.find((p: any) => String(p.period).trim().toLowerCase() === String(v.period).trim().toLowerCase())
                    const base: any = src ? { ...src } : { period: v.period || '', time: '', subject: '', teacher: '' }
                    if (v.isSubstitute) {
                      base.isSubstitute = true
                      if (v.casualSurname) base.casualSurname = v.casualSurname
                      if (v.displayTeacher) base.displayTeacher = v.displayTeacher
                      if (v.originalTeacher) base.originalTeacher = v.originalTeacher
                    }
                    if (v.isRoomChange && v.displayRoom) {
                      base.isRoomChange = true
                      base.displayRoom = v.displayRoom
                      base.originalRoom = base.room || ''
                    }
                    reconstructed.push(base)
                  } catch (e) {}
                }
                if (reconstructed.length) filtered[day] = reconstructed
              }
            } catch (e) {}

            for (const p of filtered[day]) {
              try {
                const normPeriod = String(p.period).trim().toLowerCase()
                let authVariation: any = null
                try {
                  const candidate = authVarsForDate && Array.isArray(authVarsForDate[day]) ? authVarsForDate[day] : []
                  authVariation = Array.isArray(candidate) ? candidate.find((v: any) => String(v.period).trim().toLowerCase() === normPeriod) : null
                } catch (e) {
                  try { console.warn('[timetable.provider] unexpected authVarsForDate[day] type (grouped)', typeof authVarsForDate, typeof authVarsForDate?.[day]) } catch (e2) {}
                  authVariation = null
                }
                if (authVariation) {
                  if (authVariation.isSubstitute) {
                    (p as any).isSubstitute = true
                    if (authVariation.casualSurname) (p as any).casualSurname = authVariation.casualSurname
                    if (authVariation.displayTeacher) (p as any).displayTeacher = authVariation.displayTeacher
                    if (authVariation.originalTeacher) (p as any).originalTeacher = authVariation.originalTeacher
                  }
                  if (authVariation.isRoomChange && authVariation.displayRoom) {
                    const scheduledRoom = String(p.room || '').trim().toLowerCase()
                    const variationRoom = String(authVariation.displayRoom || '').trim().toLowerCase()
                    if (variationRoom && variationRoom !== scheduledRoom) {
                      (p as any).isRoomChange = true
                      (p as any).displayRoom = authVariation.displayRoom
                      (p as any).originalRoom = p.room
                    }
                  }
                }
                // Also overlay fresh day-source variations if present
                if (daySource.length) {
                  const normSubject = String(p.subject || '').trim().toLowerCase()
                  const match = daySource.find((src) => {
                    const srcPeriod = String(src.period).trim().toLowerCase()
                    const srcSubject = String(src.subject || '').trim().toLowerCase()
                    if (srcPeriod !== normPeriod) return false
                    if (srcSubject === normSubject) return true
                    if (srcSubject.includes(normSubject) || normSubject.includes(srcSubject)) return true
                    const srcCode = srcSubject.replace(/[^a-z0-9]/g, '')
                    const pCode = normSubject.replace(/[^a-z0-9]/g, '')
                    if (srcCode && pCode && (srcCode.includes(pCode) || pCode.includes(srcCode))) return true
                    return false
                  })
                  if (match && ((match as any).isSubstitute || (match as any).isRoomChange)) {
                    if ((match as any).isSubstitute) {
                      (p as any).isSubstitute = true
                      if ((match as any).casualSurname) (p as any).casualSurname = (match as any).casualSurname
                      if ((match as any).casualToken) (p as any).casualToken = (match as any).casualToken
                      if ((match as any).displayTeacher) (p as any).displayTeacher = (match as any).displayTeacher
                      if ((match as any).originalTeacher) (p as any).originalTeacher = (match as any).originalTeacher
                      if (match.teacher) p.teacher = match.teacher
                    }
                    if ((match as any).isRoomChange && (match as any).displayRoom) {
                      const scheduledRoom = String(p.room || '').trim().toLowerCase()
                      const variationRoom = String((match as any).displayRoom || '').trim().toLowerCase()
                      if (variationRoom && variationRoom !== scheduledRoom) {
                        (p as any).isRoomChange = true
                        (p as any).displayRoom = (match as any).displayRoom
                        (p as any).originalRoom = p.room
                      }
                    }
                  }
                }
              } catch (e) {}
            }
          }
        }
      } catch (e) {}

      preferToRoomOnMap(filtered)
      return cleanupMap(filtered)
    }

    if (useExternalTimetable) {
      const filtered: Record<string, Period[]> = {}
      
      // Helper to identify non-class periods that should always be shown
      // (Period 0, Roll Call, End of Day, etc.)
      const isNonClassPeriod = (p: Period) => {
        const period = String(p.period || '').trim().toLowerCase()
        const subject = String(p.subject || '').trim().toLowerCase()
        // Period 0, Roll Call (RC), End of Day (EoD) should always show
        if (period === '0' || period === 'rc' || period === 'eod') return true
        if (subject.includes('period 0') || subject.includes('roll call') || subject.includes('end of day')) return true
        // Also keep breaks
        if (subject === 'break' || /(recess|lunch)/i.test(subject) || /(recess|lunch)/i.test(period)) return true
        return false
      }
      
      // CRITICAL: Pre-fetch authoritative variations to check during filtering
      // This prevents filtering out periods that have stored variations
      const selectedIso = (selectedDateObject || new Date()).toISOString().slice(0, 10)
      const candidateDateKeys = [
        externalTimetableDateRef.current,
        selectedIso,
        new Date().toISOString().slice(0, 10)
      ].filter(Boolean)
      
      let storedVariations: Record<string, any[]> | null = null
      const authVarsMap = authoritativeVariationsRef.current
      for (const dateKey of candidateDateKeys) {
        storedVariations = authVarsMap.get(dateKey!)
        if (storedVariations) break
      }
      
      // Helper to check if a period has a stored variation
      const hasStoredVariation = (dayName: string, periodIdentifier: string) => {
        if (!storedVariations) return false
        const dayVars = storedVariations[dayName]
        if (!Array.isArray(dayVars)) return false
        const normPeriod = String(periodIdentifier).trim().toLowerCase()
        return dayVars.some((v: any) => 
          String(v.period).trim().toLowerCase() === normPeriod &&
          (v.isSubstitute || v.isRoomChange)
        )
      }
      
      for (const [day, periods] of Object.entries(useExternalTimetable)) {
        const list = Array.isArray(periods) ? periods : []
        // When the server provides week-tagged entries (A/B), prefer entries
        // that match the known `currentWeek`. However, many upstream payloads
        // include UI-only items like Recess/Lunch without a `weekType` — treat
        // those as applicable to either week so they aren't dropped.
        // Also always preserve Period 0, Roll Call, and End of Day.
        // CRITICAL: Always preserve periods with variations (isSubstitute or isRoomChange)
        // because variations are date-specific and override the cycle week logic.
        // ALSO check if there are STORED variations for this period (authoritativeVariationsRef)
        // to prevent filtering out periods before their variations can be applied.
        if (currentWeek === 'A' || currentWeek === 'B') {
          filtered[day] = list.filter((p) => 
            isNonClassPeriod(p) || 
            !(p as any).weekType || 
            (p as any).weekType === currentWeek ||
            (p as any).isSubstitute ||
            (p as any).isRoomChange ||
            hasStoredVariation(day, p.period)
          )
        } else {
          // If we don't yet know the current week, show ALL periods (don't filter by weekType)
          // This prevents classes from disappearing while we're waiting for week detection
          filtered[day] = list
        }
      }
      // Ensure break periods (Recess, Lunch 1, Lunch 2) exist using bellTimesData
      const getBellForDay = (dayName: string) => {
        // Use only API-provided buckets when available; otherwise return empty.
        const source = useExternalBellTimes
        const bucket = dayName === 'Friday' ? source?.Fri : (dayName === 'Wednesday' || dayName === 'Thursday' ? source?.['Wed/Thurs'] : source?.['Mon/Tues'])
        return bucket || []
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

        // Always sort bells into canonical order, falling back to time when labels are ambiguous.
        // This ensures consistent ordering even when buckets from the API are unsorted.
        bells.sort((a, b) => {
          const ai = canonicalIndex(a?.period)
          const bi = canonicalIndex(b?.period)
          if (ai !== bi) return ai - bi
          return parseStartMinutesForDay(dayPeriods, a.time) - parseStartMinutesForDay(dayPeriods, b.time)
        })

        for (const b of bells) {
          try {
            const bellStart = parseStartMinutesForDay(dayPeriods, b.time)
            const classStarts = dayPeriods.map((p) => ({ p, s: parseStartMinutesForDay(dayPeriods, p.time) }))
            const matching = classStarts.filter((c) => Math.abs(c.s - bellStart) <= 1)
            const hasMatchingClass = matching.length > 0
            try { console.log('[timetable.provider] bell-check', { day: day, bell: b.period || b, bellTime: b.time, bellStart, hasMatchingClass, matchingStarts: matching.map(m => ({ period: m.p.period, time: m.p.time, start: m.s })) }) } catch (e) {}
            if (hasMatchingClass) continue
            const label = b.period || 'Break'
            // Only insert break rows for entries that look like actual breaks (Recess, Lunch, etc.)
            // Do NOT treat numeric period labels (1, 2, 3, etc.) as breaks
            const looksLikeBreak = /(recess|lunch|break|l1|l2|r\b)/i.test(String(label))
            if (!looksLikeBreak) continue
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

      // Apply authoritative variations even when using simple day-by-day external data
      try {
        const selectedIso = (selectedDateObject ? selectedDateObject.toISOString().slice(0, 10) : null)
        
        // Look for cached variations for this date
        let authVars = null
        let matchedDate = null
        
        if (selectedIso) {
          authVars = authoritativeVariationsRef.current.get(selectedIso)
          if (authVars) {
            matchedDate = selectedIso
            
            // CRITICAL: Validate that all variations have the correct date token
            // This prevents variations from other dates being applied
            let allValid = true
            let invalidCount = 0
            let invalidDates: string[] = []
            
            for (const day of Object.keys(authVars)) {
              const variations = authVars[day] || []
              for (const v of variations) {
                if (v.__prescribedDate !== selectedIso) {
                  allValid = false
                  invalidCount++
                  if (!invalidDates.includes(v.__prescribedDate)) {
                    invalidDates.push(v.__prescribedDate)
                  }
                }
              }
            }
            
            try { console.warn('[timetable.provider] 🔍 [TOKEN-DEBUG] Checking cached variations for', selectedIso, '- Found:', !!authVars, 'Valid:', allValid, 'InvalidCount:', invalidCount, 'InvalidDates:', invalidDates) } catch (e) {}
            
            if (!allValid) {
              try { console.warn('[timetable.provider] ❌ Rejecting cached variations - date token mismatch. Expected:', selectedIso, 'But found variations from:', invalidDates.join(', ')) } catch (e) {}
              authVars = null
            }
          } else {
            try { console.debug('[timetable.provider] 🔍 [TOKEN-DEBUG] No cached variations found for', selectedIso) } catch (e) {}
          }
        } else {
          try { console.debug('[timetable.provider] 🔍 [TOKEN-DEBUG] No selectedIso available') } catch (e) {}
        }
        
        console.debug('[timetable.provider] Simple timetable path - checking authVars - selectedIso:', selectedIso, 'matched:', matchedDate, 'willApply:', !!authVars, 'mapSize:', authoritativeVariationsRef.current.size)
        
        if (authVars) {
          for (const day of Object.keys(authVars)) {
            const varData = authVars[day]
            if (Array.isArray(varData) && varData.length > 0) {
              console.debug('[timetable.provider] Applying', varData.length, 'authVars to', day, 'periods:', filtered[day].length)
              for (const p of filtered[day]) {
                const normP = String(p.period).trim().toLowerCase()
                const v = varData.find((item: any) => String(item.period).trim().toLowerCase() === normP)
                if (v) {
                  console.debug('[timetable.provider] Matched variation for period', p.period, '- isSubstitute:', v.isSubstitute, '- isRoomChange:', v.isRoomChange)
                  if (v.isSubstitute) {
                    (p as any).isSubstitute = true
                    if (v.casualSurname) (p as any).casualSurname = v.casualSurname
                    if (v.displayTeacher) (p as any).displayTeacher = v.displayTeacher
                    if (v.originalTeacher) (p as any).originalTeacher = v.originalTeacher
                  }
                  if (v.isRoomChange && v.displayRoom) {
                    const scheduledRoom = String(p.room || '').trim().toLowerCase()
                    const variationRoom = String(v.displayRoom || '').trim().toLowerCase()
                    if (variationRoom && variationRoom !== scheduledRoom) {
                      (p as any).isRoomChange = true
                      (p as any).displayRoom = v.displayRoom
                      (p as any).originalRoom = p.room
                    }
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        console.error('[timetable.provider] Error applying cached variations:', e)
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
      const baseTemplate: Record<string, Period[]> = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] }
      const filtered: Record<string, Period[]> = {}
      for (const [day, periods] of Object.entries(baseTemplate)) filtered[day] = (periods || []).slice()

      const getBellForDay = (dayName: string) => {
        // Only respect API-provided bell buckets here; if none exist, don't insert hardcoded breaks.
        const source = useExternalBellTimes
        const bucket = dayName === 'Friday' ? source?.Fri : (dayName === 'Wednesday' || dayName === 'Thursday' ? source?.['Wed/Thurs'] : source?.['Mon/Tues'])
        return bucket || []
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
            // Only insert break rows for entries that look like actual breaks (Recess, Lunch, etc.)
            // Do NOT treat numeric period labels (1, 2, 3, etc.) as breaks
            const looksLikeBreak = /(recess|lunch|break|l1|l2|r\b)/i.test(String(label))
            if (!looksLikeBreak) continue
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

    // If re-authentication is required and we have no cached/external data,
    // return empty timetable so the UI can prompt the user to sign in.
    if (reauthRequired && !useExternalTimetable) {
      return emptyByDay
    }

    // If we have not yet completed the initial calendar check and we also
    // have not hydrated the cache, return an empty map.
    if (!initialCalendarChecked && !useExternalTimetable && !cacheHydrated) {
      try { console.debug('[timetable.provider] initial calendar check pending - returning empty timetable to avoid flash') } catch (e) {}
      return emptyByDay
    }

    // Default to empty if no data is available
    return emptyByDay
  }, [currentWeek, externalTimetable, externalTimetableByWeek, externalBellTimes, lastRecordedTimetable, lastRecordedTimetableByWeek, isLoading, reauthRequired, selectedDateObject, selectedDateIsHoliday, selectedDateCalendarChecked, initialCalendarChecked, cacheHydrated])

  // Persist computed break-layouts (simple heuristic) so we can hydrate
  // break rows quickly on restart without recomputing from bells immediately.
  useEffect(() => {
    try {
      if (!timetableData) return
      const layouts: Record<string, Period[]> = {}
      for (const day of Object.keys(timetableData)) {
        try {
          const arr = (timetableData[day] || []).filter((p) => {
            const subj = String(p.subject || p.period || '').toLowerCase()
            return subj.includes('break') || subj.includes('recess') || subj.includes('lunch')
          })
          layouts[day] = arr.slice()
        } catch (e) { layouts[day] = [] }
      }
      const prev = cachedBreakLayoutsRef.current
      const prevJson = prev ? JSON.stringify(prev) : null
      const nowJson = JSON.stringify(layouts)
      if (prevJson !== nowJson) {
        try {
          localStorage.setItem('synchron-break-layouts', nowJson)
        } catch (e) {}
        cachedBreakLayoutsRef.current = layouts
        try { console.debug('[timetable.provider] persisted break-layouts') } catch (e) {}
      }
    } catch (e) {}
  }, [timetableData])

  // Persist authoritative variations to localStorage whenever they change
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      const map = authoritativeVariationsRef.current
      if (!map || map.size === 0) return
      // Convert Map to plain object for JSON serialization
      const obj: Record<string, any> = {}
      map.forEach((value, key) => {
        obj[key] = value
      })
      localStorage.setItem('synchron-authoritative-variations', JSON.stringify(obj))
      try { console.debug('[timetable.provider] persisted authoritative variations for', map.size, 'dates') } catch (e) {}
    } catch (e) {}
  }, [timetableData]) // Re-persist whenever timetable data changes (which triggers variation updates)
  // CRITICAL: Capture variations from externalTimetable IMMEDIATELY when they appear
  // This ensures we never lose substitutions/room changes even if timetable is later overwritten
  // NOTE: We use externalTimetableDateRef (the date the timetable data is FOR) rather than
  // selectedDateObject (the date the user is viewing) because they can differ during date switches.
  useEffect(() => {
    try {
      if (!externalTimetable && !externalTimetableByWeek) return
      
      // CRITICAL: Only capture variations if we KNOW what date the timetable is for
      // Do NOT use selectedDateObject as a fallback - it can be a different date
      const timetableDateIso = externalTimetableDateRef.current
      
      if (!timetableDateIso) return
      
      // AGGRESSIVE DEBUG: Log what we're about to capture
      try {
        console.warn('🔍 [CAPTURE START] Processing timetable for date:', timetableDateIso, 'currentWeek:', currentWeek, 'selectedDate:', selectedDateObject?.toISOString().slice(0,10))
      } catch (e) {}
      
      try {
        // Debug: log basic info about the incoming data
        const days = Object.keys(externalTimetable || {})
        let periodCount = 0
        let varCount = 0
        for (const d of days) {
          const arr = (externalTimetable as any)[d] || []
          periodCount += arr.length
          for (const p of arr) if (p && (p.isSubstitute || p.isRoomChange)) varCount++
        }
        console.debug('[timetable.provider] externalTimetable arrived for refDate=', externalTimetableDateRef.current, 'selected=', selectedDateObject?.toISOString().slice(0,10), 'days=', days.join(','), 'periods=', periodCount, 'vars=', varCount)
      } catch (e) {}
      
      // Check if EITHER structure has any variations
      // This handles the case where variations are in grouped structure but not flat
      let hasVariations = false
      const varData: Record<string, any[]> = {}
      
      // Check flat structure - variations are only extracted if this timetable is definitely for timetableDateIso
      if (externalTimetable) {
        for (const day of Object.keys(externalTimetable)) {
          const periods = (externalTimetable as any)[day] || []
          // CRITICAL: Only extract variations from timetable data for THIS specific date
          const variations = periods
            .filter((p: any) => {
              // Must be a variation
              if (!p.isSubstitute && !p.isRoomChange) return false
              return true
            })
            .map((p: any) => ({
              period: p.period,
              isSubstitute: p.isSubstitute,
              isRoomChange: p.isRoomChange,
              displayRoom: p.displayRoom,
              displayTeacher: p.displayTeacher,
              casualSurname: p.casualSurname,
              originalTeacher: p.originalTeacher,
              originalRoom: p.originalRoom,
            }))
          if (variations.length > 0) {
            hasVariations = true
            varData[day] = variations
            // AGGRESSIVE DEBUG: Log every variation captured with the date
            try {
              console.warn('🔍 [CAPTURE] Date:', timetableDateIso, 'Day:', day, 'Variations:', variations.map(v => `P${v.period}:${v.casualSurname || v.displayRoom}`).join(', '))
            } catch (e) {}
            // Extra logging for Friday and Thursday
            if (day.toLowerCase().includes('fri')) {
              try { console.warn('[timetable.provider] 📅 FRIDAY variations captured:', variations.length, 'variations:', variations.map(v => `P${v.period} ${v.isSubstitute ? 'SUB' : ''}${v.isRoomChange ? 'ROOM' : ''}`).join(', ')) } catch (e) {}
            }
            if (day.toLowerCase().includes('thu')) {
              try { console.warn('[timetable.provider] 📅 THURSDAY variations captured:', variations.length, 'variations:', variations.map(v => `P${v.period} ${v.isSubstitute ? 'SUB' : ''}${v.isRoomChange ? 'ROOM' : ''}`).join(', '), 'Day key:', day) } catch (e) {}
            }
          } else {
            varData[day] = []
          }
        }
      }
      
      // Ensure all days have an entry
      for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
        if (!varData[day]) varData[day] = []
      }
      
      // CRITICAL: Only update if we have variations OR if we don't have any stored yet
      // This prevents overwriting good cached variations with empty data from refetches
      const map = authoritativeVariationsRef.current
      const existingVars = map.get(timetableDateIso)
      
      // Count existing variations
      let existingCount = 0
      if (existingVars) {
        for (const day of Object.keys(existingVars)) {
          existingCount += (existingVars[day] || []).length
        }
      }
      
      // Count new variations
      let newCount = 0
      for (const day of Object.keys(varData)) {
        newCount += (varData[day] || []).length
      }
      
      // CRITICAL: Only update variations if we have any in the current data
      // Always trust fresh data over cached data - if API returned 0 variations, that's correct for this date
      if (newCount > 0) {
        // Add date token to each variation for cache validation
        const varDataWithToken = { ...varData }
        for (const day of Object.keys(varDataWithToken)) {
          varDataWithToken[day] = (varDataWithToken[day] || []).map((v: any) => ({
            ...v,
            __prescribedDate: timetableDateIso  // Token to validate this variation belongs to this date
          }))
        }
        
        map.set(timetableDateIso, varDataWithToken)
        // AGGRESSIVE DEBUG: Log storage action with token info
        try {
          console.warn('🔍 [STORAGE] Storing variations for date:', timetableDateIso, 'Total variations:', newCount)
          for (const day of Object.keys(varDataWithToken)) {
            if (varDataWithToken[day]?.length > 0) {
              const sampleVar = varDataWithToken[day][0]
              console.warn('🔍 [STORAGE]   -', day, ':', varDataWithToken[day].length, 'variations, token:', sampleVar.__prescribedDate, '- samples:', varDataWithToken[day].slice(0, 2).map((v: any) => `P${v.period}:${v.casualSurname || v.displayRoom}`).join(', '))
            }
          }
        } catch (e) {}
        // Limit map size to prevent unbounded growth. Keep a longer history
        // so substitutions from far-past dates remain available. Timetabl-app
        // preserves query cache in localStorage (react-query persister) and
        // thus can show substitutions from months ago. To match that behavior
        // for authoritative variations we retain up to 365 days by default.
        const MAX_VAR_DAYS = 365
        if (map.size > MAX_VAR_DAYS) {
          const oldest = Array.from(map.keys()).sort()[0]
          map.delete(oldest)
        }
        try { console.debug('[timetable.provider] CAPTURED authoritative variations from externalTimetable for', timetableDateIso, '(ref:', externalTimetableDateRef.current, 'selected:', selectedDateObject?.toISOString().slice(0,10), ')') } catch (e) {}
        
        // Immediately persist to localStorage
        try {
          const obj: Record<string, any> = {}
          map.forEach((value, key) => { 
            obj[key] = value
            // Verify tokens in stored data
            try {
              const dayCount = Object.keys(value).length
              const firstDayKey = Object.keys(value)[0]
              const firstVar = value[firstDayKey]?.[0]
              if (firstVar) {
                console.debug('[timetable.provider] 🔍 [PERSIST] Date:', key, 'has token:', firstVar.__prescribedDate)
              }
            } catch (e) {}
          })
          localStorage.setItem('synchron-authoritative-variations', JSON.stringify(obj))
          try { console.debug('[timetable.provider] 🔍 [PERSIST] Persisted', map.size, 'dates to localStorage') } catch (e) {}
        } catch (e) {}
      }
    } catch (e) {}
  }, [externalTimetable, externalTimetableByWeek, selectedDateObject, currentWeek])
  // Track the last time we attempted to fetch substitutions so we can retry
  // periodically instead of permanently skipping when no subs were present.
  const lastSubsAttemptRef = useRef<number | null>(null)
  // Track the last date string we requested from /api/timetable to avoid
  // redundant concurrent or repeated fetches for the same date.
  const lastRequestedDateRef = useRef<string | null>(null)

  // Helper: fetch substitutions from our server route. Supports JSON responses
  // and HTML fallbacks by scraping via PortalScraper when necessary.
  // If `payload` is provided, attempt to extract substitution variations
  // directly from it (avoids an extra network round-trip). When no payload
  // is provided, fetch the AI timetable endpoint for the currently
  // selected date and extract substitutions as before.
  const getPortalSubstitutions = async (payload?: any): Promise<any[]> => {
    try {
      // If a payload object was provided by the caller (we already fetched
      // `/api/timetable`), try to extract variations directly from it to
      // avoid additional network requests.
      if (payload) {
        try {
          // If the server provided an authoritative `upstream.day` object for
          // this specific date, prefer extracting variations strictly from
          // that object only. This avoids broad recursive heuristics that can
          // mis-attribute rooms from unrelated payload fields. When a
          // day-specific payload exists we treat the absence of `roomVariations`
          // as authoritative (i.e. no room changes) and return an empty array.
          const daySource = payload.upstream && payload.upstream.day ? payload.upstream.day : null
          if (daySource) {
            const fromDay = PortalScraper.extractVariationsFromJson(daySource)
            if (Array.isArray(fromDay) && fromDay.length) return fromDay
            // Explicitly return empty when day exists but no variations found.
            return []
          }

          // Fallback: when no authoritative day object exists, attempt to
          // extract variations from upstream or the whole payload as before.
          const fromUpstream = PortalScraper.extractVariationsFromJson(payload.upstream || payload)
          if (Array.isArray(fromUpstream) && fromUpstream.length) return fromUpstream

          // Inline scanning for substitution-like objects embedded in the payload
          const inlineFound: any[] = []
          const keysRe = /substitute|replacement|casual|relief|variation/i
          const scan = (obj: any) => {
            if (!obj || typeof obj !== 'object') return
            if (Array.isArray(obj)) {
              for (const v of obj) scan(v)
              return
            }
            const props = Object.keys(obj).join('|')
            if (keysRe.test(props)) inlineFound.push(obj)
            for (const k of Object.keys(obj)) scan(obj[k])
          }
          scan(payload)
          if (inlineFound.length) {
            const normalizedInline = inlineFound.map((it: any) => ({
              date: it.date || it.day || undefined,
              period: it.period || it.p || it.block || undefined,
              subject: it.subject || it.class || undefined,
              originalTeacher: it.teacher || it.originalTeacher || undefined,
              substituteTeacher: it.substitute || it.replacement || it.casual || it.substituteTeacher || undefined,
              substituteTeacherFull: it.substituteFullName || it.substituteFull || (it.casualSurname ? String(it.casualSurname) : undefined) || undefined,
              casual: it.casual || undefined,
              casualSurname: it.casualSurname || undefined,
              fromRoom: it.fromRoom || it.from || undefined,
              toRoom: it.toRoom || it.to || it.room || undefined,
              reason: it.reason || it.note || undefined,
              raw: it,
            }))
            return normalizedInline
          }
          if (Array.isArray(payload.substitutions)) return payload.substitutions
          if (Array.isArray(payload.variations)) return payload.variations
        } catch (e) {
          // fall through to fetch-based fallback
        }
      }

      // No payload or extraction failed - fall back to fetching the AI endpoint
      // for the selected date (same behavior as before).
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
          if (Array.isArray(fromUpstream) && fromUpstream.length) {
            // Ensure each substitution has a date set so applySubstitutionsToTimetable uses the correct day
            return fromUpstream.map((v: any) => ({ ...v, date: v.date || dateParam }))
          }
          // Some timetable JSON shapes embed substitute/casual fields directly
          // on period items rather than exposing a separate `variations` array.
          // Scan common payload locations for inline substitution markers and
          // normalize them into variation-like objects.
          try {
            const inlineFound: any[] = []
            const keysRe = /substitute|replacement|casual|relief|variation/i
            const scan = (obj: any) => {
              if (!obj || typeof obj !== 'object') return
              if (Array.isArray(obj)) {
                for (const v of obj) scan(v)
                return
              }
              // If this object looks like a period/entry and contains casual/sub keys
              const props = Object.keys(obj).join('|')
              if (keysRe.test(props)) {
                inlineFound.push(obj)
              }
              for (const k of Object.keys(obj)) scan(obj[k])
            }
            scan(j)
            if (inlineFound.length) {
              try { console.debug('[timetable.provider] found inline substitution-like items in /api/timetable payload', inlineFound.length, inlineFound[0]) } catch (e) {}
              // Normalize inline items to variation objects similar to portal-scraper.normalizeVariation
              const normalizedInline = inlineFound.map((it: any) => ({
                date: it.date || it.day || dateParam,
                period: it.period || it.p || it.block || undefined,
                subject: it.subject || it.class || undefined,
                originalTeacher: it.teacher || it.originalTeacher || undefined,
                substituteTeacher: it.substitute || it.replacement || it.casual || it.substituteTeacher || undefined,
                substituteTeacherFull: it.substituteFullName || it.substituteFull || (it.casualSurname ? String(it.casualSurname) : undefined) || undefined,
                casual: it.casual || undefined,
                casualSurname: it.casualSurname || undefined,
                fromRoom: it.fromRoom || it.from || undefined,
                toRoom: it.toRoom || it.to || it.room || undefined,
                reason: it.reason || it.note || undefined,
                raw: it,
              }))
              return normalizedInline
            }
          } catch (e) {
            try { console.debug('[timetable.provider] inline scan failed', e) } catch (err) {}
          }
          // fall back to commonly named keys
          if (Array.isArray(j.substitutions)) return j.substitutions.map((v: any) => ({ ...v, date: v.date || dateParam }))
          if (Array.isArray(j.variations)) return j.variations.map((v: any) => ({ ...v, date: v.date || dateParam }))
        }
        // If AI endpoint returned HTML, attempt to scrape it
        if (res.ok && ct.includes('text/html')) {
          const text = await res.text()
          try {
            const extracted = PortalScraper.extractVariationsFromHtml(text)
            try { console.debug('[timetable.provider] ai timetable extracted from HTML', extracted.length) } catch (e) {}
            return (extracted || []).map((v: any) => ({ ...v, date: v.date || dateParam }))
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
          return (j.substitutions || []).map((v: any) => ({ ...v, date: v.date || dateParam }))
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

  // If we started with cached substitutions and an initial external timetable,
  // mark substitutions as applied immediately so the provider and UI treat
  // the cached data as authoritative while background refresh continues.
  useEffect(() => {
    try {
      if (!externalTimetable) return
      if (!Array.isArray(__initialCachedSubs) || __initialCachedSubs.length === 0) return
      if (subsAppliedRef.current) return
      try {
        subsAppliedRef.current = Date.now()
        setLastRecordedTimetable(externalTimetable)
        try { setTimetableSource((s) => s || 'cache') } catch (e) {}
        try { console.debug('[timetable.provider] marked cached substitutions as applied (init)') } catch (e) {}
      } catch (e) {
        // ignore
      }
    } catch (e) {}
  }, [externalTimetable])

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
          try { console.debug('[timetable.provider] hydrate from localStorage -> setExternalBellTimes (persisted)', persistedBellTimes) } catch (e) {}
          setExternalBellTimes(persistedBellTimes)
        }
        lastSeenBellTimesRef.current = persistedBellTimes
        lastSeenBellTsRef.current = parsed.ts || Date.now()
      }
    } catch (e) {
      // ignore parse errors
    }
  }, [])

  // Persist external bellTimes whenever they change so we can hydrate
  // break layouts quickly on restart.
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      if (!externalBellTimes) return
      try { localStorage.setItem('synchron-last-belltimes', JSON.stringify(externalBellTimes)) } catch (e) {}
    } catch (e) {}
  }, [externalBellTimes])

  // If we have cached substitutions from a previous session, apply them
  // immediately to the freshly-hydrated external timetable so the UI
  // benefits from substitutions while the live fetch completes.
  useEffect(() => {
    try {
      if (!externalTimetable) return
      if (!timetableSource) return

      // FIRST: Check if the timetable already has subs applied (from the API).
      // If so, mark subsAppliedRef immediately to prevent Effect 2 from
      // re-fetching and potentially overwriting the data.
      try {
        let hasSubs = false
        for (const d of Object.keys(externalTimetable)) {
          for (const p of externalTimetable[d] || []) {
            if ((p as any).isSubstitute) { hasSubs = true; break }
            if ((p as any).casualSurname) { hasSubs = true; break }
            if ((p as any).isRoomChange) { hasSubs = true; break }
          }
          if (hasSubs) break
        }

        if (hasSubs) {
          // mark that substitutions are present for this session
          subsAppliedRef.current = Date.now()
          try { console.debug('[timetable.provider] externalTimetable already contains substitutions; skipping further sub processing') } catch (e) {}
          return
        }
      } catch (e) {}

      // SECOND: If no subs detected on the timetable, try applying cached subs
      const cached = cachedSubsRef.current
      if (!cached || !Array.isArray(cached) || cached.length === 0) return

      // Apply cached substitutions to the fresh timetable
      try {
        const applied = applySubstitutionsToTimetable(externalTimetable, cached, { debug: false })
        try { console.debug('[timetable.provider] applied cached substitutions (hydrate/refresh)') } catch (e) {}
        setExternalTimetable(applied)
        subsAppliedRef.current = Date.now()
      } catch (e) {
        try { console.debug('[timetable.provider] error applying cached subs', e) } catch (err) {}
      }
    } catch (e) {}
  }, [externalTimetable, timetableSource])

  useEffect(() => {
    if (!externalTimetable) return
    if (!timetableSource) return
    // If we already applied substitutions, skip. Otherwise, limit retry
    // frequency so we don't hammer the AI/portal endpoint when no subs exist.
    const SUBS_RETRY_MS = 2 * 60 * 1000 // 2 minutes
    if (subsAppliedRef.current) return
    if (lastSubsAttemptRef.current && (Date.now() - lastSubsAttemptRef.current) < SUBS_RETRY_MS) return

    let cancelled = false

    ;(async () => {
      try {
        try { console.debug('[timetable.provider] fetching substitutions for externalTimetable') } catch (e) {}
        lastSubsAttemptRef.current = Date.now()
        const subs = await getPortalSubstitutions()
        try { console.debug('[timetable.provider] substitutions fetched', Array.isArray(subs) ? subs.length : 0) } catch (e) {}
        if (!cancelled && subs.length > 0) {
          try {
            const applied = applySubstitutionsToTimetable(externalTimetable, subs, { debug: true })
            // Count how many periods were marked as substitutes for logging
            let appliedCount = 0
            try {
              for (const d of Object.keys(applied)) {
                for (const p of applied[d] || []) {
                  if ((p as any).isSubstitute) appliedCount++
                }
              }
            } catch (e) {}
            try { console.debug('[timetable.provider] substitutions applied, substituteCount=', appliedCount) } catch (e) {}
            // Persist the substitutions for faster hydrate on next load
            try {
              if (typeof window !== 'undefined') {
                try { localStorage.setItem('synchron-last-subs', JSON.stringify(subs)) } catch (e) {}
                cachedSubsRef.current = subs
              }
            } catch (e) {}
            setExternalTimetable(applied)
            subsAppliedRef.current = Date.now()
          } catch (e) {
            try { console.debug('[timetable.provider] error applying substitutions', e) } catch (err) {}
            // ignore apply errors
          }
        } else {
          // No substitutions found this attempt; record attempt timestamp
          lastSubsAttemptRef.current = Date.now()
        }
      } catch (e) {
        try { console.debug('[timetable.provider] error fetching substitutions', e) } catch (err) {}
        // ignore network errors
      }
    })()

    return () => { cancelled = true }
  }, [externalTimetable, timetableSource, selectedDateObject])

  // Remember last known-good external timetable data so we can continue
  // showing it while a reload is in progress or when a refresh falls back.
  useEffect(() => {
    if (externalTimetable && timetableSource) {
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
  async function refreshExternal(attemptedRefresh = false, force = false): Promise<void> {
    // If we already have a cached timetable, avoid showing the global
    // loading spinner ΓÇö keep cached content visible and refresh in the
    // background. Only show the loading state when there is no cached data.
    const hadCache = Boolean(externalTimetable || lastRecordedTimetable)
    if (!hadCache) setIsLoading(true)
    // Mark that a background refresh is in progress for logging/debug
    setIsRefreshing(true)
    // Short-circuit: if a refresh is already running and this call is not forced,
    // avoid starting a duplicate refresh.
    try {
      if (isRefreshing && !force) {
        try { console.debug('[timetable.provider] refresh already in progress; skipping') } catch (e) {}
        if (!hadCache) setIsLoading(false)
        return
      }
    } catch (e) {}
    // If developer debugging key is set, attach temporary event listeners
    try {
      if (typeof window !== 'undefined' && window.sessionStorage && window.sessionStorage.getItem('synchron:debug-refresh') === 'true') {
        const cap = (e: Event) => {
          try {
            const ev = e as PointerEvent
            const top = document.elementFromPoint(ev.clientX, ev.clientY)
            console.debug('[timetable.refresh.debug] capture', e.type, 'target=', e.target, 'top=', top)
            try { console.debug('[timetable.refresh.debug] composedPath', (ev as any).composedPath ? (ev as any).composedPath() : (ev as any).path || []) } catch (err) {}
              } catch (e) {}
        }
        const bub = (e: Event) => {
          try {
            const ev = e as PointerEvent
            const top = document.elementFromPoint(ev.clientX, ev.clientY)
            console.debug('[timetable.refresh.debug] bubble', e.type, 'target=', e.target, 'defaultPrevented=', (e as any).defaultPrevented, 'top=', top)
            try { console.debug('[timetable.refresh.debug] composedPath', (ev as any).composedPath ? (ev as any).composedPath() : (ev as any).path || []) } catch (err) {}
          } catch (err) {}
        }
        // Mark that the initial calendar check has completed (success or fail)
        try { setInitialCalendarChecked(true) } catch (e) {}
        document.addEventListener('pointerdown', cap, true)
        document.addEventListener('click', bub, false)
        refreshDebugHandlersRef.current = { capture: cap, bubble: bub }
        console.debug('[timetable.refresh.debug] installed debug listeners')
      }
    } catch (e) {}
    const _t = startTimer('[timetable] refreshExternal')
    // Throttle aggressive refreshes: ensure we don't refresh more often than MIN_REFRESH_MS
    try {
      const now = Date.now()
      if (!force && lastRefreshTsRef.current && (now - lastRefreshTsRef.current) < MIN_REFRESH_MS) {
        try { console.debug('[timetable.provider] refresh skipped: rate limit') } catch (e) {}
        setIsRefreshing(false)
        if (!hadCache) setIsLoading(false)
        return
      }
      lastRefreshTsRef.current = now
    } catch (e) {}
    setError(null)

    // First try the server-scraped homepage endpoint as a quick probe.
    try { _t.lap('start-homepage-probe') } catch (e) {}
    // Note: We intentionally do NOT set any timetable state or return early
    // here because the home-timetable endpoint lacks classVariations and
    // roomVariations. We always want to proceed to /api/timetable?date=xxx
    // which returns the full day timetable with substitute/room changes.
    // ALSO: Do NOT set bell times from this endpoint if we already have them,
    // since /api/timetable returns authoritative date-specific bell times
    // that may include variations (e.g., modified schedules for special days).
      try {
        const ht = await fetch('/api/portal/home-timetable', { credentials: 'include' })
        try { _t.lap('homepage-fetched') } catch (e) {}
        const htctype = ht.headers.get('content-type') || ''
        if (ht.ok && htctype.includes('application/json')) {
          const jht = await ht.json()
          // Only extract bell times if we don't already have any - the authoritative
          // data comes from /api/timetable which may have date-specific variations
              if (jht && !externalBellTimes && !lastSeenBellTimesRef.current) {
            try {
              const computed = buildBellTimesFromPayload(jht)
              const finalBellTimes: Record<string, any[]> = { 'Mon/Tues': [], 'Wed/Thurs': [], 'Fri': [] }
              const src = jht.bellTimes || {}
              for (const k of ['Mon/Tues', 'Wed/Thurs', 'Fri']) {
                if (src[k] && Array.isArray(src[k]) && src[k].length) finalBellTimes[k] = src[k]
                else if (computed[k] && Array.isArray(computed[k]) && computed[k].length) finalBellTimes[k] = computed[k]
                else finalBellTimes[k] = []
              }
              const hasAny = Object.values(finalBellTimes).some((arr) => Array.isArray(arr) && arr.length > 0)
              if (hasAny) {
                try { console.debug('[timetable.provider] homepage-scraper -> setExternalBellTimes', finalBellTimes) } catch (e) {}
                setExternalBellTimes(finalBellTimes)
                lastSeenBellTimesRef.current = finalBellTimes
                lastSeenBellTsRef.current = Date.now()
              }
            } catch (e) {
              // ignore extraction errors
            }
          }

          // If the homepage scraper or API augmentation marked today as a holiday,
          // respect that and immediately show an empty timetable (do not proceed
          // to fetch /api/timetable which may be blocked by auth or return HTML).
          try {
            const isHolidaySignal = Boolean(
              jht?.holiday === true || jht?.isHoliday === true || jht?.noTimetable === true || (jht && jht.timetable && Object.keys(jht.timetable).length === 0)
            )
            if (isHolidaySignal) {
              try { _t.lap('detected-holiday-signal') } catch (e) {}
              // Do NOT clear caches or set timetable to empty.
              // Just mark as holiday and finish refresh.
              setSelectedDateIsHoliday(true)
              setTimetableSource('portal-home-empty')
              try { setLastFetchedDate((new Date()).toISOString().slice(0,10)); setLastFetchedPayloadSummary({ holiday: true }) } catch (e) {}
              setIsRefreshing(false)
              if (!hadCache) setIsLoading(false)
              return
            }
          } catch (e) {
            // ignore holiday-check errors and continue
          }

          // Do NOT set externalTimetable here for normal cases - continue to /api/timetable
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
        // CRITICAL: Use the currently selected date, NOT a calculated "next school day".
        // This prevents refreshExternal from overwriting timetable data for a date the user
        // is currently viewing with data for a different date.
        // Use the REF to get the latest value, avoiding stale closure issues in interval callbacks.
        // Fall back to smart date calculation only if no date is explicitly selected.
        const currentSelectedDate = selectedDateObjectRef.current
        let fetchDate: Date
        if (currentSelectedDate) {
          // User has a date selected - respect it
          fetchDate = currentSelectedDate
        } else {
          // No date selected - use next school day logic
          const now = new Date()
          const dow = now.getDay()
          if (dow === 0 || dow === 6) {
            // Weekend - use next Monday
            fetchDate = getNextSchoolDay(now)
          } else if (isSchoolDayOver()) {
            // Weekday but school is over - use next school day
            fetchDate = getNextSchoolDay(now)
          } else {
            fetchDate = now
          }
        }
        const todayDateStr = fetchDate.toISOString().slice(0, 10)
        console.log('[DEBUG refreshExternal] fetching for date:', todayDateStr, 'selectedDateObjectRef:', currentSelectedDate?.toISOString().slice(0,10))
        // Check the official calendar for holidays for this exact date.
        try {
          try {
            const calRes = await fetch(`/api/calendar?endpoint=days&from=${encodeURIComponent(todayDateStr)}&to=${encodeURIComponent(todayDateStr)}`, { credentials: 'include' })
            const cctype = calRes.headers.get('content-type') || ''
            if (calRes.ok && cctype.includes('application/json')) {
              const calJson = await calRes.json()
              // calendar/days.json usually returns an object keyed by date or an array
              let dayInfo: any = null
              if (Array.isArray(calJson) && calJson.length) dayInfo = calJson[0]
              else if (calJson && typeof calJson === 'object' && calJson[todayDateStr]) dayInfo = calJson[todayDateStr]
              else if (calJson && typeof calJson === 'object') {
                // try to find a single entry matching the date
                for (const k of Object.keys(calJson)) {
                  const v = calJson[k]
                  if (v && (v.date === todayDateStr || String(k) === todayDateStr)) { dayInfo = v; break }
                }
              }
              const isHolidayCal = Boolean(
                dayInfo && (
                  dayInfo.isHoliday === true ||
                  dayInfo.holiday === true ||
                  String(dayInfo.is_school_day).toLowerCase() === 'false' ||
                  String(dayInfo.status).toLowerCase().includes('holiday') ||
                  String(dayInfo.type || '').toLowerCase().includes('holiday') ||
                  String(dayInfo.dayType || '').toLowerCase().includes('holiday')
                )
              )
              if (isHolidayCal) {
                // Mark as holiday but DO NOT return early.
                // We still want to proceed to /api/timetable to fetch the 
                // full cycle (timetableByWeek) and bell times, which are 
                // still useful for the Cycle View even during holidays.
                setSelectedDateIsHoliday(true)
                // If we don't have a cycle cache yet, we definitely want to continue.
                // If we do have one, we can still continue to ensure it's up to date.
              }
            }
          } catch (e) {
            // ignore calendar errors and continue to timetable fetch
          }
        } catch (e) {}
        const r = await fetch(`/api/timetable?date=${encodeURIComponent(todayDateStr)}`, { credentials: 'include', cache: 'no-store', headers: { 'pragma': 'no-cache', 'cache-control': 'no-cache' } })
        console.log('[DEBUG refreshExternal] response status:', r.status)
        if (r.status === 401) {
          if (!attemptedRefresh) {
            try {
              const rr = await fetch('/api/auth/refresh', { credentials: 'include' })
              if (!rr || !rr.ok) {
                try { toast({ title: 'Session expired', description: 'Please sign in again.' }) } catch (e) {}
                try { setIsAuthenticated(false) } catch (e) {}
                try { setReauthRequired(true) } catch (e) {}
                // Refresh failed, don't retry - just bail out
                return
              }
            } catch (e) {
              try { toast({ title: 'Session expired', description: 'Please sign in again.' }) } catch (e) {}
              try { setReauthRequired(true) } catch (err) {}
              // Refresh failed, don't retry - just bail out
              return
            }
            // Refresh succeeded, retry the timetable fetch
            return refreshExternal(true)
          } else {
            // Already attempted refresh and still got 401 - give up
            try { setReauthRequired(true) } catch (e) {}
            return
          }
        }
        const rctype = r.headers.get('content-type') || ''
        if (rctype.includes('application/json')) {
          const j = await r.json()
          // Inspired by timetabl-app: some upstream shapes use boolean or
          // empty timetable structures to indicate "no timetable". Treat
          // these shapes as authoritative and show an empty timetable.
          try {
            const rawTimetable = j && j.timetable
            const nestedBoolean = rawTimetable && (rawTimetable.timetable === true || rawTimetable.timetable === false)
            const isBooleanTimetable = typeof rawTimetable === 'boolean' || Boolean(nestedBoolean)
            const looksEmptyObject = ((): boolean => {
              try {
                if (!rawTimetable) return false
                if (typeof rawTimetable === 'object') {
                  // Common shapes: timetable.timetable.periods or timetable.days
                  if (rawTimetable.timetable && typeof rawTimetable.timetable === 'object') {
                    const inner = rawTimetable.timetable
                    if (Array.isArray(inner) && inner.length === 0) return true
                    if (inner.periods && typeof inner.periods === 'object' && Object.keys(inner.periods).length === 0) return true
                    if (inner.days && typeof inner.days === 'object' && Object.keys(inner.days).length === 0) return true
                  }
                  // Top-level timetable may include a days map
                  if (rawTimetable.days && typeof rawTimetable.days === 'object' && Object.keys(rawTimetable.days).length === 0) return true
                }
                return false
              } catch (e) { return false }
            })()

            if (isBooleanTimetable || looksEmptyObject || j?.noTimetable === true) {
              try { console.debug('[timetable.provider] JSON payload indicates no timetable (boolean/empty)') } catch (e) {}
              // Do NOT clear caches. Just mark as empty source and finish.
              setTimetableSource('external-empty')
              try { setLastFetchedDate((new Date()).toISOString().slice(0,10)); setLastFetchedPayloadSummary({ error: 'no timetable (boolean/empty)' }) } catch (e) {}
              setIsRefreshing(false)
              if (!hadCache) setIsLoading(false)
              return
            }
          } catch (e) {
            // ignore detection errors and continue
          }
          try { setIsAuthenticated(true); setReauthRequired(false) } catch (e) {}
          console.log('[DEBUG refreshExternal] got JSON response:', { 
            hasError: !!j?.error, 
            hasTimetable: !!j?.timetable,
            isHoliday: j?.isHoliday,
            noTimetable: j?.noTimetable,
            source: j?.source,
            keys: Object.keys(j || {})
          })
          // Compute a lightweight hash for this payload and try to reuse
          // any previously-processed result stored under that hash. This
          // allows the UI to show a fully-processed timetable instantly
          // while we optionally refresh in the background.
          let _payloadHash: string | null = null
          try {
            _payloadHash = computePayloadHash(j)
          } catch (e) { _payloadHash = null }
          // If the live payload explicitly indicates there is no timetable,
          // treat that as authoritative and do not reuse any previously-
          // cached processed payload for this hash. This prevents showing
          // cached classes during school holidays when the upstream has
          // reported an empty timetable for the requested date.
          try {
            if (payloadHasNoTimetable(j)) {
              try {
                const computed = buildBellTimesFromPayload(j)
                // ...existing code...
              } catch (e) {
                // ignore
              }
              // Do NOT set externalTimetable to emptyByDay here.
              // This allows fallback to term timetable.
              setTimetableSource('external-empty')
              try { setLastFetchedDate((new Date()).toISOString().slice(0,10)); setLastFetchedPayloadSummary({ error: j.error ?? 'no timetable' }) } catch (e) {}
              try { setIsRefreshing(false) } catch (e) {}
              if (!hadCache) try { setIsLoading(false) } catch (e) {}
              return
            }
          } catch (e) {}
          if (_payloadHash && typeof window !== 'undefined') {
            try {
              const cached = localStorage.getItem(`synchron-processed-${_payloadHash}`)
              if (cached) {
                const parsedCache = JSON.parse(cached)
                if (parsedCache && parsedCache.timetable) {
                  try {
                    // Attach any available long titles from the cached payload
                    try {
                      const subjectsMap = parsedCache.subjects || parsedCache.timetable?.subjects || parsedCache.upstream?.subjects || parsedCache.upstream?.day?.timetable?.subjects || parsedCache.upstream?.full?.subjects || null
                      if (subjectsMap && typeof subjectsMap === 'object') {
                        const shortToTitle: Record<string, string> = {}
                        for (const k of Object.keys(subjectsMap)) {
                          try {
                            const v = subjectsMap[k]
                            const short = (v && (v.shortTitle || v.short_title || v.subject || v.short)) ? (v.shortTitle || v.short_title || v.subject || v.short) : null
                            const title = (v && (v.title || v.name || v.fullTitle)) ? (v.title || v.name || v.fullTitle) : null
                            if (short && title) shortToTitle[String(short).trim()] = String(title)
                          } catch (e) {}
                        }
                        for (const d of Object.keys(parsedCache.timetable)) {
                          try {
                            const arr = parsedCache.timetable[d] || []
                            for (const p of arr) {
                              try {
                                if (!p.title && p.subject && shortToTitle[p.subject]) p.title = shortToTitle[p.subject]
                              } catch (e) {}
                            }
                          } catch (e) {}
                        }
                      }
                    } catch (e) {}
                    setExternalTimetable(parsedCache.timetable)
                    setExternalTimetableByWeek(cleanTimetableByWeek(parsedCache.timetableByWeek) || null)
                    // Only restore cached bell times if we don't already have authoritative
                    // date-specific bells from /api/timetable
                    if (parsedCache.bellTimes && !authoritativeBellsDateRef.current) {
                      setExternalBellTimes(parsedCache.bellTimes)
                      lastSeenBellTimesRef.current = parsedCache.bellTimes
                      lastSeenBellTsRef.current = parsedCache.savedAt || Date.now()
                    }
                    setTimetableSource(parsedCache.source || 'external-cache')
                    if (parsedCache.weekType === 'A' || parsedCache.weekType === 'B') {
                      setExternalWeekType(parsedCache.weekType)
                      setCurrentWeek(parsedCache.weekType)
                    }
                    try { setLastFetchedDate((new Date()).toISOString().slice(0,10)); setLastFetchedPayloadSummary({ cached: true }) } catch (e) {}
                    try { setIsRefreshing(false) } catch (e) {}
                    // Only clear the global loading flag if we previously set it
                    // because there was no cache. Otherwise keep showing the
                    // cached UI while the live refresh continues.
                    if (!hadCache) setIsLoading(false)
                    return
                  } catch (e) {
                    // fallthrough to normal processing
                  }
                }
              }
            } catch (e) {
              // ignore cache errors
            }
          }
              if (j && j.timetable) {
            if (payloadHasNoTimetable(j)) {
              // Even when the payload reports "no timetable", try to
              // salvage any bell schedules the server may have provided
              // ...existing code...
              try {
                const computed = buildBellTimesFromPayload(j)
                // ...existing code...
              } catch (e) {
                // ignore extraction errors and preserve any previously-seen bells
              }
              // Do NOT clear timetable - allow fallback
              setTimetableSource('external-empty')
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
                // If the upstream payload includes a specific day/date (e.g.
                // `upstream.day.date` or similar), attach that date to any
                // extracted variations that lack an explicit `date` so they
                // are applied only to that calendar day instead of being
                // treated as generic substitutions across both Week A/B.
                try {
                  const payloadDate = extractDateFromPayload(j.upstream || j)
                  if (payloadDate && Array.isArray(subs)) {
                    subs.forEach((s: any) => {
                      try { if (s && !s.date) s.date = payloadDate } catch (e) {}
                    })
                  }
                } catch (e) {}
                if (Array.isArray(subs) && subs.length) {
                    try {
                      try { console.debug('[timetable.provider] applying substitutions from homepage payload', subs.length) } catch (e) {}
                      // Apply all substitutions (date-specific + generic) to the
                      // per-day timetable so the daily view reflects exact dates.
                      finalTimetable = applySubstitutionsToTimetable(j.timetable, subs, { debug: true })
                      let appliedCount = 0
                      try {
                        for (const d of Object.keys(finalTimetable)) {
                          for (const p of finalTimetable[d] || []) if ((p as any).isSubstitute) appliedCount++
                        }
                      } catch (e) {}
                      try { console.debug('[timetable.provider] homepage substitutions applied, count=', appliedCount) } catch (e) {}
                    } catch (e) { try { console.debug('[timetable.provider] homepage substitution apply error', e) } catch (err) {} }

                    // CRITICAL: Substitutions are DATE-SPECIFIC only - they should NEVER be applied
                    // to timetableByWeek (the week-organized structure) to avoid carrying them over
                    // to the wrong week type. The timetableByWeek structure should remain pristine
                    // without any substitutions applied to it.
                    
                    if (j.timetableByWeek) {
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
                        
                        // CRITICAL FIX: Also copy date-specific variations directly from finalTimetable
                        // Since finalTimetable already has variations applied (including date-specific ones),
                        // we need to preserve those flags in the grouped structure.
                        // Check each period in finalTimetable and if it has variation flags, copy them to the
                        // corresponding period in the grouped structure.
                        try {
                          const weekType = j.weekType as ('A' | 'B' | null)
                          if (weekType === 'A' || weekType === 'B') {
                            for (const day of Object.keys(finalTimetable)) {
                              const flatPeriods = finalTimetable[day] || []
                              const groupedPeriods = transformed[day]?.[weekType] || []
                              
                              for (const flatP of flatPeriods) {
                                // Find matching period in grouped structure
                                const match = groupedPeriods.find((gp: any) => 
                                  String(gp.period).trim().toLowerCase() === String(flatP.period).trim().toLowerCase() &&
                                  String(gp.subject || '').trim().toLowerCase() === String(flatP.subject || '').trim().toLowerCase()
                                )
                                
                                if (match) {
                                  // Copy variation flags from flat to grouped
                                  if ((flatP as any).isSubstitute) {
                                    (match as any).isSubstitute = true
                                    if ((flatP as any).casualSurname) (match as any).casualSurname = (flatP as any).casualSurname
                                    if ((flatP as any).displayTeacher) (match as any).displayTeacher = (flatP as any).displayTeacher
                                    if ((flatP as any).originalTeacher) (match as any).originalTeacher = (flatP as any).originalTeacher
                                  }
                                  if ((flatP as any).isRoomChange) {
                                    (match as any).isRoomChange = true
                                    if ((flatP as any).displayRoom) (match as any).displayRoom = (flatP as any).displayRoom
                                    if ((flatP as any).originalRoom) (match as any).originalRoom = (flatP as any).originalRoom
                                  }
                                }
                              }
                            }
                          }
                        } catch (e) {
                          console.error('[timetable.provider] Error copying variations to grouped structure:', e)
                        }

                        finalByWeek = transformed
                      } catch (e) {
                        // ignore by-week copying errors
                      }
                    }
                  }
              } catch (e) {
                // ignore substitution errors
              }
              
              console.warn('🔴 [SUBS-DEBUG] refreshExternal: About to return from homepage payload. Checking finalByWeek...')
              if (finalByWeek) {
                for (const day of Object.keys(finalByWeek)) {
                  const groups = (finalByWeek as any)[day]
                  for (const weekKey of ['A', 'B', 'unknown']) {
                    const periodVars = (groups[weekKey] || []).filter((p: any) => p.isSubstitute || p.isRoomChange)
                    if (periodVars.length > 0) {
                      console.warn(`🔴 [SUBS-DEBUG] refreshExternal: finalByWeek[${day}][${weekKey}] HAS ${periodVars.length} substitutions!`, periodVars.map((p: any) => ({ period: p.period, sub: p.casualSurname || p.displayTeacher })))
                    }
                  }
                }
              }
              
              // Attach long subject titles when available in the upstream payload
              try {
                const subjectsSource = j.subjects || j.timetable?.subjects || j.upstream?.subjects || j.upstream?.day?.timetable?.subjects || j.upstream?.full?.subjects || j.diagnostics?.upstream?.full?.subjects || j.diagnostics?.upstream?.day?.timetable?.subjects || null
                if (subjectsSource && typeof subjectsSource === 'object') {
                  const shortToTitle: Record<string, string> = {}
                  for (const k of Object.keys(subjectsSource)) {
                    try {
                      const v = subjectsSource[k]
                      const short = (v && (v.shortTitle || v.short_title || v.subject || v.short)) ? (v.shortTitle || v.short_title || v.subject || v.short) : null
                      const title = (v && (v.title || v.name || v.fullTeacher || v.fullTitle)) ? (v.title || v.name || v.fullTeacher || v.fullTitle) : null
                      if (short && title) shortToTitle[String(short).trim()] = String(title)
                    } catch (e) {}
                  }
                  for (const d of Object.keys(finalTimetable)) {
                    try {
                      const arr = finalTimetable[d] || []
                      for (const p of arr) {
                        try {
                          if (!p.title && p.subject && shortToTitle[p.subject]) p.title = shortToTitle[p.subject]
                        } catch (e) {}
                      }
                    } catch (e) {}
                  }
                  if (finalByWeek) {
                    for (const d of Object.keys(finalByWeek)) {
                      try {
                        const groups = finalByWeek[d]
                        for (const weekKey of ['A','B','unknown']) {
                          try {
                            const arr = (groups as any)[weekKey] || []
                            for (const p of arr) {
                              try { if (!p.title && p.subject && shortToTitle[p.subject]) p.title = shortToTitle[p.subject] } catch (e) {}
                            }
                          } catch (e) {}
                        }
                      } catch (e) {}
                    }
                  }
                }
              } catch (e) {}

              // If the payload explicitly reports a week type, set it first
              // so downstream rendering logic that prefers `timetableByWeek`
              // can compute using the correct `currentWeek` immediately
              // (prevents a transient render with the wrong week selection).
              // Use startTransition to batch ALL related state updates atomically
              // to prevent visual flashing during hydration
              // Persist the processed result keyed by payload-hash so future
              // loads can reuse the fully-applied timetable without re-extraction.
              try {
                if (_payloadHash && typeof window !== 'undefined') {
                  try {
                    const persisted = {
                      timetable: finalTimetable,
                      timetableByWeek: finalByWeek || null,
                      bellTimes: j.bellTimes || buildBellTimesFromPayload(j) || null,
                      subjects: j.subjects || j.timetable?.subjects || j.upstream?.subjects || j.upstream?.day?.timetable?.subjects || j.upstream?.full?.subjects || j.diagnostics?.upstream?.full?.subjects || j.diagnostics?.upstream?.day?.timetable?.subjects || null,
                      source: j.source ?? 'external',
                      weekType: j.weekType ?? null,
                      savedAt: Date.now(),
                    }
                    localStorage.setItem(`synchron-processed-${_payloadHash}`, JSON.stringify(persisted))
                    try { console.debug('[timetable.provider] cached processed payload', _payloadHash) } catch (e) {}
                  } catch (e) {
                    // ignore storage errors
                  }
                }
              } catch (e) {}
              // Compute summary before transitioning to avoid closure issues
              let fetchSummary: { weekType: string | null; counts: { A: number; B: number; unknown: number } | null } | null = null
              try {
                const dayName = (new Date()).toLocaleDateString('en-US', { weekday: 'long' })
                fetchSummary = {
                  weekType: j.weekType ?? null,
                  counts: j.timetableByWeek && j.timetableByWeek[dayName]
                    ? { A: j.timetableByWeek[dayName].A?.length || 0, B: j.timetableByWeek[dayName].B?.length || 0, unknown: j.timetableByWeek[dayName].unknown?.length || 0 }
                    : null,
                }
              } catch (e) {}
              
              const computedSource = j.source ?? 'external'
              // Use the actual date we fetched for, not the current date
              const computedDate = todayDateStr
              try {
                const selIso = selectedDateObjectRef.current ? selectedDateObjectRef.current.toISOString().slice(0,10) : null
                const isOfflineNow = (typeof navigator !== 'undefined') ? (navigator.onLine === false) : false
                // CRITICAL FIX: Disable withholding logic here too.
                if (false && !selectedDateCalendarChecked && selIso && computedDate && selIso === computedDate && !isOfflineNow) {
                  try { console.debug('[timetable.provider] withholding fetched timetable (processed payload) until per-date calendar check completes', { computedDate, selIso }) } catch (e) {}
                  setIsRefreshing(false)
                } else {
                  // CRITICAL: Set the date ref BEFORE startTransition so it's available to useEffect immediately
                  externalTimetableDateRef.current = computedDate

                  // If we have authoritative variations captured for this date (or the selected date),
                  // merge them into the finalTimetable to avoid flashes where a subsequent
                  // render would otherwise overwrite substitutions with raw data.
                  try {
                    const authMap = authoritativeVariationsRef.current
                    const selIso = selectedDateObjectRef.current ? selectedDateObjectRef.current.toISOString().slice(0,10) : null
                    const candidateDates = [computedDate, externalTimetableDateRef.current, selIso, new Date().toISOString().slice(0,10)].filter(Boolean) as string[]
                    let authForDate: any = null
                    for (const dk of candidateDates) { authForDate = authMap.get(dk); if (authForDate) break }
                    if (authForDate && typeof authForDate === 'object') {
                      for (const dayKey of Object.keys(authForDate)) {
                        const dayVars = authForDate[dayKey] || []
                        const dayPeriods = (finalTimetable as any)[dayKey] || []
                        for (const v of dayVars) {
                          try {
                            if (!v || !v.period) continue
                            const norm = String(v.period).trim().toLowerCase()
                            const idx = dayPeriods.findIndex((p: any) => String(p.period).trim().toLowerCase() === norm)
                            if (idx >= 0) {
                              const period = dayPeriods[idx]
                              if (v.isSubstitute) {
                                (period as any).isSubstitute = true
                                if (v.casualSurname) (period as any).casualSurname = v.casualSurname
                                if (v.displayTeacher) (period as any).displayTeacher = v.displayTeacher
                                if (v.originalTeacher) (period as any).originalTeacher = v.originalTeacher
                              }
                              if (v.isRoomChange) {
                                (period as any).isRoomChange = true
                                if (v.displayRoom) (period as any).displayRoom = v.displayRoom
                                if (v.originalRoom) (period as any).originalRoom = v.originalRoom
                              }
                            }
                          } catch (e) {}
                        }
                      }
                      try { console.debug('[timetable.provider] merged authoritative variations into fetched processed payload for', computedDate) } catch (e) {}
                    }
                  } catch (e) {}

                  startTransition(() => {
                    if (j.weekType === 'A' || j.weekType === 'B') {
                      setExternalWeekType(j.weekType)
                      setCurrentWeek(j.weekType)
                    }
                    if (finalByWeek) setExternalTimetableByWeek(cleanTimetableByWeek(finalByWeek))
                    setExternalTimetable(finalTimetable)
                    setTimetableSource(computedSource)
                    setLastFetchedDate(computedDate)
                    if (fetchSummary) setLastFetchedPayloadSummary(fetchSummary)
                    // Clear loading indicator as soon as we have valid data
                    setIsRefreshing(false)
                  })
                }
              } catch (e) {
                // If guard check fails for any reason, apply normally to avoid leaving UI stuck
                startTransition(() => {
                  if (j.weekType === 'A' || j.weekType === 'B') {
                    setExternalWeekType(j.weekType)
                    setCurrentWeek(j.weekType)
                  }
                  if (finalByWeek) setExternalTimetableByWeek(cleanTimetableByWeek(finalByWeek))
                  externalTimetableDateRef.current = computedDate
                  setExternalTimetable(finalTimetable)
                  setTimetableSource(computedSource)
                  setLastFetchedDate(computedDate)
                  if (fetchSummary) setLastFetchedPayloadSummary(fetchSummary)
                  setIsRefreshing(false)
                })
              }
              // Note: do not override provider-selected date here. The
              // `selectedDateObject` is driven by user choice and time-based
              // auto-selection logic; forcing it from a general `/api/timetable`
              // response can produce surprising results (e.g. showing Monday
              // when the user expects today). If a date-affine fetch was
              // performed specifically for a requested date, that code path
              // (fetch-for-date) will handle aligning the provider date.
              // (weekType already set above if present)
              return
            }
            if (Array.isArray(j.timetable)) {
              let byDay: Record<string, Period[]> = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] }
              for (const p of j.timetable) {
                const day = p.day || p.weekday || 'Monday'
                if (!byDay[day]) byDay[day] = []
                byDay[day].push(p)
              }
              
              // Extract and apply substitutions to array-shaped payload
              try {
                const subs = PortalScraper.extractVariationsFromJson(j.upstream || j)
                try {
                  const payloadDate = extractDateFromPayload(j.upstream || j)
                  if (payloadDate && Array.isArray(subs)) {
                    subs.forEach((s: any) => {
                      try { if (s && !s.date) s.date = payloadDate } catch (e) {}
                    })
                  }
                } catch (e) {}
                if (Array.isArray(subs) && subs.length) {
                  try {
                    console.debug('[timetable.provider] applying substitutions to array payload', subs.length)
                    byDay = applySubstitutionsToTimetable(byDay, subs, { debug: true })
                  } catch (e) {
                    console.debug('[timetable.provider] array substitution apply error', e)
                  }
                }
              } catch (e) {
                // ignore substitution extraction errors
              }
              
              // Attach long titles from subjects mapping if available
              try {
                const subjectsSource = j.subjects || j.timetable?.subjects || j.upstream?.subjects || j.upstream?.day?.timetable?.subjects || j.upstream?.full?.subjects || null
                if (subjectsSource && typeof subjectsSource === 'object') {
                  const shortToTitle: Record<string, string> = {}
                  for (const k of Object.keys(subjectsSource)) {
                    try {
                      const v = subjectsSource[k]
                      const short = (v && (v.shortTitle || v.short_title || v.subject || v.short)) ? (v.shortTitle || v.short_title || v.subject || v.short) : null
                      const title = (v && (v.title || v.name)) ? (v.title || v.name) : null
                      if (short && title) shortToTitle[String(short).trim()] = String(title)
                    } catch (e) {}
                  }
                  for (const d of Object.keys(byDay)) {
                    try {
                      for (const p of byDay[d]) {
                        try { if (!(p as any).title && p.subject && shortToTitle[p.subject]) (p as any).title = shortToTitle[p.subject] } catch (e) {}
                      }
                    } catch (e) {}
                  }
                }
              } catch (e) {}

              // Also persist processed result for array-shaped payloads
              try {
                if (_payloadHash && typeof window !== 'undefined') {
                  try {
                    const persisted = {
                      timetable: byDay,
                      timetableByWeek: null,
                      bellTimes: j.bellTimes || buildBellTimesFromPayload(j) || null,
                      subjects: j.subjects || j.timetable?.subjects || j.upstream?.subjects || j.upstream?.day?.timetable?.subjects || j.upstream?.full?.subjects || null,
                      source: j.source ?? 'external',
                      weekType: j.weekType ?? null,
                      savedAt: Date.now(),
                    }
                    localStorage.setItem(`synchron-processed-${_payloadHash}`, JSON.stringify(persisted))
                    try { console.debug('[timetable.provider] cached processed (array) payload', _payloadHash) } catch (e) {}
                  } catch (e) {}
                }
              } catch (e) {}
              const computedSourceArr = j.source ?? 'external'
              // Intentionally not overriding `selectedDateObject` here for
              // the reasons described above.
              // Batch all related state updates atomically
              try {
                const payloadDate = extractDateFromPayload(j.upstream || j) || null
                const selIso = selectedDateObjectRef.current ? selectedDateObjectRef.current.toISOString().slice(0,10) : null
                const isOfflineNow = (typeof navigator !== 'undefined') ? (navigator.onLine === false) : false
                
                // CRITICAL FIX: Do NOT withhold data if we have a valid payload, even if calendar check is pending.
                // The withholding logic was causing valid backfilled data for past dates to be ignored
                // because selectedDateCalendarChecked was false (since we don't check calendar for past dates in the same way).
                if (false && payloadDate && !selectedDateCalendarChecked && selIso && payloadDate === selIso && !isOfflineNow) {
                  try { console.debug('[timetable.provider] withholding fetched timetable (array path) until per-date calendar check completes', { payloadDate, selIso }) } catch (e) {}
                  setIsRefreshing(false)
                } else {
                  // Merge authoritative variations for the target date BEFORE updating state
                  try {
                    const authMap = authoritativeVariationsRef.current
                    const dateKeyForCache = payloadDate || todayDateStr
                    const selIso = selectedDateObjectRef.current ? selectedDateObjectRef.current.toISOString().slice(0,10) : null
                    const candidateDates = [dateKeyForCache, externalTimetableDateRef.current, selIso, new Date().toISOString().slice(0,10)].filter(Boolean) as string[]
                    let authForDate: any = null
                    for (const dk of candidateDates) { authForDate = authMap.get(dk); if (authForDate) break }
                    if (authForDate && typeof authForDate === 'object') {
                      for (const dayKey of Object.keys(authForDate)) {
                        const dayVars = authForDate[dayKey] || []
                        const dayPeriods = byDay[dayKey] || []
                        for (const v of dayVars) {
                          try {
                            if (!v || !v.period) continue
                            const norm = String(v.period).trim().toLowerCase()
                            const idx = dayPeriods.findIndex((p: any) => String(p.period).trim().toLowerCase() === norm)
                            if (idx >= 0) {
                              const period = dayPeriods[idx]
                              if (v.isSubstitute) {
                                (period as any).isSubstitute = true
                                if (v.casualSurname) (period as any).casualSurname = v.casualSurname
                                if (v.displayTeacher) (period as any).displayTeacher = v.displayTeacher
                                if (v.originalTeacher) (period as any).originalTeacher = v.originalTeacher
                              }
                              if (v.isRoomChange) {
                                (period as any).isRoomChange = true
                                if (v.displayRoom) (period as any).displayRoom = v.displayRoom
                                if (v.originalRoom) (period as any).originalRoom = v.originalRoom
                              }
                            }
                          } catch (e) {}
                        }
                      }
                      try { console.debug('[timetable.provider] merged authoritative variations (array path) for', dateKeyForCache) } catch (e) {}
                    }
                  } catch (e) {}

                  startTransition(() => {
                    setExternalTimetable(byDay)
                    setTimetableSource(computedSourceArr)
                    if (j.weekType === 'A' || j.weekType === 'B') {
                      setExternalWeekType(j.weekType)
                      setCurrentWeek(j.weekType)
                    }
                    setIsRefreshing(false)
                  })
                }
              } catch (e) {
                startTransition(() => {
                  setExternalTimetable(byDay)
                  setTimetableSource(computedSourceArr)
                  if (j.weekType === 'A' || j.weekType === 'B') {
                    setExternalWeekType(j.weekType)
                    setCurrentWeek(j.weekType)
                  }
                  setIsRefreshing(false)
                })
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
            // Batch state updates for scraped HTML data
            startTransition(() => {
              setExternalTimetable(parsed)
              setTimetableSource('external-scraped')
              // Clear loading indicator as soon as we have valid data
              setIsRefreshing(false)
            })
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
      // short handshake delay ΓÇö reduced for snappier background refreshes
      await new Promise((res) => setTimeout(res, 300))

      try {
        // Use the same date as the first fetch - which now respects selectedDateObject
        // This ensures retry doesn't fetch for a different date than what the user is viewing
        // Recalculate using the ref since we're in a different try block
        const currentSelectedDate2 = selectedDateObjectRef.current
        let fetchDate2: Date
        if (currentSelectedDate2) {
          fetchDate2 = currentSelectedDate2
        } else {
          const now2 = new Date()
          const dow2 = now2.getDay()
          if (dow2 === 0 || dow2 === 6) {
            fetchDate2 = getNextSchoolDay(now2)
          } else if (isSchoolDayOver()) {
            fetchDate2 = getNextSchoolDay(now2)
          } else {
            fetchDate2 = now2
          }
        }
        const todayDateStr2 = fetchDate2.toISOString().slice(0, 10)
        // Check calendar on retry fetch as well
        try {
          try {
            const calRes2 = await fetch(`/api/calendar?endpoint=days&from=${encodeURIComponent(todayDateStr2)}&to=${encodeURIComponent(todayDateStr2)}`, { credentials: 'include' })
            const cctype2 = calRes2.headers.get('content-type') || ''
            if (calRes2.ok && cctype2.includes('application/json')) {
              const calJson2 = await calRes2.json()
              let dayInfo2: any = null
              if (Array.isArray(calJson2) && calJson2.length) dayInfo2 = calJson2[0]
              else if (calJson2 && typeof calJson2 === 'object' && calJson2[todayDateStr2]) dayInfo2 = calJson2[todayDateStr2]
              else if (calJson2 && typeof calJson2 === 'object') {
                for (const k of Object.keys(calJson2)) {
                  const v = calJson2[k]
                  if (v && (v.date === todayDateStr2 || String(k) === todayDateStr2)) { dayInfo2 = v; break }
                }
              }
              const isHolidayCal2 = Boolean(
                dayInfo2 && (
                  dayInfo2.isHoliday === true ||
                  dayInfo2.holiday === true ||
                  String(dayInfo2.is_school_day).toLowerCase() === 'false' ||
                  String(dayInfo2.status).toLowerCase().includes('holiday') ||
                  String(dayInfo2.type || '').toLowerCase().includes('holiday') ||
                  String(dayInfo2.dayType || '').toLowerCase().includes('holiday')
                )
              )
              if (isHolidayCal2) {
                holidayDateRef.current = true
                try { setSelectedDateIsHoliday(true) } catch (e) {}
                try { setCacheHydrated(false) } catch (e) {}
                
                // Do NOT clear timetable cache on holidays
                
                if (!cancelled) {
                  setTimetableSource('calendar-holiday')
                  setExternalWeekType(null)
                  try { setLastFetchedDate(todayDateStr2); setLastFetchedPayloadSummary({ holiday: true, source: 'calendar' }) } catch (e) {}
                }
                setIsRefreshing(false)
                if (!hadCache) setIsLoading(false)
                return
              }
            }
          } catch (e) {
            // ignore calendar errors and continue to timetable fetch
          }
        } catch (e) {}
        const r2 = await fetch(`/api/timetable?date=${encodeURIComponent(todayDateStr2)}`, { credentials: 'include', cache: 'no-store', headers: { 'pragma': 'no-cache', 'cache-control': 'no-cache' } })
        if (r2.status === 401) {
          try { await extractBellTimesFromResponse(r2) } catch (e) {}
          if (!attemptedRefresh) {
            try {
              const rr = await fetch('/api/auth/refresh', { credentials: 'include' })
              if (!rr || !rr.ok) {
                try { toast({ title: 'Session expired', description: 'Please sign in again.' }) } catch (e) {}
                try { setIsAuthenticated(false) } catch (e) {}
                try { setReauthRequired(true) } catch (e) {}
                // Refresh failed, don't retry - just bail out
                return
              }
            } catch (e) {
              try { toast({ title: 'Session expired', description: 'Please sign in again.' }) } catch (e) {}
              try { setReauthRequired(true) } catch (err) {}
              // Refresh failed, don't retry - just bail out
              return
            }
            // Refresh succeeded, retry the timetable fetch
            return refreshExternal(true)
          } else {
            // Already attempted refresh and still got 401 - give up
            try { setReauthRequired(true) } catch (e) {}
            return
          }
        }
        const rctype2 = r2.headers.get('content-type') || ''
        if (rctype2.includes('application/json')) {
          const j = await r2.json()
          try { setIsAuthenticated(true); setReauthRequired(false) } catch (e) {}
          if (j == null) return
          if (payloadHasNoTimetable(j)) {
            try {
              const computed = buildBellTimesFromPayload(j)
              const finalBellTimes: Record<string, any[]> = { 'Mon/Tues': [], 'Wed/Thurs': [], 'Fri': [] }
              const src = j.bellTimes || {}
              for (const k of ['Mon/Tues', 'Wed/Thurs', 'Fri']) {
                if (src[k] && Array.isArray(src[k]) && src[k].length) finalBellTimes[k] = src[k]
                else if (computed[k] && Array.isArray(computed[k]) && computed[k].length) finalBellTimes[k] = computed[k]
                else if (lastSeenBellTimesRef.current && lastSeenBellTimesRef.current[k] && lastSeenBellTimesRef.current[k].length) finalBellTimes[k] = lastSeenBellTimesRef.current[k]
                else finalBellTimes[k] = []
              }
              const hasAny = Object.values(finalBellTimes).some((arr) => Array.isArray(arr) && arr.length > 0)
              // Only update bells if we don't already have authoritative date-specific ones
              if (hasAny && !authoritativeBellsDateRef.current) {
                setExternalBellTimes(finalBellTimes)
                lastSeenBellTimesRef.current = finalBellTimes
                lastSeenBellTsRef.current = Date.now()
              }
            } catch (e) {
              // ignore
            }
            // Do NOT clear persisted timetable cache to avoid flashing empty state 
            // when the server returns an empty payload (e.g. during holidays).

            setTimetableSource('external-empty')
            setExternalWeekType(null)
            try {
              setLastFetchedDate((new Date()).toISOString().slice(0,10))
              setLastFetchedPayloadSummary({ error: j.error ?? 'no timetable' })
            } catch (e) {}
            return
          }

          if (typeof j.timetable === 'object' && !Array.isArray(j.timetable)) {
            // If the payload reports a week type, set it immediately so that
            // any `timetableByWeek` application happens with the correct
            // `currentWeek` value and avoids temporary incorrect renders.
            if (j.weekType === 'A' || j.weekType === 'B') {
              setExternalWeekType(j.weekType)
              setCurrentWeek(j.weekType)
            }
            // CRITICAL FIX: Strip all variations from timetableByWeek before setting it
            if (j.timetableByWeek) {
              setExternalTimetableByWeek(cleanTimetableByWeek(j.timetableByWeek) || null)
            }
            if (j.bellTimes || j.upstream) {
              try {
                const computed = buildBellTimesFromPayload(j)
                const finalBellTimes: Record<string, any[]> = { 'Mon/Tues': [], 'Wed/Thurs': [], 'Fri': [] }
                const src = j.bellTimes || {}
                const existingBells = lastSeenBellTimesRef.current || externalBellTimes || {}
                for (const k of ['Mon/Tues', 'Wed/Thurs', 'Fri']) {
                  if (src[k] && Array.isArray(src[k]) && src[k].length) finalBellTimes[k] = src[k]
                  else if (computed[k] && Array.isArray(computed[k]) && computed[k].length) finalBellTimes[k] = computed[k]
                  // Preserve existing bell times for sectors not in the new response
                  else if (existingBells[k] && Array.isArray(existingBells[k]) && existingBells[k].length) finalBellTimes[k] = existingBells[k]
                  else finalBellTimes[k] = []
                }
                const hasAny = Object.values(finalBellTimes).some((arr) => Array.isArray(arr) && arr.length > 0)
                if (hasAny || !lastSeenBellTimesRef.current) {
                  try { console.log('[timetable.provider] setExternalBellTimes (merged retry)', finalBellTimes) } catch (e) {}
                  setExternalBellTimes(finalBellTimes)
                  lastSeenBellTimesRef.current = finalBellTimes
                  lastSeenBellTsRef.current = Date.now()
                  // Mark as authoritative since this is from /api/timetable
                  authoritativeBellsDateRef.current = (new Date()).toISOString().slice(0,10)
                } else {
                  try { console.log('[timetable.provider] skipping empty external bellTimes merge (retry)') } catch (e) {}
                }
              } catch (e) {
                if (j.bellTimes && Object.values(j.bellTimes).some((arr: any) => Array.isArray(arr) && arr.length > 0)) {
                  try { console.log('[timetable.provider] setExternalBellTimes (raw retry)', j.bellTimes) } catch (e) {}
                  // Merge with existing bell times to preserve all sectors
                  const mergedBellTimes: Record<string, any[]> = { 'Mon/Tues': [], 'Wed/Thurs': [], 'Fri': [] }
                  const existingBells = lastSeenBellTimesRef.current || externalBellTimes || {}
                  for (const k of ['Mon/Tues', 'Wed/Thurs', 'Fri']) {
                    if (j.bellTimes[k] && Array.isArray(j.bellTimes[k]) && j.bellTimes[k].length) mergedBellTimes[k] = j.bellTimes[k]
                    else if (existingBells[k] && Array.isArray(existingBells[k]) && existingBells[k].length) mergedBellTimes[k] = existingBells[k]
                  }
                  setExternalBellTimes(mergedBellTimes)
                  lastSeenBellTimesRef.current = mergedBellTimes
                  lastSeenBellTsRef.current = Date.now()
                  // Mark as authoritative since this is from /api/timetable
                  authoritativeBellsDateRef.current = (new Date()).toISOString().slice(0,10)
                }
              }
            }
            
            // Extract and apply substitutions (same logic as first fetch path)
            let finalTimetable = j.timetable
            try {
              const subs = PortalScraper.extractVariationsFromJson(j.upstream || j)
              try {
                const payloadDate = extractDateFromPayload(j.upstream || j)
                if (payloadDate && Array.isArray(subs)) {
                  subs.forEach((s: any) => {
                    try { if (s && !s.date) s.date = payloadDate } catch (e) {}
                  })
                }
              } catch (e) {}
              if (Array.isArray(subs) && subs.length) {
                try {
                  console.debug('[timetable.provider] applying substitutions from retry path', subs.length)
                  finalTimetable = applySubstitutionsToTimetable(j.timetable, subs, { debug: true })
                } catch (e) {
                  console.debug('[timetable.provider] retry substitution apply error', e)
                }
              }
            } catch (e) {
              // ignore substitution extraction errors
            }
            
            // Compute summary before transitioning
            let retrySummary: { weekType: string | null; hasByWeek: boolean } | null = null
            // Use the date we actually fetched for, not the current date
            const retryDate = todayDateStr2
            try {
              retrySummary = { weekType: j.weekType ?? null, hasByWeek: !!j.timetableByWeek }
            } catch (e) {}
            // Use startTransition to batch ALL updates and prevent flash
            try {
              const selIso = selectedDateObjectRef.current ? selectedDateObjectRef.current.toISOString().slice(0,10) : null
              const isOfflineNow = (typeof navigator !== 'undefined') ? (navigator.onLine === false) : false
              // CRITICAL FIX: Disable withholding logic here too.
              if (false && retryDate && !selectedDateCalendarChecked && selIso && retryDate === selIso && !isOfflineNow) {
                try { console.debug('[timetable.provider] withholding fetched timetable (retry path) until per-date calendar check completes', { retryDate, selIso }) } catch (e) {}
                setIsRefreshing(false)
              } else {
                // CRITICAL: Set the date ref BEFORE startTransition
                if (retryDate) externalTimetableDateRef.current = retryDate
                
                startTransition(() => {
                  setExternalTimetable(finalTimetable)
                  setTimetableSource(j.source ?? 'external')
                  if (j.weekType === 'A' || j.weekType === 'B') {
                    setExternalWeekType(j.weekType)
                    setCurrentWeek(j.weekType)
                  }
                  if (retryDate) setLastFetchedDate(retryDate)
                  if (retrySummary) setLastFetchedPayloadSummary(retrySummary)
                  // Clear loading indicator as soon as we have valid data
                  setIsRefreshing(false)
                })
              }
            } catch (e) {
              // CRITICAL: Set the date ref BEFORE startTransition
              if (retryDate) externalTimetableDateRef.current = retryDate
              
              startTransition(() => {
                setExternalTimetable(finalTimetable)
                setTimetableSource(j.source ?? 'external')
                if (j.weekType === 'A' || j.weekType === 'B') {
                  setExternalWeekType(j.weekType)
                  setCurrentWeek(j.weekType)
                }
                if (retryDate) setLastFetchedDate(retryDate)
                if (retrySummary) setLastFetchedPayloadSummary(retrySummary)
                setIsRefreshing(false)
              })
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
            
            // Extract and apply substitutions
            let finalTimetable = byDay
            try {
              const subs = PortalScraper.extractVariationsFromJson(j.upstream || j)
              try {
                const payloadDate = extractDateFromPayload(j.upstream || j)
                if (payloadDate && Array.isArray(subs)) {
                  subs.forEach((s: any) => {
                    try { if (s && !s.date) s.date = payloadDate } catch (e) {}
                  })
                }
              } catch (e) {}
              if (Array.isArray(subs) && subs.length) {
                try {
                  console.debug('[timetable.provider] applying substitutions from array retry path', subs.length)
                  finalTimetable = applySubstitutionsToTimetable(byDay, subs, { debug: true })
                } catch (e) {
                  console.debug('[timetable.provider] array retry substitution apply error', e)
                }
              }
            } catch (e) {
              // ignore substitution extraction errors
            }
            
            // CRITICAL: Set the date ref BEFORE startTransition
            externalTimetableDateRef.current = todayDateStr2
            
            // Use startTransition to batch updates and prevent flash
            startTransition(() => {
              setExternalTimetable(finalTimetable)
              setTimetableSource(j.source ?? 'external')
              if (j.weekType === 'A' || j.weekType === 'B') {
                setExternalWeekType(j.weekType)
                setCurrentWeek(j.weekType)
              }
              // Clear loading indicator as soon as we have valid data
              setIsRefreshing(false)
            })
            return
          }
        }
        if (rctype2.includes('text/html')) {
          const text = await r2.text()
          const parsed = parseTimetableHtmlLocal(text)
          const hasData = Object.values(parsed).some((arr) => arr.length > 0)
          if (hasData) {
            // Batch state updates for scraped HTML after retry
            // Merge authoritative variations for todayDateStr2 BEFORE updating state
            try {
              const authMap = authoritativeVariationsRef.current
              const selIso = selectedDateObjectRef.current ? selectedDateObjectRef.current.toISOString().slice(0,10) : null
              const candidateDates = [todayDateStr2, externalTimetableDateRef.current, selIso, new Date().toISOString().slice(0,10)].filter(Boolean) as string[]
              let authForDate: any = null
              for (const dk of candidateDates) { authForDate = authMap.get(dk); if (authForDate) break }
              if (authForDate && typeof authForDate === 'object') {
                for (const dayKey of Object.keys(authForDate)) {
                  const dayVars = authForDate[dayKey] || []
                  const dayPeriods = parsed[dayKey] || []
                  for (const v of dayVars) {
                    try {
                      if (!v || !v.period) continue
                      const norm = String(v.period).trim().toLowerCase()
                      const idx = dayPeriods.findIndex((p: any) => String(p.period).trim().toLowerCase() === norm)
                      if (idx >= 0) {
                        const period = dayPeriods[idx]
                        if (v.isSubstitute) {
                          (period as any).isSubstitute = true
                          if (v.casualSurname) (period as any).casualSurname = v.casualSurname
                          if (v.displayTeacher) (period as any).displayTeacher = v.displayTeacher
                          if (v.originalTeacher) (period as any).originalTeacher = v.originalTeacher
                        }
                        if (v.isRoomChange) {
                          (period as any).isRoomChange = true
                          if (v.displayRoom) (period as any).displayRoom = v.displayRoom
                          if (v.originalRoom) (period as any).originalRoom = v.originalRoom
                        }
                      }
                    } catch (e) {}
                  }
                }
                try { console.debug('[timetable.provider] merged authoritative variations (scraped retry) for', todayDateStr2) } catch (e) {}
              }
            } catch (e) {}

            startTransition(() => {
              setExternalTimetable(parsed)
              setTimetableSource('external-scraped')
              // Clear loading indicator as soon as we have valid data
              setIsRefreshing(false)
            })
            return
          }
        }
      } catch (e) {
        // ignore
      }

      // If we still don't have live data, fall back to cached timetable for
      // authenticated users. Do NOT clear previously-discovered
      // `externalBellTimes` here ΓÇö preserve bucket information so the UI
      // continues to follow API-derived break rows.
      try { console.log('[timetable.provider] falling back to sample timetable (refresh)') } catch (e) {}
      if (lastRecordedTimetable) {
        // Do not hydrate cached timetable during the initial calendar check
        // (to avoid flashing cached classes) unless we've already
        // intentionally hydrated cache or the client is offline.
        const isOffline = (typeof navigator !== 'undefined') ? (navigator.onLine === false) : false
        if (initialCalendarChecked || cacheHydrated || isOffline) {
          // Prefer showing cached real data when available regardless of auth state.
          startTransition(() => {
            setExternalTimetable(lastRecordedTimetable)
            try { setCacheHydrated(true) } catch (e) {}
            setTimetableSource('cache')
            setError(null)
            // Clear loading indicator as soon as we have valid data
            setIsRefreshing(false)
          })
        }
      } else if (isAuthenticated) {
        startTransition(() => {
          // Don't clear externalTimetable if we have no new data - keep showing cached data
          if (!lastRecordedTimetable) {
            setExternalTimetable(null)
          }
          setTimetableSource('cache')
          setError(null)
          setIsRefreshing(false)
        })
      } else {
        // No cached data and auth unknown/false: keep showing cached data
        startTransition(() => {
          if (!lastRecordedTimetable) {
            setExternalTimetable(null)
          }
          setTimetableSource('cache')
          setError(null)
          setIsRefreshing(false)
        })
      }
    } catch (e) {
      try { console.log('[timetable.provider] failing back (refresh error)') } catch (e) {}
      if (lastRecordedTimetable) {
        const isOffline = (typeof navigator !== 'undefined') ? (navigator.onLine === false) : false
        if (initialCalendarChecked || cacheHydrated || isOffline) {
          startTransition(() => {
            setExternalTimetable(lastRecordedTimetable)
            try { setCacheHydrated(true) } catch (e) {}
            setTimetableSource('cache')
            setError(null)
            setIsRefreshing(false)
          })
        }
      } else if (isAuthenticated) {
        startTransition(() => {
          // Don't clear externalTimetable during errors - preserve cached data
          if (!lastRecordedTimetable) {
            setExternalTimetable(null)
          }
          setTimetableSource('cache')
          setError(null)
          setIsRefreshing(false)
        })
      } else {
        startTransition(() => {
          // Don't clear externalTimetable during errors - preserve cached data
          if (!lastRecordedTimetable) {
            setExternalTimetable(null)
          }
          setTimetableSource('cache')
          setError(null)
          setIsRefreshing(false)
        })
      }
    } finally {
      try { if (_t && typeof _t.end === 'function') _t.end() } catch (e) {}
      try { setIsRefreshing(false) } catch (e) {}
      // Remove debug listeners if present
      try {
        const h = refreshDebugHandlersRef.current
        if (h) {
          if (h.capture) document.removeEventListener('pointerdown', h.capture, true)
          if (h.bubble) document.removeEventListener('click', h.bubble, false)
          refreshDebugHandlersRef.current = null
          console.debug('[timetable.refresh.debug] removed debug listeners')
        }
      } catch (e) {}
      // Only clear the global loading flag if we initially showed it
      // because there was no cache; otherwise keep cached UI visible.
      try { if (!hadCache) setIsLoading(false) } catch (e) { setIsLoading(false) }
    }
  }

  // End the mount->ready timer when the provider finishes loading
  useEffect(() => {
    if (loadTimingStartedRef.current && !isLoading) {
      try { if (loadProfilerRef.current && typeof loadProfilerRef.current.end === 'function') loadProfilerRef.current.end() } catch (e) {}
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

      // If we've reached end-of-day (no next period and not currently in class),
      // show a "School in" countdown pointing at the next school day's roll call
      // (first non-break period). This prevents extremely large durations being
      // shown when parsers return far-future sentinel dates.
      try {
        if (!info.isCurrentlyInClass && !info.nextPeriod) {
          const nextDayDate = getNextSchoolDay(new Date())
          const nextDayName = nextDayDate.toLocaleDateString('en-US', { weekday: 'long' })
          const nextDayPeriods = timetableData[nextDayName]
          if (Array.isArray(nextDayPeriods) && nextDayPeriods.length) {
            const found = findFirstNonBreakPeriodOnDate(nextDayPeriods, nextDayDate)
            if (found) {
              const now2 = new Date()
              const diffMs = found.start.getTime() - now2.getTime()
              if (diffMs > 0) {
                // Create a lightweight synthetic period marker for UI use.
                info.nextPeriod = { ...found.period, isRollCallMarker: true } as any
                info.timeUntil = `School in ${formatDurationShort(diffMs)} until roll call`
              }
            }
          }
        }
      } catch (e) {}

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

  // Visibility-aware background refresh: poll the server more frequently
  // when the document is visible, and back off when hidden.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    let intervalId: number | null = null

    const startWithInterval = (ms: number) => {
      if (intervalId != null) window.clearInterval(intervalId)
      // Throttle immediate refreshes triggered by visibility/focus so
      // repeated focus events don't hammer the server. Allow an immediate
      // refresh only if the last focus-triggered refresh was sufficiently
      // long ago.
      try {
        const now = Date.now()
        const last = lastFocusTsRef.current || 0
        const MIN_FOCUS_REFRESH_MS = 30 * 1000 // 30s
        if ((now - last) > MIN_FOCUS_REFRESH_MS) {
          lastFocusTsRef.current = now
          void refreshExternal(false, true).catch(() => {})
        } else {
          try { console.debug('[timetable.provider] skipping immediate refresh on focus - throttled') } catch (e) {}
        }
      } catch (e) {}
      intervalId = window.setInterval(() => { void refreshExternal(false, true).catch(() => {}) }, ms)
    }

    function handleVisibility() {
      try {
        if (document.visibilityState === 'visible') startWithInterval(VISIBLE_REFRESH_MS)
        else startWithInterval(HIDDEN_REFRESH_MS)
      } catch (e) {}
    }

    handleVisibility()
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleVisibility)

    return () => {
      if (intervalId != null) window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleVisibility)
    }
  }, [])

  // When the selected date changes, fetch the authoritative timetable for that date
  useEffect(() => {
    let cancelled = false
    const fetchForDate = async () => {
      try {
        const ds = (selectedDateObject || new Date()).toISOString().slice(0, 10)
        // If we've just requested this same date, skip duplicate fetch
        if (lastRequestedDateRef.current === ds) return
          // Try to read a persisted processed payload from the react-query cache
          try {
            if (typeof window !== 'undefined') {
              const qc = (await import('@/lib/query-client')).getQueryClient()
              try {
                const cached = qc.getQueryData(['timetable', ds]) as any | undefined
                if (cached && cached.timetable) {
                  // Use the cached processed timetable immediately and skip fetch
                  externalTimetableDateRef.current = ds
                  setExternalTimetable(cached.timetable)
                  setExternalTimetableByWeek(cleanTimetableByWeek(cached.timetableByWeek) || null)
                  if (cached.bellTimes && !authoritativeBellsDateRef.current) {
                    setExternalBellTimes(cached.bellTimes)
                    lastSeenBellTimesRef.current = cached.bellTimes
                  }
                  setTimetableSource(cached.source || 'external-cache')
                  setIsRefreshing(false)
                  try { setLastFetchedDate(ds); setLastFetchedPayloadSummary({ cached: true }) } catch (e) {}
                  lastRequestedDateRef.current = ds
                  return
                }
              } catch (e) {}
            }
          } catch (e) {}
        lastRequestedDateRef.current = ds
        // Check calendar for selected date — if it's a holiday, clear caches and show empty timetable
        try {
          try {
            const calResSel = await fetch(`/api/calendar?endpoint=days&from=${encodeURIComponent(ds)}&to=${encodeURIComponent(ds)}`, { credentials: 'include' })
            const cctypeSel = calResSel.headers.get('content-type') || ''
            if (calResSel.ok && cctypeSel.includes('application/json')) {
              const calJsonSel = await calResSel.json()
              let dayInfoSel: any = null
              if (Array.isArray(calJsonSel) && calJsonSel.length) dayInfoSel = calJsonSel[0]
              else if (calJsonSel && typeof calJsonSel === 'object' && calJsonSel[ds]) dayInfoSel = calJsonSel[ds]
              else if (calJsonSel && typeof calJsonSel === 'object') {
                for (const k of Object.keys(calJsonSel)) {
                  const v = calJsonSel[k]
                  if (v && (v.date === ds || String(k) === ds)) { dayInfoSel = v; break }
                }
              }
              const isHolidaySel = Boolean(
                dayInfoSel && (
                  dayInfoSel.isHoliday === true ||
                  dayInfoSel.holiday === true ||
                  String(dayInfoSel.is_school_day).toLowerCase() === 'false' ||
                  String(dayInfoSel.status).toLowerCase().includes('holiday') ||
                  String(dayInfoSel.type || '').toLowerCase().includes('holiday') ||
                  String(dayInfoSel.dayType || '').toLowerCase().includes('holiday')
                )
              )
              if (isHolidaySel) {
                  holidayDateRef.current = true
                  try { setSelectedDateIsHoliday(true) } catch (e) {}
                  try { setCacheHydrated(false) } catch (e) {}
                  
                  // For holidays, we no longer clear the cache or effectively reset
                  // the timetable. This allows "classes that were in the school term"
                  // to continue showing during holidays, allowing users to peek at
                  // their schedule.
                  
                  setTimetableSource('calendar-holiday')
                  setExternalWeekType(null)
                  try { setLastFetchedDate(ds); setLastFetchedPayloadSummary({ holiday: true, source: 'calendar' }) } catch (e) {}
                  return
              }
            }
          } catch (e) {
            // ignore calendar errors and continue to fetch
          }
        } catch (e) {}
        const res = await fetch(`/api/timetable?date=${encodeURIComponent(ds)}`, { credentials: 'include', cache: 'no-store', headers: { 'pragma': 'no-cache', 'cache-control': 'no-cache' } })
        const ctype = res.headers.get('content-type') || ''
        if (!res.ok) {
          try { await extractBellTimesFromResponse(res) } catch (e) {}
          return
        }
        if (ctype.includes('application/json')) {
          const j = await res.json()
          if (cancelled) return
          if (j && payloadHasNoTimetable(j)) {
            // When the selectedDateObject effect sees "no timetable", do NOT
            // clear the existing timetable. The main refreshExternal function
            // is authoritative for clearing. This prevents a race condition
            // where the effect clears data that was just successfully loaded.
            // We still extract bell times if available.
            if (!cancelled) {
              try {
                const computed = buildBellTimesFromPayload(j)
                const finalBellTimes: Record<string, any[]> = { 'Mon/Tues': [], 'Wed/Thurs': [], 'Fri': [] }
                const src = j.bellTimes || {}
                for (const k of ['Mon/Tues', 'Wed/Thurs', 'Fri']) {
                  if (src[k] && Array.isArray(src[k]) && src[k].length) finalBellTimes[k] = src[k]
                  else if (computed[k] && Array.isArray(computed[k]) && computed[k].length) finalBellTimes[k] = computed[k]
                  else if (lastSeenBellTimesRef.current && lastSeenBellTimesRef.current[k] && lastSeenBellTimesRef.current[k].length) finalBellTimes[k] = lastSeenBellTimesRef.current[k]
                  else finalBellTimes[k] = []
                }
                const hasAny = Object.values(finalBellTimes).some((arr) => Array.isArray(arr) && arr.length > 0)
                // Only update bells if we don't already have authoritative date-specific ones
                if (hasAny && !authoritativeBellsDateRef.current) {
                  setExternalBellTimes(finalBellTimes)
                  lastSeenBellTimesRef.current = finalBellTimes
                  lastSeenBellTsRef.current = Date.now()
                }
              } catch (e) {
                // ignore
              }
              // DO NOT call setExternalTimetable(emptyByDay) here - let main fetch be authoritative
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
              try { console.debug('[timetable.provider] fetchForDate extracted subs from upstream:', Array.isArray(subs) ? subs.length : 0, 'for date', ds) } catch (e) {}

    
              // If none found in upstream, request from the AI timetable endpoint
              if ((!Array.isArray(subs) || subs.length === 0)) {
                try {
                  // Try to extract substitutions from the already-fetched timetable payload
                  const fetched = await getPortalSubstitutions(j)
                  if (Array.isArray(fetched) && fetched.length) subs = fetched
                  try { console.debug('[timetable.provider] fetchForDate fetched subs via getPortalSubstitutions:', Array.isArray(subs) ? subs.length : 0) } catch (e) {}
                } catch (e) {
                  // ignore
                }
              }

              if (Array.isArray(subs) && subs.length) {
                try {
                  // Apply all substitutions (date-specific + generic) to the per-day timetable
                  // CRITICAL: Substitutions are DATE-SPECIFIC only - they should NEVER be applied
                  // to timetableByWeek (the week-organized structure) to avoid carrying them over
                  // to the wrong week type.
                  console.warn('🔴 [SUBS-DEBUG] fetchForDate: About to apply substitutions to finalTimetable')
                  console.warn('🔴 [SUBS-DEBUG] fetchForDate: Number of substitutions:', subs.length)
                  console.warn('🔴 [SUBS-DEBUG] fetchForDate: Subs sample:', subs.slice(0, 3).map((s: any) => ({ date: s.date, period: s.period, subject: s.subject, teacher: s.substituteTeacher || s.casualSurname })))
                  console.warn('🔴 [SUBS-DEBUG] fetchForDate: finalTimetable before:', Object.keys(j.timetable).map((day: string) => ({ day, count: (j.timetable as any)[day]?.length || 0, hasVar: (j.timetable as any)[day]?.some((p: any) => p.isSubstitute || p.isRoomChange) })))
                  
                  finalTimetable = applySubstitutionsToTimetable(j.timetable, subs, { debug: true })
                  
                  // Count variations in the result
                  let varCount = 0
                  const varsByDay: Record<string, any[]> = {}
                  for (const day of Object.keys(finalTimetable)) {
                    const vars = ((finalTimetable as any)[day] || []).filter((p: any) => p.isSubstitute || p.isRoomChange)
                    varCount += vars.length
                    if (vars.length > 0) {
                      varsByDay[day] = vars.map((v: any) => ({ period: v.period, subject: v.subject, sub: v.casualSurname || v.displayTeacher }))
                    }
                  }
                  console.warn('🔴 [SUBS-DEBUG] fetchForDate: After applying subs - total variations:', varCount, 'by day:', varsByDay)
                  try { console.debug('[timetable.provider] fetchForDate applied subs, variations in result:', varCount, 'for date', ds) } catch (e) {}
                } catch (e) { /* ignore substitution apply errors */ }
              }
            } catch (e) {
              // ignore substitution extraction/apply errors
            }

            console.warn('🔴 [SUBS-DEBUG] fetchForDate: About to set timetableByWeek. Has finalByWeek?', !!finalByWeek)
            if (finalByWeek) {
              console.warn('🔴 [SUBS-DEBUG] fetchForDate: Setting timetableByWeek - checking if it has subs...')
              for (const day of Object.keys(finalByWeek)) {
                const groups = (finalByWeek as any)[day]
                for (const weekKey of ['A', 'B', 'unknown']) {
                  const periodVars = (groups[weekKey] || []).filter((p: any) => p.isSubstitute || p.isRoomChange)
                  if (periodVars.length > 0) {
                    console.warn(`🔴 [SUBS-DEBUG] fetchForDate: timetableByWeek[${day}][${weekKey}] HAS ${periodVars.length} substitutions!`, periodVars.map((p: any) => ({ period: p.period, sub: p.casualSurname || p.displayTeacher })))
                  }
                }
              }
              setExternalTimetableByWeek(cleanTimetableByWeek(finalByWeek))
            }
              // CRITICAL: Track which date this timetable data is FOR before setting it
              // Merge any authoritative variations we previously captured for this date
              // MUST happen BEFORE setExternalTimetable to ensure variations are never lost
              try {
                const authMap = authoritativeVariationsRef.current
                const selIso = selectedDateObjectRef.current ? selectedDateObjectRef.current.toISOString().slice(0,10) : null
                const candidateDates = [ds, externalTimetableDateRef.current, selIso, new Date().toISOString().slice(0,10)].filter(Boolean) as string[]
                
                // AGGRESSIVE DEBUG: Show all candidate dates
                try {
                  console.warn('🔍 [RETRIEVAL] Fetching data for date:', ds, 'Candidate dates:', candidateDates.join(', '))
                  console.warn('🔍 [RETRIEVAL] Available stored dates in map:', Array.from(authMap.keys()).join(', '))
                } catch (e) {}
                
                let authForDate: any = null
                let matchedKey: string | null = null
                for (const dk of candidateDates) { 
                  authForDate = authMap.get(dk)
                  if (authForDate) {
                    matchedKey = dk
                    try {
                      console.warn('🔍 [RETRIEVAL] Found variations for key:', dk)
                      for (const day of Object.keys(authForDate)) {
                        if (authForDate[day]?.length > 0) {
                          console.warn('🔍 [RETRIEVAL]   -', day, ':', authForDate[day].map((v: any) => `P${v.period}:${v.casualSurname || v.displayRoom}`).join(', '))
                        }
                      }
                    } catch (e) {}
                    break
                  }
                }
                
                if (authForDate && typeof authForDate === 'object') {
                  // CRITICAL: Only apply variations if they're for the exact date being requested
                  // Do NOT apply variations from a different date even if they're the only ones available
                  if (matchedKey !== ds) {
                    try { console.error('[timetable.provider] ❌ BLOCKING: Refusing to apply variations from', matchedKey, 'to timetable requested for', ds, '- Date mismatch!') } catch (e) {}
                    authForDate = null  // Clear it so it won't be applied
                  } else {
                    try { console.warn('[timetable.provider] ✅ APPLYING: Merging authoritative variations for date', matchedKey, 'into fetched timetable for requested date:', ds, '- Days with variations:', Object.keys(authForDate).filter(d => authForDate[d]?.length).join(',')) } catch (e) {}
                  }
                }
                
                if (authForDate && typeof authForDate === 'object') {
                  try {
                    const fridayKey = Object.keys(authForDate).find(k => k.toLowerCase().includes('fri'))
                    if (fridayKey && authForDate[fridayKey]?.length) {
                      console.warn('[timetable.provider] 📅 FRIDAY stored variations found:', authForDate[fridayKey].length, 'variations for key:', fridayKey)
                      const fridayInTimetable = Object.keys(finalTimetable).find(k => k.toLowerCase().includes('fri'))
                      console.warn('[timetable.provider] 📅 FRIDAY in timetable as:', fridayInTimetable, 'with', ((finalTimetable as any)[fridayInTimetable || 'Friday'] || []).length, 'periods')
                    }
                    const thursdayKey = Object.keys(authForDate).find(k => k.toLowerCase().includes('thu'))
                    if (thursdayKey && authForDate[thursdayKey]?.length) {
                      console.warn('[timetable.provider] 📅 THURSDAY stored variations found:', authForDate[thursdayKey].length, 'variations for key:', thursdayKey)
                      const thursdayInTimetable = Object.keys(finalTimetable).find(k => k.toLowerCase().includes('thu'))
                      console.warn('[timetable.provider] 📅 THURSDAY in timetable as:', thursdayInTimetable, 'with', ((finalTimetable as any)[thursdayInTimetable || 'Thursday'] || []).length, 'periods')
                    }
                  } catch (e) {}
                  
                  for (const dayKey of Object.keys(authForDate)) {
                    const dayVars = authForDate[dayKey] || []
                    // CRITICAL: Try to match day key case-insensitively
                    // API might return "Wednesday" but stored variations might be under "wednesday"
                    let timetableDayKey = dayKey
                    let dayPeriods = (finalTimetable as any)[dayKey]
                    if (!dayPeriods || !Array.isArray(dayPeriods)) {
                      // Try case-insensitive match
                      const normalizedKey = String(dayKey).toLowerCase()
                      const matchedKey = Object.keys(finalTimetable).find(k => String(k).toLowerCase() === normalizedKey)
                      if (matchedKey) {
                        timetableDayKey = matchedKey
                        dayPeriods = (finalTimetable as any)[matchedKey]
                        try { console.warn('[timetable.provider] Matched day key case-insensitively:', dayKey, '->', matchedKey) } catch (e) {}
                      } else {
                        // Day doesn't exist in timetable at all - create it
                        dayPeriods = []
                        timetableDayKey = dayKey
                        try { console.warn('[timetable.provider] Creating new day entry for:', dayKey) } catch (e) {}
                      }
                    }
                    dayPeriods = dayPeriods || []
                    
                    // Track if we made any changes so we know to update finalTimetable
                    let modified = false
                    
                    for (const v of dayVars) {
                      try {
                        if (!v || !v.period) continue
                        const norm = String(v.period).trim().toLowerCase()
                        const idx = dayPeriods.findIndex((p: any) => String(p.period).trim().toLowerCase() === norm)
                        
                        // AGGRESSIVE DEBUG: Log each variation application attempt
                        try {
                          console.warn('🔍 [APPLY] Attempting to apply variation to', timetableDayKey, 'P' + v.period, '- Found at index:', idx, '- Variation:', v.casualSurname || v.displayRoom)
                        } catch (e) {}
                        
                        if (idx >= 0) {
                          const period = dayPeriods[idx]
                          
                          let applied = false
                          if (v.isSubstitute) {
                            (period as any).isSubstitute = true
                            if (v.casualSurname) (period as any).casualSurname = v.casualSurname
                            if (v.displayTeacher) (period as any).displayTeacher = v.displayTeacher
                            if (v.originalTeacher) (period as any).originalTeacher = v.originalTeacher
                            applied = true
                            modified = true
                          }
                          if (v.isRoomChange) {
                            (period as any).isRoomChange = true
                            if (v.displayRoom) (period as any).displayRoom = v.displayRoom
                            if (v.originalRoom) (period as any).originalRoom = v.originalRoom
                            applied = true
                            modified = true
                          }
                          if (applied) {
                            try { console.warn('[timetable.provider] ✅ Applied stored variation:', timetableDayKey, 'P' + v.period, v.isSubstitute ? 'SUB:' + v.casualSurname : '', v.isRoomChange ? 'ROOM:' + v.displayRoom : '') } catch (e) {}
                            // Extra logging for Thursday
                            if (String(timetableDayKey).toLowerCase().includes('thu')) {
                              try { console.warn('[timetable.provider] 📅 THURSDAY variation applied to period', v.period) } catch (e) {}
                            }
                          }
                        } else {
                          // CRITICAL: If period doesn't exist in the fetched timetable but we have a stored variation for it,
                          // we need to reconstruct the period. This handles cases where:
                          // 1. API returns incomplete data (only Week B when substitute was on Week A)
                          // 2. Data is being reused/repeated and doesn't include the historical period
                          try { console.warn('[timetable.provider] ⚠️ Could not find period', v.period, 'in', dayKey, 'to apply variation. Attempting to reconstruct. Available periods:', dayPeriods.map((p: any) => p.period).join(',')) } catch (e) {}
                          
                          // Try to find this period in finalByWeek (grouped structure) as a template
                          let template: any = null
                          if (finalByWeek && (finalByWeek as any)[dayKey]) {
                            const groups = (finalByWeek as any)[dayKey]
                            for (const wk of ['A', 'B', 'unknown']) {
                              const arr = Array.isArray(groups[wk]) ? groups[wk] : []
                              template = arr.find((p: any) => String(p.period).trim().toLowerCase() === norm)
                              if (template) break
                            }
                          }
                          
                          // If we found a template, reconstruct the period with the variation applied
                          if (template) {
                            const reconstructed: any = { ...template }
                            if (v.isSubstitute) {
                              reconstructed.isSubstitute = true
                              if (v.casualSurname) reconstructed.casualSurname = v.casualSurname
                              if (v.displayTeacher) reconstructed.displayTeacher = v.displayTeacher
                              if (v.originalTeacher) reconstructed.originalTeacher = v.originalTeacher
                            }
                            if (v.isRoomChange) {
                              reconstructed.isRoomChange = true
                              if (v.displayRoom) reconstructed.displayRoom = v.displayRoom
                              if (v.originalRoom) reconstructed.originalRoom = v.originalRoom
                            }
                            // Add the reconstructed period to the timetable
                            dayPeriods.push(reconstructed)
                            modified = true
                            try { console.warn('[timetable.provider] ✅ Reconstructed period', timetableDayKey, 'P' + v.period, 'from grouped structure with stored variation') } catch (e) {}
                          } else {
                            // No template available - create a minimal period with the variation
                            // This ensures the substitute is visible even if we can't find the base period
                            const minimal: any = {
                              period: v.period,
                              time: '',
                              subject: v.isSubstitute ? 'Class' : '',
                              teacher: v.isSubstitute && v.originalTeacher ? v.originalTeacher : '',
                              room: v.isRoomChange && v.originalRoom ? v.originalRoom : ''
                            }
                            if (v.isSubstitute) {
                              minimal.isSubstitute = true
                              if (v.casualSurname) minimal.casualSurname = v.casualSurname
                              if (v.displayTeacher) minimal.displayTeacher = v.displayTeacher
                              if (v.originalTeacher) minimal.originalTeacher = v.originalTeacher
                            }
                            if (v.isRoomChange) {
                              minimal.isRoomChange = true
                              if (v.displayRoom) minimal.displayRoom = v.displayRoom
                              if (v.originalRoom) minimal.originalRoom = v.originalRoom
                            }
                            dayPeriods.push(minimal)
                            modified = true
                            try { console.warn('[timetable.provider] ✅ Created minimal period', timetableDayKey, 'P' + v.period, 'with stored variation (no template found)') } catch (e) {}
                          }
                        }
                      } catch (e) {}
                    }
                    
                    // Write the modified day periods back to finalTimetable
                    if (modified) {
                      (finalTimetable as any)[timetableDayKey] = dayPeriods
                      try { console.warn('[timetable.provider] ✅ Updated finalTimetable for', timetableDayKey, 'with', dayPeriods.length, 'periods') } catch (e) {}
                    }
                    // Also merge into grouped by-week structure if present
                    if (finalByWeek && (finalByWeek as any)[timetableDayKey]) {
                      try {
                        const groups = (finalByWeek as any)[timetableDayKey]
                        for (const wk of ['A','B','unknown']) {
                          const arr = Array.isArray(groups[wk]) ? groups[wk] : []
                          for (const v of dayVars) {
                            if (!v || !v.period) continue
                            const norm = String(v.period).trim().toLowerCase()
                            const idx = arr.findIndex((p: any) => String(p.period).trim().toLowerCase() === norm)
                            if (idx >= 0) {
                              const period = arr[idx]
                              if (v.isSubstitute) {
                                (period as any).isSubstitute = true
                                if (v.casualSurname) (period as any).casualSurname = v.casualSurname
                                if (v.displayTeacher) (period as any).displayTeacher = v.displayTeacher
                                if (v.originalTeacher) (period as any).originalTeacher = v.originalTeacher
                              }
                              if (v.isRoomChange) {
                                (period as any).isRoomChange = true
                                if (v.displayRoom) (period as any).displayRoom = v.displayRoom
                                if (v.originalRoom) (period as any).originalRoom = v.originalRoom
                              }
                            }
                          }
                        }
                      } catch (e) {}
                    }
                  }
                  try { console.debug('[timetable.provider] merged authoritative variations into fetched date payload for', ds) } catch (e) {}
                }
              } catch (e) {}
              externalTimetableDateRef.current = ds
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
            if (j.bellTimes) {
              // Merge new bell times with existing ones to preserve all sectors
              // This prevents breaks from disappearing when switching between sectors
              const mergedBellTimes: Record<string, any[]> = { 'Mon/Tues': [], 'Wed/Thurs': [], 'Fri': [] }
              const existingBells = lastSeenBellTimesRef.current || externalBellTimes || {}
              for (const k of ['Mon/Tues', 'Wed/Thurs', 'Fri']) {
                // Prefer new API data, fall back to existing data
                if (j.bellTimes[k] && Array.isArray(j.bellTimes[k]) && j.bellTimes[k].length) {
                  mergedBellTimes[k] = j.bellTimes[k]
                } else if (existingBells[k] && Array.isArray(existingBells[k]) && existingBells[k].length) {
                  mergedBellTimes[k] = existingBells[k]
                }
              }
              setExternalBellTimes(mergedBellTimes)
              // Mark these as authoritative date-specific bells
              authoritativeBellsDateRef.current = (selectedDateObject || new Date()).toISOString().slice(0,10)
              lastSeenBellTimesRef.current = mergedBellTimes
              lastSeenBellTsRef.current = Date.now()
            }
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
      }
      // Note: We intentionally do NOT clear lastRequestedDateRef.current here.
      // Keeping the ref set prevents duplicate fetches for the same date when
      // the effect re-fires (e.g., due to re-renders or interval ticks).
      try { setSelectedDateCalendarChecked(true) } catch (e) {}
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

  // Preserve casualSurname from the last recorded timetable when a fresh
  // externalTimetable arrives that lacks casual markers. This handles the
  // case where a background refresh returns a bare teacher code (e.g. "LIKZ")
  // and we want to keep the human-friendly casual name previously applied.
  useEffect(() => {
    try {
      if (!externalTimetable) return
      if (!lastRecordedTimetable) return
      let changed = false
      const merged: Record<string, Period[]> = {}
      for (const day of Object.keys(externalTimetable)) {
        const newList = (externalTimetable[day] || []).map((p) => {
          try {
            const prevList = (lastRecordedTimetable && lastRecordedTimetable[day]) ? lastRecordedTimetable[day] : []
            // Try to find a matching previous period by id first, then fall back
            // to matching by period+subject+time. This covers payloads that may
            // omit stable ids.
            const match = prevList.find((q) => {
              try {
                if (q && (q as any).id && p && (p as any).id && (q as any).id === (p as any).id) return true
                if (String(q?.period || '') === String(p?.period || '') && String(q?.subject || '') === String(p?.subject || '') && String(q?.time || '') === String(p?.time || '')) return true
              } catch (e) {}
              return false
            })
            if (match && !(p as any).casualSurname && (match as any).casualSurname) {
              const copy = { ...p } as any
              copy.casualSurname = (match as any).casualSurname
              changed = true
              return copy
            }
          } catch (e) {
            // ignore per-item errors
          }
          return p
        })
        merged[day] = newList
      }
      if (changed) {
        try { console.debug('[timetable.provider] merged casualSurname from cache into refreshed timetable') } catch (e) {}
        setExternalTimetable(merged)
      }
    } catch (e) {
      // ignore merge errors
    }
  }, [externalTimetable, lastRecordedTimetable])

  // Wrapped setters that record a user selection timestamp so automatic
  // time-based updates can respect manual choices for a short grace period.
  const userSetSelectedDay = (day: string) => {
    const ts = Date.now()
    lastUserSelectedRef.current = ts
    setLastUserSelectedAt(ts)
    // Mark that the calendar check for the newly-selected date is pending
    try { setSelectedDateCalendarChecked(false) } catch (e) {}
    try { setSelectedDateIsHoliday(false) } catch (e) {}
    setSelectedDay(day)
  }
  const userSetSelectedDateObject = (d: Date) => {
    const ts = Date.now()
    lastUserSelectedRef.current = ts
    setLastUserSelectedAt(ts)
    // Mark that the calendar check for the newly-selected date is pending
    try { setSelectedDateCalendarChecked(false) } catch (e) {}
    try { setSelectedDateIsHoliday(false) } catch (e) {}
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
        lastUserSelectedAt,
        timetableData,
        currentMomentPeriodInfo, // Provide the new state
        // Backwards-compatible alias for older components
        nextPeriodInfo: currentMomentPeriodInfo,
        bellTimes: externalBellTimes || lastSeenBellTimesRef.current || null,
        isShowingNextDay,
        timetableSource,
        timetableByWeek: lastRecordedTimetableByWeek || externalTimetableByWeek || undefined,
        externalWeekType,
        selectedDateCalendarChecked,
        selectedDateIsHoliday,
        initialCalendarChecked,
        cacheHydrated,
        isLoading,
        isRefreshing,
        isAuthenticated,
        reauthRequired,
        isShowingCachedWhileLoading: Boolean((isLoading || isRefreshing) && lastRecordedTimetable),
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
    // Return a safe fallback to avoid throwing when a component is
    // accidentally rendered outside the provider (prevents ErrorBoundary
    // from catching these predictable misses). Components that require
    // live data should still work when the provider is present.
    // NOTE: Prefer using `useTimetableSafe` in places where missing
    // provider is expected; this fallback prevents hard crashes in
    // production while preserving UX.
    const noop = () => Promise.resolve()
    const safe: TimetableContextType = {
      currentWeek: null,
      selectedDay: '',
      selectedDateObject: new Date(),
      setSelectedDay: (_d: string) => {},
      setSelectedDateObject: (_d: Date) => {},
      timetableData: { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] },
      currentMomentPeriodInfo: { nextPeriod: null, timeUntil: '', isCurrentlyInClass: false, currentPeriod: null },
      nextPeriodInfo: { nextPeriod: null, timeUntil: '', isCurrentlyInClass: false, currentPeriod: null },
      isShowingCachedWhileLoading: false,
      bellTimes: { 'Mon/Tues': [], 'Wed/Thurs': [], Fri: [] },
      isShowingNextDay: false,
      timetableSource: null,
      isLoading: false,
      isRefreshing: false,
      error: null,
      refreshExternal: noop,
      timetableByWeek: undefined,
      externalWeekType: null,
    }
    return safe
  }
  return context
}

// Safe variant: returns the context or undefined instead of throwing.
// Useful in settings or other places that may render outside the provider.
export function useTimetableSafe() {
  try {
    return useContext(TimetableContext)
  } catch (e) {
    return undefined
  }
}

