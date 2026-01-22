"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { ChevronLeft, Calendar as CalendarIcon, Utensils } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getWeek } from 'date-fns'
import { trackSectionUsage } from "@/utils/usage-tracker"
import PageTransition from "@/components/page-transition"
import { useTimetable } from "@/contexts/timetable-context"
import { parseTimeRange, formatTo12Hour, isSchoolDayOver, getNextSchoolDay } from "@/utils/time-utils"
import { stripLeadingCasualCode } from "@/lib/utils"
import { DatePicker } from "@/components/date-picker"
import { hexToPastel, hexToInlineStyle } from "@/utils/color-utils"


export default function TimetablePage() {
  const [mounted, setMounted] = useState(false)
  const [isPhone, setIsPhone] = useState(false)
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  const [schoolWeekInfo, setSchoolWeekInfo] = useState<{ week?: string; weekType?: string } | null>(null)
  const [isSchoolDay, setIsSchoolDay] = useState(true) // Default to true, set to false if calendar says it's not
  // Use selected date from timetable context so the header date follows
  // the provider's school-day logic (shows next school day after school ends).
  const [viewMode, setViewMode] = useState<"daily" | "cycle">("daily")
  const { currentWeek, externalWeekType, timetableData, timetableSource, refreshExternal, selectedDateObject, setSelectedDateObject, timetableByWeek, lastUserSelectedAt, bellTimes } = useTimetable()

  useEffect(() => {
    setMounted(true)
    trackSectionUsage("timetable")
    // Diagnostics: log timetable data to check if room variations are present
    try {
      console.log('[Timetable Page] timetableData keys:', Object.keys(timetableData || {}))
      const dayName = displayDateObject.toLocaleDateString('en-US', { weekday: 'long' })
      const periods = timetableData[dayName] || []
      if (periods.length > 0) {
        console.log(`[Timetable Page] ${dayName} has ${periods.length} periods`)
        const firstPeriod = periods[0]
        console.log('[Timetable Page] Sample period fields:', Object.keys(firstPeriod || {}))
        console.log('[Timetable Page] Room variation fields in first period:', {
          displayRoom: firstPeriod?.displayRoom,
          isRoomChange: firstPeriod?.isRoomChange,
          originalRoom: firstPeriod?.originalRoom
        })
      }
    } catch (e) {}
  }, [])

  // Fetch school week information for the selected date from calendar API
  useEffect(() => {
    const fetchSchoolWeekInfo = async () => {
      try {
        const dayName = selectedDateObject.toLocaleDateString('en-US', { weekday: 'long' })
        const periods = timetableData[dayName] || []
        if (periods.length > 0) {
          const roomChangePeriods = periods.filter((p: any) => p.isRoomChange)
          if (roomChangePeriods.length > 0) {
            console.log(`[Timetable Page] Found ${roomChangePeriods.length} periods with room changes on ${dayName}:`, roomChangePeriods.map((p: any) => ({ subject: p.subject, from: p.originalRoom, to: p.displayRoom })))
          } else {
            console.log(`[Timetable Page] No room changes found for ${dayName} (${periods.length} total periods)`)
          }
        }
        
        const dateStr = selectedDateObject.toISOString().slice(0, 10)
        const res = await fetch(`/api/calendar?endpoint=days&from=${encodeURIComponent(dateStr)}&to=${encodeURIComponent(dateStr)}`, { credentials: 'include' })
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          const data = await res.json()
          if (data && data[dateStr]) {
            const dayInfo = data[dateStr]
            
            // Check if it's a school day: all of term, week, weekType, dayNumber must be non-zero/non-blank
            const isSchool = Boolean(
              dayInfo.term && dayInfo.term !== '0' &&
              dayInfo.week && dayInfo.week !== '0' &&
              dayInfo.weekType && dayInfo.weekType !== '' &&
              dayInfo.dayNumber && dayInfo.dayNumber !== '0'
            )
            setIsSchoolDay(isSchool)
            
            if (isSchool) {
              setSchoolWeekInfo({
                week: dayInfo.week || undefined,
                weekType: dayInfo.weekType || undefined
              })
            } else {
              setSchoolWeekInfo(null)
            }
            try { console.debug('[timetable] School day info:', { isSchool, dayInfo }) } catch (e) {}
          } else {
            // No day info found - assume it's not a school day
            setIsSchoolDay(false)
            setSchoolWeekInfo(null)
            try { console.debug('[timetable] No day info found for date:', dateStr) } catch (e) {}
          }
        } else {
          // API error - default to showing content
          setIsSchoolDay(true)
          try { console.debug('[timetable] Calendar API error:', res.status, res.statusText) } catch (e) {}
        }
      } catch (e) {
        // Network error - default to showing content
        setIsSchoolDay(true)
        console.debug('[timetable] Error fetching school week info:', e)
      }
    }
    
    if (mounted) {
      fetchSchoolWeekInfo()
    }
  }, [selectedDateObject, mounted])

  // Detect phone devices (exclude tablets which may be portrait but are tablets)
  useEffect(() => {
    function detect() {
      try {
        const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''
        const isTabletUA = /iPad|Tablet|Android(?!.*Mobile)|Silk|Kindle/i.test(ua) || (typeof navigator !== 'undefined' && (navigator as any).maxTouchPoints && window.innerWidth >= 600 && window.innerWidth <= 1024)
        const phone = typeof window !== 'undefined' ? (window.innerWidth < 640 && !isTabletUA) : false
        setIsPhone(phone)
      } catch (e) { setIsPhone(false) }
    }
    detect()
    window.addEventListener('resize', detect)
    return () => window.removeEventListener('resize', detect)
  }, [])

  const [showDiag, setShowDiag] = useState(false)
  const [diagLoading, setDiagLoading] = useState(false)
  const [diagResult, setDiagResult] = useState<any | null>(null)
  const [showAuthVars, setShowAuthVars] = useState(false)
  const [authVarsPreview, setAuthVarsPreview] = useState<any | null>(null)

  const fetchDiagnostics = async () => {
    setShowDiag(true)
    setDiagLoading(true)
    try {
      const ds = (selectedDateObject || new Date()).toISOString().slice(0,10)
      const res = await fetch(`/api/timetable?date=${encodeURIComponent(ds)}`, { credentials: 'include' })
      const ctype = res.headers.get('content-type') || ''
      let payload: any
      if (res.ok && ctype.includes('application/json')) {
        payload = await res.json()
      } else {
        // try to get text fallback
        const text = await res.text()
        payload = { text: text.slice(0, 2000), status: res.status }
      }
      setDiagResult(payload)
    } catch (e) {
      setDiagResult({ error: String(e) })
    } finally {
      setDiagLoading(false)
    }
  }

  // Compute a single display date object used for the header and for
  // selecting the timetable rows. If the provider's selected date is
  // today and it's after school hours (or a weekend), show the next
  // school day instead so the header and content remain consistent.
  const getDisplayDateObject = () => {
    try {
      const now = new Date()
      const sameDate = selectedDateObject.toDateString() === now.toDateString()
      const isWeekendNow = now.getDay() === 0 || now.getDay() === 6
      // Auto-advance behavior applies only when the user has not manually
      // selected a date during this page session. `lastUserSelectedAt` is
      // null on initial load; once the user changes dates we avoid
      // auto-advancing until a reload.
      const userHasManuallySelected = Boolean(lastUserSelectedAt)
      if (!userHasManuallySelected && sameDate && (isWeekendNow || isSchoolDayOver())) {
        return getNextSchoolDay(now)
      }
    } catch (e) {}
    return selectedDateObject
  }

  const displayDateObject = getDisplayDateObject()
  // Compute the default date that would be shown on a fresh load
  const nowForDefault = new Date()
  const defaultDisplayDate = (nowForDefault.getDay() === 0 || nowForDefault.getDay() === 6 || isSchoolDayOver()) ? getNextSchoolDay(nowForDefault) : nowForDefault
  const formatSelectedDate = () => {
    const opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }
    return displayDateObject.toLocaleDateString('en-US', opts)
  }

  // Navigate dates by updating the provider's selected date object so
  // the whole app stays in sync with navigation actions.
  const goToPreviousDay = () => {
    const newDate = new Date(selectedDateObject)
    newDate.setDate(newDate.getDate() - 1)
    setSelectedDateObject(newDate)
  }

  const goToNextDay = () => {
    const newDate = new Date(selectedDateObject)
    newDate.setDate(newDate.getDate() + 1)
    setSelectedDateObject(newDate)
  }

  const goToToday = () => {
    setSelectedDateObject(new Date())
  }

  const resetToCurrentOrNext = () => {
    const now = new Date()
    const isWeekendNow = now.getDay() === 0 || now.getDay() === 6
    const target = (isWeekendNow || isSchoolDayOver()) ? getNextSchoolDay(now) : now
    setSelectedDateObject(target)
  }

  // Subject color mapping - uses API colour when available with pastel conversion
  const getSubjectColor = (subject: string, apiColour?: string) => {
    // If API colour is provided, use it with pastel conversion
    if (apiColour && /^[0-9a-fA-F]{6}$/.test(apiColour)) {
      const style = hexToInlineStyle(apiColour)
      // Convert inline style to a className-like appearance
      // Since we can't dynamically generate Tailwind classes, we'll return empty
      // and the caller should use inline style instead
      return "" // Will be handled with inline style
    }
    
    // Fallback to subject-based color mapping
    const s = subject.toUpperCase();
    if (s.includes("ENG")) return "bg-yellow-200 text-yellow-900 dark:bg-yellow-900/50 dark:text-yellow-100";
    if (s.includes("MAT")) return "bg-orange-200 text-orange-900 dark:bg-orange-900/50 dark:text-orange-100";
    if (s.includes("SCI") || s.includes("PHY") || s.includes("CHE") || s.includes("BIO")) return "bg-teal-200 text-teal-900 dark:bg-teal-900/50 dark:text-teal-100";
    if (s.includes("HIS") || s.includes("GEO") || s.includes("ECO") || s.includes("BUS") || s.includes("LEG")) return "bg-blue-200 text-blue-900 dark:bg-blue-900/50 dark:text-blue-100";
    if (s.includes("COM") || s.includes("IST") || s.includes("SDD") || s.includes("IPT")) return "bg-cyan-200 text-cyan-900 dark:bg-cyan-900/50 dark:text-cyan-100";
    if (s.includes("MUS") || s.includes("ART") || s.includes("VA") || s.includes("DRA")) return "bg-purple-200 text-purple-900 dark:bg-purple-900/50 dark:text-purple-100";
    if (s.includes("PDH") || s.includes("PE") || s.includes("SP") || s.includes("SPO")) return "bg-green-200 text-green-900 dark:bg-green-900/50 dark:text-green-100";
    if (s.includes("TEC") || s.includes("D&T") || s.includes("TAS") || s.includes("FOO")) return "bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-100";
    if (s.includes("LAN") || s.includes("FRE") || s.includes("GER") || s.includes("JAP") || s.includes("CHI")) return "bg-pink-200 text-pink-900 dark:bg-pink-900/50 dark:text-pink-100";
    if (s.includes("REL") || s.includes("SCR") || s.includes("CAT")) return "bg-indigo-200 text-indigo-900 dark:bg-indigo-900/50 dark:text-indigo-100";
    
    if (s.includes("BRE") || s.includes("REC") || s.includes("LUN")) return "bg-surface-variant text-on-surface-variant";
    
    return "bg-surface-container-high text-on-surface";
  }

  // Helper to get inline style from API colour
  const getSubjectColorStyle = (subject: string, apiColour?: string): React.CSSProperties | undefined => {
    if (apiColour && /^[0-9a-fA-F]{6}$/.test(apiColour)) {
      return hexToInlineStyle(apiColour)
    }
    return undefined
  }

  // Get subject abbreviation
  const getSubjectAbbr = (subject: string) => {
    const abbrMap: Record<string, string> = {
      English: "ENG",
      Mathematics: "MAT",
      Science: "SCI",
      History: "HIS",
      Geography: "GEO",
      Computing: "COM",
      Music: "MUS",
      Art: "ART",
      PE: "PE",
      Break: "BRK",
    }
    return abbrMap[subject] || subject.substring(0, 3).toUpperCase()
  }

  // Get display name for period (remove "Break" for recess/lunch)
  // Prefers full title when available, falls back to subject
  const getDisplaySubject = (period: any) => {
    if (period.subject === "Break") {
      return period.period // Show "Recess", "Lunch 1", etc. instead of "Break"
    }
    // Prefer title field if it exists and is different from subject
    if ((period as any)?.title && (period as any).title !== (period as any).subject) {
      return (period as any).title
    }
    // Fallback to subject
    return period.subject
  }

  const getDisplayRoom = (period: any) => {
    try {
      if (!period) return ''
      // NOTE: Do NOT include `.to` here - that field is commonly used for
      // end times (e.g., { from: "9:00", to: "10:05" }), not room destinations.
      const display = (period as any).displayRoom || (period as any).toRoom || (period as any).roomTo || (period as any)['room_to'] || (period as any).newRoom
      if (display && String(display).trim()) return String(display)
    } catch (e) {}
    return period.room || ''
  }

  const isSubstitutePeriod = (p: any) => {
    try {
      if (!p) return false
      const orig = String((p as any).originalTeacher || '').trim()
      const teacher = String(p.teacher || '').trim()
      const full = String((p as any).fullTeacher || '').trim()
      const disp = String((p as any).displayTeacher || '').trim()
      const changedTeacher = orig && orig !== teacher
      try {
        const cleanedFull = stripLeadingCasualCode(full || disp || '')
        const cleanedRaw = stripLeadingCasualCode(teacher || '')
        if ((p.isSubstitute || (p as any).casualSurname || changedTeacher) && cleanedFull && cleanedRaw && cleanedFull !== cleanedRaw) return true
      } catch (e) {}
      
      // Defensive: also treat as substitute when casualToken exists or
      // when a displayTeacher is present and differs from the raw `teacher` value.
      const hasCasual = Boolean((p as any).casualSurname || (p as any).casualToken || (p as any).casual)
      const rawIsCode = /^[A-Z]{1,4}$/.test(teacher)
      const dispLooksName = disp && !/^[A-Z0-9\s]{1,6}$/.test(disp)
      const displayDiff = disp && teacher && stripLeadingCasualCode(disp) !== stripLeadingCasualCode(teacher)
      // Only treat display-name differences as substitution when the raw
      // teacher looks like a short code (e.g. "LIKV") or when we already
      // have a casual marker. This avoids highlighting normal teacher
      // display names that differ by formatting.
      const displayIndicatesSub = (rawIsCode && dispLooksName) || (displayDiff && hasCasual)
      return Boolean(p.isSubstitute || hasCasual || changedTeacher || displayIndicatesSub)
    } catch (e) { return Boolean(p?.isSubstitute || (p as any)?.casualSurname) }
  }

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  const selectedDayName = days[displayDateObject.getDay()]
  const isWeekend = selectedDayName === "Sunday" || selectedDayName === "Saturday"
  const todaysTimetableRaw = timetableData[selectedDayName] || []
  // Provider bell bucket for the selected day (used when individual period.time is missing)
  const bucketForSelectedDay = bellTimes ? (selectedDayName === 'Friday' ? bellTimes.Fri : (selectedDayName === 'Wednesday' || selectedDayName === 'Thursday' ? bellTimes['Wed/Thurs'] : bellTimes['Mon/Tues'])) : null

  const normalizePeriodLabel = (p?: string) => String(p || '').trim().toLowerCase()
  // Keep Roll Call / Period 0 and Break rows visible — show all raw entries
  // However, if it's a non-school day, return empty array even if context has cached data
  const todaysTimetable = isSchoolDay ? todaysTimetableRaw : []

  // Helper: normalize labels and build a canonical key for matching.
  const normalizeLabel = (s?: string) => {
    if (!s) return ''
    let t = String(s).trim().toLowerCase()
    // common token aliases
    t = t.replace(/^rc$/,'roll call')
    t = t.replace(/^r$/,'recess')
    t = t.replace(/^eod$/,'end of day')
    t = t.replace(/^mtl1$/,'lunch 1')
    t = t.replace(/^mtl2$/,'lunch 2')
    // remove punctuation and collapse whitespace
    t = t.replace(/[^a-z0-9 ]+/g, ' ')
    t = t.replace(/\s+/g, ' ').trim()
    return t
  }

  // Robust finder: prefer exact normalized label matches, then stricter fuzzy rules,
  // then numeric-only matches, then fall back to a sorted-by-start-time index lookup.
  const findBellTimeForPeriod = (p: any, bucket: any[] | null, index: number) => {
    try {
      if (!bucket || !Array.isArray(bucket) || bucket.length === 0) return ''

      const periodLabelRaw = String(p?.period || p?.title || p?.bell || '').trim()
      const periodKey = normalizeLabel(periodLabelRaw)

      // Build normalized lookup map from bucket entries (preserve original ordering)
      const entries = bucket.map((b: any, i: number) => {
        const labels = [b?.originalPeriod, b?.period, b?.bellDisplay, b?.bell, b?.title]
          .filter(Boolean)
          .map((x: any) => normalizeLabel(String(x)))
        const time = b?.time || (b?.startTime ? (b.startTime + (b.endTime ? ' - ' + b.endTime : '')) : '')
        // parse start for sorting
        let start: string | null = null
        try {
          const parsed = parseTimeRange(time || '')
          start = parsed.start ? parsed.start.toISOString() : null
        } catch (e) { start = null }
        return { index: i, labels, raw: b, time, start }
      })

      // Exact normalized label match
      if (periodKey) {
        for (const e of entries) {
          if (e.labels.includes(periodKey)) return e.time || ''
        }
      }

      // Word-boundary contains match (both directions) to avoid accidental numeric substring matches
      if (periodKey) {
        for (const e of entries) {
          for (const lbl of e.labels) {
            if (lbl && (` ${lbl} `).includes(` ${periodKey} `)) return e.time || ''
            if (periodKey && (` ${periodKey} `).includes(` ${lbl} `)) return e.time || ''
          }
        }
      }

      // Strict numeric match: only if both are simple numbers (e.g., '1' vs '1')
      const pNum = (periodLabelRaw.match(/^\s*(\d+)\s*$/) || [])[1]
      if (pNum) {
        for (const e of entries) {
          for (const lbl of e.labels) {
            const eNum = (lbl.match(/^(\d+)$/) || [])[1]
            if (eNum && eNum === pNum) return e.time || ''
          }
        }
      }

      // As a last resort: sort entries by parsed start time and pick by index if available
      const sorted = entries.slice().sort((a, b) => {
        if (a.start && b.start) return a.start < b.start ? -1 : a.start > b.start ? 1 : 0
        if (a.start) return -1
        if (b.start) return 1
        return a.index - b.index
      })
      if (index >= 0 && index < sorted.length) return sorted[index].time || ''

    } catch (e) {}
    return ''
  }

  if (!mounted) return null

  return (
    <PageTransition>
      <div className="w-full max-w-full mx-auto px-3 sm:px-6 py-4 pb-28 sm:pb-20 overflow-x-hidden min-w-0">
        <div className="flex items-center justify-between mb-6 fade-in">
          <Link
            href="/"
            className="hidden md:flex text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-on-surface md:text-center md:flex-1">My Synchron</h1>
          {/* Debug badges & manual refresh removed per UX request */}
          <div className="w-6 hidden md:block" />
          <div className="w-6 hidden md:block"></div>
        </div>
        {/* When we're using the bundled sample because live data couldn't be obtained, show a clear, non-technical call-to-action */}
        {timetableSource === 'fallback-sample' && (
          <div className="w-full mb-6">
            <Card className="w-full bg-surface-container rounded-m3-xl border-none shadow-elevation-1 p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="font-medium text-on-surface">Can't load your live timetable</div>
                  <div className="text-sm text-on-surface-variant">Sign in to the SBHS Portal and then click Retry to load your live timetable.</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      try { window.location.href = '/api/auth/login' } catch { window.location.assign('/api/auth/login') }
                    }}
                    className="rounded-full"
                  >
                    Sign in to portal
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        if (refreshExternal) await refreshExternal()
                      } catch (e) {
                        // ignore — provider will fall back to sample if needed
                      }
                    }}
                    className="rounded-full"
                  >
                    Retry
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* View Mode Toggle */}
        <div className="flex justify-center mb-6">
          <div className="bg-surface-container-high p-1 rounded-full">
            <button
              onClick={() => setViewMode("daily")}
              className={`px-4 py-2 text-sm rounded-full transition-all ${
                viewMode === "daily" ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Daily View
            </button>
            <button
              onClick={() => setViewMode("cycle")}
              className={`px-4 py-2 text-sm rounded-full transition-all ${
                viewMode === "cycle" ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Cycle View
            </button>
          </div>
        </div>

        {viewMode === "daily" && (
          <>
            {/* Date Navigation */}
            <div className="flex items-center justify-between mb-4 w-full max-w-full mx-auto">
              <button
                className="p-2 rounded-full bg-surface-container-high text-on-surface-variant transition-all duration-200 ease-in-out hover:bg-surface-container-highest hover:text-on-surface"
                onClick={goToPreviousDay}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

                <div className="text-center">
                  {/* Display date without picker */}
                  {(() => {
                    try {
                      const weekday = displayDateObject.toLocaleDateString('en-US', { weekday: 'short' })
                      const dateShort = displayDateObject.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
                      
                      // Use school week info if available, otherwise fall back to ISO week
                      let weekPart = ''
                      if (schoolWeekInfo?.week) {
                        // Use actual school week number
                        const wt = schoolWeekInfo.weekType || (externalWeekType || currentWeek) || ''
                        weekPart = wt ? ` Wk ${schoolWeekInfo.week}${wt}` : ` Wk ${schoolWeekInfo.week}`
                      } else {
                        // Fall back to ISO week number
                        const weekNum = getWeek(displayDateObject)
                        const wt = (externalWeekType || currentWeek) || ''
                        weekPart = wt ? ` Wk ${weekNum}${wt}` : ` Wk ${weekNum}`
                      }
                      
                      const headerShort = `${weekday}, ${dateShort}${weekPart}`
                      return <h2 className="font-semibold text-on-surface">{headerShort}</h2>
                    } catch (e) { return <h2 className="font-semibold text-on-surface">{selectedDayName}</h2> }
                  })()}
                </div>

              <button
                className="p-2 rounded-full bg-surface-container-high text-on-surface-variant transition-all duration-200 ease-in-out hover:bg-surface-container-highest hover:text-on-surface"
                onClick={goToNextDay}
              >
                <ChevronLeft className="h-5 w-5 rotate-180" />
              </button>
            </div>

            {/* Reset Button: show only when user has moved away from the default applying day */}
            {defaultDisplayDate.toDateString() !== selectedDateObject.toDateString() && (
              <div className="flex justify-center gap-3 mb-6">
                <Button
                  onClick={() => setIsDatePickerOpen(true)}
                  variant="outline"
                  size="sm"
                  className="rounded-full border-outline text-on-surface hover:bg-surface-container-high"
                >
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  Pick Date
                </Button>
                <Button
                  onClick={resetToCurrentOrNext}
                  variant="outline"
                  size="sm"
                  className="rounded-full border-outline text-on-surface hover:bg-surface-container-high"
                >
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              </div>
            )}

            {/* Show Pick Date button even when not navigated away */}
            {defaultDisplayDate.toDateString() === selectedDateObject.toDateString() && (
              <div className="flex justify-center mb-6">
                <Button
                  onClick={() => setIsDatePickerOpen(true)}
                  variant="outline"
                  size="sm"
                  className="rounded-full border-outline text-on-surface hover:bg-surface-container-high"
                >
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  Pick Date
                </Button>
              </div>
            )}

            {/* Debug: view persisted authoritative variations (localStorage) */}
            <div className="flex justify-center mb-4">
              <button
                onClick={() => {
                  try {
                    const raw = typeof window !== 'undefined' ? localStorage.getItem('synchron-authoritative-variations') : null
                    if (!raw) {
                      setAuthVarsPreview(null)
                      setShowAuthVars(true)
                      return
                    }
                    const parsed = JSON.parse(raw)
                    // build a small preview: keys (dates) and first entry
                    const keys = Object.keys(parsed || {})
                    const sampleKey = keys[0]
                    const sample = sampleKey ? parsed[sampleKey] : null
                    setAuthVarsPreview({ keys, sampleKey, sample })
                    setShowAuthVars(true)
                  } catch (e) {
                    setAuthVarsPreview({ error: String(e) })
                    setShowAuthVars(true)
                  }
                }}
                className="px-3 py-1 rounded-md text-xs font-medium border bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                type="button"
              >
                View stored variations
              </button>
            </div>

            {showAuthVars && (
              <div className="mb-4 max-w-3xl mx-auto">
                <Card className="bg-surface-container-high p-3 border-none">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-on-surface">Variations Debug</div>
                    <div>
                      <button className="px-2 py-1 text-xs rounded-full bg-surface-container-highest text-on-surface" onClick={() => { setShowAuthVars(false); setAuthVarsPreview(null) }}>
                        Close
                      </button>
                    </div>
                  </div>
                  <pre className="text-xs overflow-x-auto max-h-60">{authVarsPreview ? JSON.stringify(authVarsPreview, null, 2) : 'No persisted variations found'}</pre>
                </Card>
              </div>
            )}

            {/* Daily Schedule (wide format) */}
            <div className="w-full bg-surface-container rounded-m3-xl border-none shadow-elevation-1 p-2 sm:p-4 mx-auto max-w-full">
              <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-full bg-primary/10 text-primary">
                  <CalendarIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-bold text-on-surface truncate">{formatSelectedDate()}</h2>
                </div>
              </div>

              {isWeekend && (
                <div className="py-16 text-center">
                  <Utensils className="h-12 w-12 mx-auto mb-4 text-primary/40" />
                  <h3 className="text-2xl font-bold text-on-surface mb-2">No periods on this day</h3>
                  <p className="text-on-surface-variant text-lg">Relax, recharge, and enjoy the downtime.</p>
                </div>
              )}

              {!isSchoolDay && !isWeekend && (
                <div className="py-16 text-center">
                  <Utensils className="h-12 w-12 mx-auto mb-4 text-primary/40" />
                  <h3 className="text-2xl font-bold text-on-surface mb-2">No periods on this day</h3>
                  <p className="text-on-surface-variant text-lg">Kick back, find a comfy spot, and let school wait...</p>
                </div>
              )}

              {!isWeekend && isSchoolDay && todaysTimetable.length > 0 && (
                <>
                  {showDiag && (
                    <div className="w-full mb-4">
                      <Card className="bg-surface-container-high p-3 border-none">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-on-surface">Portal Diagnostics</div>
                          <div>
                            <button
                              className="px-2 py-1 text-xs rounded-full bg-surface-container-highest text-on-surface"
                              onClick={() => {
                                setShowDiag(false)
                                setDiagResult(null)
                              }}
                            >
                              Close
                            </button>
                          </div>
                        </div>
                        <div className="text-xs text-on-surface-variant">
                          {diagLoading && <div>Running diagnostics…</div>}
                          {!diagLoading && diagResult && (
                            <>
                              <pre className="text-xs overflow-auto max-h-64 bg-surface p-2 rounded">{JSON.stringify(diagResult, null, 2)}</pre>
                              {/* If the portal returned an HTML login page, surface a Sign in CTA */}
                              {Array.isArray(diagResult.results) && diagResult.results.some((r: any) => (r.contentType || '').includes('text/html') && (r.snippet || '').toLowerCase().includes('sign in')) && (
                                <div className="mt-2">
                                  <div className="text-sm text-yellow-700 dark:text-yellow-300 mb-2">Diagnostics detected the portal login page — please sign in to the SBHS portal to allow Synchron to fetch live JSON.</div>
                                  <div className="flex gap-2">
                                    <Button size="sm" onClick={() => { try { window.location.href = '/api/auth/login' } catch { window.location.assign('/api/auth/login') } }}>Sign in to portal</Button>
                                    <Button size="sm" variant="outline" onClick={() => fetchDiagnostics()}>Re-run diagnostics</Button>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                          {!diagLoading && !diagResult && (
                            <div className="text-sm text-on-surface-variant">No diagnostics run yet. Click Diagnostics to probe portal endpoints.</div>
                          )}
                        </div>
                      </Card>
                    </div>
                  )}

                  <div className="space-y-3 flex-1 pr-0 sm:pr-2">
                    {todaysTimetable.map((period, idx) => {
                      // Compute start time for display
                      let startTime = ''
                      try {
                        const apiTime = findBellTimeForPeriod(period, bucketForSelectedDay, idx) || ''
                        const timeSrc = bellTimes ? (apiTime || (period.time || '')) : ((period.time || '') || apiTime) || ''
                        const { start } = parseTimeRange(timeSrc || '')
                        startTime = formatTo12Hour(start)
                      } catch (e) {
                        startTime = ((bellTimes ? (findBellTimeForPeriod(period, bucketForSelectedDay, idx) || period.time) : (period.time || findBellTimeForPeriod(period, bucketForSelectedDay, idx)) || '').split(' - ')[0] || '')
                      }
                      
                      // Treat Period 0, Roll Call, End of Day, and Break as non-class periods
                      const periodLabel = String(period.period || '').trim().toLowerCase()
                      const subjectLabel = String(period.subject || '').trim().toLowerCase()
                      const isBreak = period.subject === 'Break' || 
                        periodLabel === '0' || periodLabel === 'rc' || periodLabel === 'eod' ||
                        subjectLabel.includes('period 0') || subjectLabel.includes('roll call') || subjectLabel.includes('end of day')
                      // Get display label for non-class periods
                      const nonClassLabel = (() => {
                        if (period.subject === 'Break') return period.period
                        if (periodLabel === '0' || subjectLabel.includes('period 0')) return 'Period 0'
                        if (periodLabel === 'rc' || subjectLabel.includes('roll call')) return 'Roll Call'
                        if (periodLabel === 'eod' || subjectLabel.includes('end of day')) return 'End of Day'
                        return period.period || period.subject
                      })()
                      const teacherDisplay = (() => {
                        if (!period) return null
                        if ((period as any).displayTeacher) return stripLeadingCasualCode((period as any).displayTeacher)
                        if (period.isSubstitute && (period as any).casualSurname) return (period as any).casualSurname
                        const candidate = period.fullTeacher || period.teacher || null
                        if (period.isSubstitute && candidate) return stripLeadingCasualCode(candidate)
                        return candidate
                      })()
                      const roomDisplay = (() => {
                        const displayRoom = (period as any).displayRoom || (period as any).toRoom || (period as any).roomTo || (period as any)["room_to"] || (period as any).newRoom || period.room
                        return displayRoom
                      })()
                      
                      const cardClass = 'flex-1 w-full min-w-0 px-3 py-2 rounded-xl border transition-all shadow-sm bg-surface hover:bg-surface-container-high border-transparent hover:border-outline-variant'

                      return (
                        <div key={period.id ?? idx} className="flex gap-3 items-start group cursor-pointer w-full">
                          <div className="flex flex-col items-center min-w-[2.5rem] sm:min-w-[3rem]">
                            <span className="text-xs font-bold text-muted-foreground">{startTime}</span>
                          </div>

                          {isBreak ? (
                            <div className="flex-1 text-sm text-muted-foreground flex items-center">{nonClassLabel}</div>
                          ) : (
                            <div className={`${cardClass} flex items-center gap-2`}>
                              {/* Subject colour bar */}
                              {period.colour && (
                                <div 
                                  className="w-1 min-w-[4px] rounded-lg self-stretch" 
                                  style={{ backgroundColor: `#${period.colour}` }} 
                                />
                              )}
                              <div className="flex-1">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span 
                                      className={`hidden md:inline-block px-2 py-0.5 rounded-md text-xs font-medium truncate max-w-[200px] ${getSubjectColor(period.subject, period.colour)}`}
                                      style={getSubjectColorStyle(period.subject, period.colour)}
                                    >
                                      {getDisplaySubject(period)}
                                    </span>
                                  </div>
                                  <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
                                    {isSubstitutePeriod(period) ? (
                                      <span className="inline-block px-2 py-0.5 rounded-md text-xs font-medium truncate max-w-[100px]"
                                        style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}
                                      >
                                        {teacherDisplay}
                                      </span>
                                    ) : (
                                      <span className="text-on-surface-variant truncate max-w-[100px]">{teacherDisplay}</span>
                                    )}
                                    <span>•</span>
                                    <span className={`truncate max-w-[72px] text-sm ${period.isRoomChange ? 'inline-block px-2 py-0.5 rounded-md font-medium' : 'text-on-surface-variant'}`}
                                      style={period.isRoomChange ? { backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' } : {}}
                                    >
                                      {roomDisplay}
                                    </span>
                                  </div>
                                </div>
                                <div className="md:hidden flex items-center justify-between gap-3 text-xs text-muted-foreground w-full">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div 
                                      className={`rounded-lg px-2 py-0.5 text-xs font-semibold flex-shrink-0 text-center max-w-[220px] truncate ${getSubjectColor(period.subject, period.colour)}`}
                                      style={getSubjectColorStyle(period.subject, period.colour)}
                                    >
                                      <span className="truncate block max-w-full text-xs font-semibold leading-none">{period.subject}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0 text-right">
                                    {isSubstitutePeriod(period) ? (
                                      <span className="inline-block px-2 py-0.5 rounded-md text-xs font-medium truncate max-w-[92px]"
                                        style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}
                                      >
                                        {teacherDisplay}
                                      </span>
                                    ) : (
                                      <span className="text-on-surface-variant truncate max-w-[92px]">{teacherDisplay}</span>
                                    )}
                                    <span className="text-on-surface-variant">•</span>
                                    <span className={`truncate max-w-[56px] text-xs ${period.isRoomChange ? 'inline-block px-2 py-0.5 rounded-md font-medium' : 'text-on-surface-variant'}`}
                                      style={period.isRoomChange ? { backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' } : {}}
                                    >
                                      {roomDisplay}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {!isWeekend && isSchoolDay && todaysTimetable.length === 0 && (
                <div className="py-16 text-center">
                  <Utensils className="h-12 w-12 mx-auto mb-4 text-primary/40" />
                  <h3 className="text-2xl font-bold text-on-surface mb-2">No periods on this day</h3>
                  <p className="text-on-surface-variant text-lg">Put your feet up, grab a blanket, and just be...</p>
                </div>
              )}
            </div>
          </>
        )}

        {viewMode === "cycle" && (
          <>
            {/* Full Cycle View (show both Week A and Week B) */}

            {/* Grid Timetable */}
            <Card className="bg-surface-container rounded-m3-xl border-none shadow-elevation-1">
              <div className="p-6">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-semibold text-on-surface">Full Cycle Timetable</h2>
                  <p className="text-sm text-on-surface-variant">Week A and Week B</p>
                </div>

                {/* Days Header */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 sm:gap-6 mb-6">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => (
                    <div key={day} className="text-center">
                      <h3 className="font-semibold text-on-surface-variant text-base">{day.substring(0, 3)}{(externalWeekType ?? currentWeek) ? ` ${externalWeekType ?? currentWeek}` : ''}</h3>
                    </div>
                  ))}
                </div>

                {/* Timetable Grid: each day shows Week A then Week B */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 sm:gap-6">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => {
                    // prefer grouped timetableByWeek when available
                    // fall back to showing the current week's data if grouped data isn't present.
                    const tt = timetableByWeek
                    return (
                      <div key={day} className="space-y-3">
                        {/* Week A */}
                        <div className="p-2 rounded-md bg-surface-container-high">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-medium">Week A</div>
                          </div>
                          {(() => {
                            // Prefer provider's grouped data if available
                            try {
                              const itemsA = tt && tt[day] && Array.isArray(tt[day].A) ? tt[day].A : (timetableData[day] || [])
                              const bucketA = bellTimes ? (day === 'Friday' ? bellTimes.Fri : (day === 'Wednesday' || day === 'Thursday' ? bellTimes['Wed/Thurs'] : bellTimes['Mon/Tues'])) : null
                              return itemsA.map((period: any, idx: number) => (
                                period.subject === 'Break' ? (
                                  <div key={(period.id ?? period.period) + '-A'} className="flex items-center gap-3">
                                    <div className="w-14 sm:w-16 text-sm font-medium text-on-surface-variant">
                                      {(() => {
                                        try {
                                          const apiTime = findBellTimeForPeriod(period, bucketA, idx) || ''
                                          const timeSrc = bellTimes ? (apiTime || (period.time || '')) : ((period.time || '') || apiTime) || ''
                                          const { start } = parseTimeRange(timeSrc || '')
                                          return formatTo12Hour(start)
                                        } catch (e) { return ((period.time || (bucketA && bucketA[idx] && bucketA[idx].time) || '').split(' - ')[0] || '') }
                                      })()}
                                    </div>
                                    <div className="flex-1 text-sm text-on-surface-variant">{period.period}</div>
                                  </div>
                                ) : (
                                  <div key={(period.id ?? period.period) + '-A'} className="flex items-center gap-3">
                                    <div className="w-16 text-sm font-medium text-on-surface-variant">
                                      {(() => {
                                        try {
                                          if (period.time) {
                                            const { start } = parseTimeRange(period.time || '')
                                            return formatTo12Hour(start)
                                          }
                                            try {
                                              const apiTime = findBellTimeForPeriod(period, bucketA, idx) || ''
                                              const timeSrc = bellTimes ? (apiTime || (period.time || '')) : ((period.time || '') || apiTime) || ''
                                              if (timeSrc) {
                                                const { start } = parseTimeRange(timeSrc || '')
                                                return formatTo12Hour(start)
                                              }
                                            } catch (e) {}
                                        
                                          return ''
                                        } catch (e) {}
                                        return ''
                                      })()}
                                    </div>
                                    <div 
                                      className={`rounded-md px-2 py-0.5 text-xs font-medium flex-shrink-0 min-w-[32px] text-center ${getSubjectColor(period.subject, period.colour)}`}
                                      style={getSubjectColorStyle(period.subject, period.colour)}
                                    >
                                      {getSubjectAbbr(period.subject)}
                                    </div>
                                    <div className="text-sm font-medium text-on-surface flex-1 min-w-0">
                                      <div className="flex items-center justify-between">
                                        {/* Only show classroom on the right; remove duplicate class name and teacher */}
                                        <div className={`text-xs hidden md:block ${period.isRoomChange ? 'bg-blue-600 text-white px-3 py-1 rounded-full font-medium' : 'text-on-surface-variant'}`}>{getDisplayRoom(period)}</div>
                                        <div className={`md:hidden text-xs mt-1 truncate ${period.isRoomChange ? 'bg-blue-600 text-white px-3 py-1 rounded-full font-medium' : 'text-on-surface-variant'}`}>{getDisplayRoom(period)}</div>
                                      </div>
                                    </div>
                                  </div>
                                )
                              ))
                            } catch (e) {
                              return <div className="text-xs text-on-surface-variant">No data</div>
                            }
                          })()}
                        </div>

                        {/* Week B */}
                        <div className="p-2 rounded-md bg-surface-container-high">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-medium">Week B</div>
                          </div>
                          {(() => {
                            try {
                              const itemsB = tt && tt[day] && Array.isArray(tt[day].B) ? tt[day].B : []
                              if ((!itemsB || itemsB.length === 0) && (!tt || !tt[day])) {
                                // no grouped data available; indicate there's only one week available
                                return <div className="text-xs text-on-surface-variant">Only one week available</div>
                              }
                              const bucketB = bellTimes ? (day === 'Friday' ? bellTimes.Fri : (day === 'Wednesday' || day === 'Thursday' ? bellTimes['Wed/Thurs'] : bellTimes['Mon/Tues'])) : null
                              return itemsB.map((period: any, idx: number) => (
                                period.subject === 'Break' ? (
                                  <div key={(period.id ?? period.period) + '-B'} className="flex items-center gap-3">
                                    <div className="w-16 text-sm font-medium text-on-surface-variant">
                                      {(() => {
                                        try {
                                          const apiTime = findBellTimeForPeriod(period, bucketB, idx) || ''
                                          const timeSrc = bellTimes ? (apiTime || (period.time || '')) : ((period.time || '') || apiTime) || ''
                                          const { start } = parseTimeRange(timeSrc || '')
                                          return formatTo12Hour(start)
                                        } catch (e) { return ((period.time || (bucketB && bucketB[idx] && bucketB[idx].time) || '').split(' - ')[0] || '') }
                                      })()}
                                    </div>
                                    <div className="flex-1 text-sm text-on-surface-variant">{period.period}</div>
                                  </div>
                                ) : (
                                  <div key={(period.id ?? period.period) + '-B'} className="flex items-center gap-3">
                                    <div className="w-16 text-sm font-medium text-on-surface-variant">
                                      {(() => {
                                        try {
                                          if (period.time) {
                                            const { start } = parseTimeRange(period.time || '')
                                            return formatTo12Hour(start)
                                          }
                                            try {
                                              const apiTime = findBellTimeForPeriod(period, bucketB, idx) || ''
                                              const timeSrc = bellTimes ? (apiTime || (period.time || '')) : ((period.time || '') || apiTime) || ''
                                              if (timeSrc) {
                                                const { start } = parseTimeRange(timeSrc || '')
                                                return formatTo12Hour(start)
                                              }
                                            } catch (e) {}
                                            return ''
                                        } catch (e) {}
                                        return ''
                                      })()}
                                    </div>
                                    <div 
                                      className={`rounded-md px-2 py-0.5 text-xs font-medium flex-shrink-0 min-w-[32px] text-center ${getSubjectColor(period.subject, period.colour)}`}
                                      style={getSubjectColorStyle(period.subject, period.colour)}
                                    >
                                      {getSubjectAbbr(period.subject)}
                                    </div>
                                    <div className="text-sm font-medium text-on-surface flex-1 min-w-0">
                                      <div className="flex items-center justify-between">
                                        {/* Only show classroom on the right; remove duplicate class name and teacher */}
                                        <div className={`text-xs hidden md:block ${period.isRoomChange ? 'bg-blue-600 text-white px-3 py-1 rounded-full font-medium' : 'text-on-surface-variant'}`}>{getDisplayRoom(period)}</div>
                                        <div className={`md:hidden text-xs mt-1 truncate ${period.isRoomChange ? 'bg-blue-600 text-white px-3 py-1 rounded-full font-medium' : 'text-on-surface-variant'}`}>{getDisplayRoom(period)}</div>
                                      </div>
                                    </div>
                                  </div>
                                )
                              ))
                            } catch (e) {
                              return <div className="text-xs text-on-surface-variant">No data</div>
                            }
                          })()}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </Card>
          </>
        )}

        {/* Date Picker Dialog */}
        <DatePicker
          open={isDatePickerOpen}
          onOpenChange={setIsDatePickerOpen}
          selectedDate={selectedDateObject}
          onDateSelect={setSelectedDateObject}
          title="Select a Date"
        />
      </div>
    </PageTransition>
  )
}
