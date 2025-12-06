"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { ChevronLeft, Calendar as CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Calendar as DatePicker } from "@/components/ui/calendar"
import { trackSectionUsage } from "@/utils/usage-tracker"
import PageTransition from "@/components/page-transition"
import { useTimetable } from "@/contexts/timetable-context"
import { parseTimeRange, formatTo12Hour, isSchoolDayOver, getNextSchoolDay } from "@/utils/time-utils"

export default function TimetablePage() {
  const [mounted, setMounted] = useState(false)
  // Use selected date from timetable context so the header date follows
  // the provider's school-day logic (shows next school day after school ends).
  const [viewMode, setViewMode] = useState<"daily" | "cycle">("daily")
  const { currentWeek, externalWeekType, timetableData, timetableSource, refreshExternal, selectedDateObject, setSelectedDateObject, timetableByWeek, lastUserSelectedAt, bellTimes } = useTimetable()
  // debug values
  const { lastFetchedDate, lastFetchedPayloadSummary } = useTimetable()

  useEffect(() => {
    setMounted(true)
    trackSectionUsage("timetable")
  }, [])

  const [showDiag, setShowDiag] = useState(false)
  const [diagLoading, setDiagLoading] = useState(false)
  const [diagResult, setDiagResult] = useState<any | null>(null)

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

  // Subject color mapping
  const getSubjectColor = (subject: string) => {
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
  const getDisplaySubject = (period: any) => {
    if (period.subject === "Break") {
      return period.period // Show "Recess", "Lunch 1", etc. instead of "Break"
    }
    return period.subject
  }

  const getDisplayRoom = (period: any) => {
    try {
      if (!period) return ''
      const display = (period as any).displayRoom || (period as any).toRoom || (period as any).roomTo || (period as any)['room_to'] || (period as any).newRoom || (period as any).to
      if (display && String(display).trim()) return String(display)
    } catch (e) {}
    return period.room || ''
  }

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  const selectedDayName = days[displayDateObject.getDay()]
  const isWeekend = selectedDayName === "Sunday" || selectedDayName === "Saturday"
  const todaysTimetableRaw = timetableData[selectedDayName] || []
  // Provider bell bucket for the selected day (used when individual period.time is missing)
  const bucketForSelectedDay = bellTimes ? (selectedDayName === 'Friday' ? bellTimes.Fri : (selectedDayName === 'Wednesday' || selectedDayName === 'Thursday' ? bellTimes['Wed/Thurs'] : bellTimes['Mon/Tues'])) : null

  const normalizePeriodLabel = (p?: string) => String(p || '').trim().toLowerCase()
  // Keep Roll Call / Period 0 and Break rows visible — show all raw entries
  const todaysTimetable = todaysTimetableRaw

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
      <div className="w-full max-w-6xl mx-auto px-3 sm:px-4 py-6 pb-24">
        <div className="flex items-center justify-between mb-6 fade-in">
          <Link
            href="/"
            className="hidden md:flex text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-on-surface md:text-center md:flex-1">My Synchron</h1>
          {/* Data source badge and manual refresh */}
          <div className="flex items-center gap-2">
            <div className="text-xs text-on-surface-variant flex items-center gap-2">
              {timetableSource === 'fallback-sample' ? (
                <span className="px-2 py-1 rounded-full bg-tertiary-container text-on-tertiary-container">Using sample data</span>
              ) : timetableSource ? (
                <span className="px-2 py-1 rounded-full bg-primary-container text-on-primary-container">Live data</span>
              ) : null}
              {/* Debug badge showing authoritative API week vs provider currentWeek */}
              {externalWeekType ? (
                <span className="px-2 py-1 rounded-full bg-surface-200 text-on-surface text-xs">API week: {externalWeekType}</span>
              ) : (
                <span className="px-2 py-1 rounded-full bg-surface-200 text-on-surface text-xs">API week: —</span>
              )}
              <span className="px-2 py-1 rounded-full bg-surface-200 text-on-surface text-xs">UI week: {currentWeek ?? '—'}</span>
              {/* Small debug info about last fetch */}
              <div className="ml-2 text-xs text-on-surface-variant">
                <div>fetched: {lastFetchedDate ?? '—'}</div>
                <div>payload: {lastFetchedPayloadSummary ? JSON.stringify(lastFetchedPayloadSummary) : '—'}</div>
              </div>
            </div>
            <button
              onClick={async () => {
                try {
                  if (refreshExternal) await refreshExternal()
                } catch (e) {
                  // ignore user-facing errors here — provider will fall back to sample if needed
                }
              }}
              className="hidden md:inline-flex px-3 py-1 rounded-full bg-surface-container-high text-on-surface text-sm hover:bg-surface-container-highest transition-colors"
              title="Retry loading live timetable"
            >
              Refresh
            </button>
            <button
              onClick={() => fetchDiagnostics()}
              className="hidden md:inline-flex px-3 py-1 rounded-full bg-surface-container-high text-on-surface text-sm hover:bg-surface-container-highest transition-colors"
              title="Run portal diagnostics"
            >
              {diagLoading ? 'Checking...' : 'Diagnostics'}
            </button>
          </div>
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
            <div className="flex items-center justify-between mb-4 max-w-lg mx-auto">
              <button
                className="p-2 rounded-full bg-surface-container-high text-on-surface-variant transition-all duration-200 ease-in-out hover:bg-surface-container-highest hover:text-on-surface"
                onClick={goToPreviousDay}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

                <div className="text-center">
                  <h2 className="font-semibold text-on-surface">{selectedDayName}</h2>
                  <div className="text-sm text-on-surface-variant">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="px-3 py-1 rounded-md bg-transparent hover:bg-surface-container-highest transition-colors text-sm">
                          {displayDateObject.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto">
                        <DatePicker
                          mode="single"
                          selected={displayDateObject}
                          onSelect={(d: Date | undefined) => {
                            if (d) setSelectedDateObject(d)
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
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
              <div className="flex justify-center mb-6">
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

            {/* Daily Schedule (wide format) */}
            <div className="w-full bg-surface-container rounded-m3-xl border-none shadow-elevation-1 p-3 sm:p-4 mx-auto max-w-[680px]">
              <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-full bg-primary/10 text-primary">
                  <CalendarIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-semibold text-on-surface truncate">{selectedDayName} Schedule</h2>
                  <p className="text-xs sm:text-sm text-on-surface-variant truncate">{formatSelectedDate()}</p>
                </div>
              </div>

              {isWeekend && (
                <div className="py-8 text-center text-on-surface-variant bg-surface-container-high/50 rounded-xl">
                  No classes scheduled for weekends
                </div>
              )}

              {!isWeekend && todaysTimetable.length > 0 && (
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

                  <div className="space-y-3">
                    {todaysTimetable.map((period, idx) => (
                      period.subject === "Break" ? (
                        <div key={period.id ?? period.period} className="flex items-start gap-3 py-2">
                          <div className="w-16 sm:w-20 text-sm font-medium text-on-surface-variant">
                              {(() => {
                                try {
                                  const apiTime = findBellTimeForPeriod(period, bucketForSelectedDay, idx) || ''
                                  const timeSrc = bellTimes ? (apiTime || (period.time || '')) : ((period.time || '') || apiTime) || ''
                                  const { start } = parseTimeRange(timeSrc || '')
                                  return formatTo12Hour(start)
                                } catch (e) { return ((bellTimes ? (findBellTimeForPeriod(period, bucketForSelectedDay, idx) || period.time) : (period.time || findBellTimeForPeriod(period, bucketForSelectedDay, idx)) || '').split(' - ')[0] || '') }
                              })()}
                          </div>
                          <div className="flex-1 text-sm text-on-surface-variant">{period.period}</div>
                        </div>
                      ) : (
                        <div key={period.id ?? period.period} className="flex items-start gap-3 py-2">
                          <div className="w-16 sm:w-20 text-sm font-medium text-on-surface-variant">
                              {(() => {
                                  try {
                                    const apiTime = findBellTimeForPeriod(period, bucketForSelectedDay, idx) || ''
                                    const timeSrc = bellTimes ? (apiTime || (period.time || '')) : ((period.time || '') || apiTime) || ''
                                    const { start } = parseTimeRange(timeSrc || '')
                                    return formatTo12Hour(start)
                                  } catch (e) { return ((bellTimes ? (findBellTimeForPeriod(period, bucketForSelectedDay, idx) || period.time) : (period.time || findBellTimeForPeriod(period, bucketForSelectedDay, idx)) || '').split(' - ')[0] || '') }
                                })()}
                          </div>
                          <div className="flex-1">
                              <div className={`p-2 sm:p-3 rounded-xl flex items-center bg-surface-container-high`}> 
                              <div className="min-w-0 pr-1">
                                <div className={`text-base sm:text-lg font-semibold truncate ${period.isSubstitute ? 'text-on-primary-foreground' : 'text-on-surface'}`}>{getDisplaySubject(period)}</div>
                              </div>
                              <div className="flex items-center gap-2 ml-1 flex-shrink-0">
                                {/* Teacher (highlight only when substitute/casual) - stronger pill when substitute */}
                                {period.isSubstitute ? (
                                    <span className="px-2 py-1 rounded-md text-sm bg-primary/80 text-black truncate max-w-[100px]">{(period as any).casualSurname ? (period as any).casualSurname : (period.fullTeacher || period.teacher)}</span>
                                ) : (
                                  <span className="text-sm text-on-surface-variant truncate max-w-[100px]">{period.fullTeacher || period.teacher}</span>
                                )}
                                {/* Room: if the API provided a room variation, show the destination room and highlight it like substitute teacher */}
                                {period.isRoomChange ? (
                                  <span className="px-2 py-1 rounded-md text-sm bg-primary/80 text-black truncate max-w-[72px]">{getDisplayRoom(period)}</span>
                                ) : (
                                  <span className={`${period.isSubstitute ? 'text-on-primary-foreground' : 'text-sm text-on-surface-variant'} truncate max-w-[72px]`}>{getDisplayRoom(period)}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                </>
              )}

              {!isWeekend && todaysTimetable.length === 0 && (
                <div className="py-8 text-center text-on-surface-variant bg-surface-container-high/50 rounded-xl">
                  No classes scheduled for this day
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
                      <h3 className="font-semibold text-on-surface-variant text-base">{day.substring(0, 3)}</h3>
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
                                    <div className={`rounded-lg px-3 py-2 text-base font-bold flex-shrink-0 min-w-[40px] text-center ${getSubjectColor(period.subject)}`}>
                                      {getSubjectAbbr(period.subject)}
                                    </div>
                                    <div className="text-sm font-medium text-on-surface flex-1 min-w-0">
                                      <div className="flex items-center justify-between">
                                        {/* Only show classroom on the right; remove duplicate class name and teacher */}
                                        <div className="text-xs text-on-surface-variant hidden md:block">{getDisplayRoom(period)}</div>
                                        <div className="md:hidden text-xs text-on-surface-variant mt-1 truncate">{getDisplayRoom(period)}</div>
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
                                    <div className={`rounded-lg px-3 py-2 text-base font-bold flex-shrink-0 min-w-[40px] text-center ${getSubjectColor(period.subject)}`}>
                                      {getSubjectAbbr(period.subject)}
                                    </div>
                                    <div className="text-sm font-medium text-on-surface flex-1 min-w-0">
                                      <div className="flex items-center justify-between">
                                        {/* Only show classroom on the right; remove duplicate class name and teacher */}
                                        <div className="text-xs text-on-surface-variant hidden md:block">{getDisplayRoom(period)}</div>
                                        <div className="md:hidden text-xs text-on-surface-variant mt-1 truncate">{getDisplayRoom(period)}</div>
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
      </div>
    </PageTransition>
  )
}
