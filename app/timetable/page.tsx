"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { ChevronLeft, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { trackSectionUsage } from "@/utils/usage-tracker"
import PageTransition from "@/components/page-transition"
import { useTimetable } from "@/contexts/timetable-context"
import { parseTimeRange, formatTo12Hour, isSchoolDayOver, getNextSchoolDay } from "@/utils/time-utils"

export default function TimetablePage() {
  const [mounted, setMounted] = useState(false)
  // Use selected date from timetable context so the header date follows
  // the provider's school-day logic (shows next school day after school ends).
  const [viewMode, setViewMode] = useState<"daily" | "cycle">("daily")
  const { currentWeek, externalWeekType, timetableData, timetableSource, refreshExternal, selectedDateObject, setSelectedDateObject, timetableByWeek } = useTimetable()
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
      const res = await fetch('/api/portal/substitutions/debug', { credentials: 'include' })
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

  // Use provider-selected date by default
  const getSelectedDayName = () => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    // If the provider's selected date is today and it's after school hours or a weekend,
    // display the next school day instead (this mirrors home view behaviour).
    try {
      const now = new Date()
      const sameDate = selectedDateObject.toDateString() === now.toDateString()
      const isWeekend = now.getDay() === 0 || now.getDay() === 6
      if (sameDate && (isWeekend || isSchoolDayOver())) {
        const next = getNextSchoolDay(now)
        return days[next.getDay()]
      }
    } catch (e) {}
    return days[selectedDateObject.getDay()]
  }

  const formatSelectedDate = () => {
    // Show weekday and date+month (no year) as requested: "Monday, 1 December"
    const opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }
    return selectedDateObject.toLocaleDateString('en-US', opts)
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

  const selectedDayName = getSelectedDayName()
  const isWeekend = selectedDayName === "Sunday" || selectedDayName === "Saturday"
  const todaysTimetableRaw = timetableData[selectedDayName] || []

  const normalizePeriodLabel = (p?: string) => String(p || '').trim().toLowerCase()
  const isRollCallEntry = (p: any) => {
    const subj = String(p.subject || '').toLowerCase()
    const per = normalizePeriodLabel(p.period)
    return subj.includes('roll call') || subj === 'rollcall' || per === 'rc' || subj === 'rc' || subj.includes('roll')
  }
  const hasPeriod0 = todaysTimetableRaw.some(p => normalizePeriodLabel(p.period) === '0')
  const todaysTimetable = todaysTimetableRaw.filter(p => {
    if (isRollCallEntry(p)) return false
    if (!hasPeriod0 && normalizePeriodLabel(p.period) === '0') return false
    return true
  })

  if (!mounted) return null

  return (
    <PageTransition>
      <div className="container max-w-6xl mx-auto px-4 py-6 pb-24">
        <div className="flex items-center justify-between mb-6 fade-in">
          <Link
            href="/"
            className="hidden md:flex text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-2xl font-bold text-on-surface md:text-center md:flex-1">My Synchron</h1>
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
            <Card className="bg-surface-container rounded-m3-xl border-none shadow-elevation-1 p-4">
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
                <p className="text-sm text-on-surface-variant">
                  {selectedDateObject.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>

              <button
                className="p-2 rounded-full bg-surface-container-high text-on-surface-variant transition-all duration-200 ease-in-out hover:bg-surface-container-highest hover:text-on-surface"
                onClick={goToNextDay}
              >
                <ChevronLeft className="h-5 w-5 rotate-180" />
              </button>
            </div>

            {/* Today Button */}
            <div className="flex justify-center mb-6">
              <Button
                onClick={goToToday}
                variant="outline"
                size="sm"
                className="rounded-full border-outline text-on-surface hover:bg-surface-container-high"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Today
              </Button>
            </div>

            {/* Daily Schedule */}
            <Card className="bg-surface-container rounded-m3-xl border-none shadow-elevation-1 max-w-lg mx-auto p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-full bg-primary/10 text-primary">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-on-surface">{selectedDayName} Schedule</h2>
                  <p className="text-sm text-on-surface-variant">{formatSelectedDate()}</p>
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

                  <div className="space-y-1.5">
                    {todaysTimetable.map((period) => (
                      period.subject === "Break" ? (
                        <div key={period.id ?? period.period} className="flex items-center gap-3 py-1">
                          <span className="text-sm font-medium text-on-surface-variant flex-shrink-0 w-[4.5rem] text-left">
                            {(() => {
                              try {
                                const { start } = parseTimeRange(period.time || '')
                                return formatTo12Hour(start)
                              } catch (e) { return (period.time || '').split(' - ')[0] }
                            })()}
                          </span>
                          <div className="text-sm text-on-surface-variant">{period.period}</div>
                        </div>
                      ) : (
                        <div
                          key={period.id}
                          className={`rounded-xl p-3 transition-all duration-200 ease-in-out bg-surface-container-high`}
                        >
                          <div className="flex items-center gap-3">
                            {/* Time on the left */}
                            <span className="text-sm font-medium text-on-surface-variant flex-shrink-0 w-[4.5rem] text-left">
                              {(() => {
                                try {
                                  const { start } = parseTimeRange(period.time || '')
                                  return formatTo12Hour(start)
                                } catch (e) { return (period.time || '').split(' - ')[0] }
                              })()}{/* Only show start time */}
                            </span>

                            {/* Main content: subject + small meta line with room and teacher on one line */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm truncate text-on-surface">{getDisplaySubject(period)}</span>
                                {period.isSubstitute && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-tertiary-container text-on-tertiary-container">Sub</span>
                                )}
                                {period.isRoomChange && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary-container text-on-secondary-container">Room</span>
                                )}
                              </div>

                                    <div className="text-xs text-on-surface-variant truncate mt-1">{period.room} • {period.isSubstitute ? period.teacher : (period.fullTeacher || period.teacher)}</div>
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
            </Card>
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
                <div className="grid grid-cols-5 gap-6 mb-6">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => (
                    <div key={day} className="text-center">
                      <h3 className="font-semibold text-on-surface-variant text-base">{day.substring(0, 3)}</h3>
                    </div>
                  ))}
                </div>

                {/* Timetable Grid: each day shows Week A then Week B */}
                <div className="grid grid-cols-5 gap-6">
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
                              return itemsA.filter((p: any) => p.subject !== 'Break').map((period: any) => (
                                <div key={(period.id ?? period.period) + '-A'} className="flex items-center gap-3">
                                  <div className={`rounded-lg px-3 py-2 text-base font-bold flex-shrink-0 min-w-[40px] text-center ${getSubjectColor(period.subject)}`}>
                                    {getSubjectAbbr(period.subject)}
                                  </div>
                                  <div className="text-sm font-medium text-on-surface flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                      {/* Only show classroom on the right; remove duplicate class name and teacher */}
                                      <div className="text-xs text-on-surface-variant hidden md:block">{period.room}</div>
                                      <div className="md:hidden text-xs text-on-surface-variant mt-1 truncate">{period.room}</div>
                                    </div>
                                  </div>
                                </div>
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
                              return itemsB.filter((p: any) => p.subject !== 'Break').map((period: any) => (
                                <div key={(period.id ?? period.period) + '-B'} className="flex items-center gap-3">
                                  <div className={`rounded-lg px-3 py-2 text-base font-bold flex-shrink-0 min-w-[40px] text-center ${getSubjectColor(period.subject)}`}>
                                    {getSubjectAbbr(period.subject)}
                                  </div>
                                  <div className="text-sm font-medium text-on-surface flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                      {/* Only show classroom on the right; remove duplicate class name and teacher */}
                                      <div className="text-xs text-on-surface-variant hidden md:block">{period.room}</div>
                                      <div className="md:hidden text-xs text-on-surface-variant mt-1 truncate">{period.room}</div>
                                    </div>
                                  </div>
                                </div>
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
