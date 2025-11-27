"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { ChevronLeft, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { trackSectionUsage } from "@/utils/usage-tracker"
import PageTransition from "@/components/page-transition"
import { useTimetable } from "@/contexts/timetable-context"

export default function TimetablePage() {
  const [mounted, setMounted] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [viewMode, setViewMode] = useState<"daily" | "cycle">("daily")
  const { currentWeek, setCurrentWeek, timetableData, timetableSource, refreshExternal } = useTimetable()

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

  // Get day name from selected date
  const getSelectedDayName = () => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    return days[selectedDate.getDay()]
  }

  // Format selected date
  const formatSelectedDate = () => {
    return selectedDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  }

  // Navigate dates
  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() - 1)
    setSelectedDate(newDate)
  }

  const goToNextDay = () => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + 1)
    setSelectedDate(newDate)
  }

  const goToToday = () => {
    setSelectedDate(new Date())
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
  const todaysTimetable = timetableData[selectedDayName] || []

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
            <div className="text-xs text-on-surface-variant flex items-center">
              {timetableSource === 'fallback-sample' ? (
                <span className="px-2 py-1 rounded-full bg-tertiary-container text-on-tertiary-container">Using sample data</span>
              ) : timetableSource ? (
                <span className="px-2 py-1 rounded-full bg-primary-container text-on-primary-container">Live data</span>
              ) : null}
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
                  {selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
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
                      <div
                        key={period.id}
                        className={`rounded-xl p-3 transition-all duration-200 ease-in-out ${
                          period.subject === "Break" ? "bg-surface-container-high/50" : "bg-surface-container-high"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Time on the left */}
                          <span className="text-sm font-medium text-on-surface-variant flex-shrink-0 w-[4.5rem] text-left">
                            {period.time.split(" - ")[0]} {/* Only show start time */}
                          </span>

                          {/* Main content: subject + small meta line with room and teacher on one line */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm truncate text-on-surface">{getDisplaySubject(period)}</span>
                              {period.subject !== "Break" && (
                                <>
                                  {period.isSubstitute && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-tertiary-container text-on-tertiary-container">Sub</span>
                                  )}
                                  {period.isRoomChange && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary-container text-on-secondary-container">Room</span>
                                  )}
                                </>
                              )}
                            </div>

                            {period.subject !== "Break" ? (
                              <div className="text-xs text-on-surface-variant truncate mt-1">{period.room} • {period.teacher}</div>
                            ) : (
                              <div className="text-xs text-on-surface-variant mt-1">{period.period}</div>
                            )}
                          </div>
                        </div>
                      </div>
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
            {/* Week A/B Toggle */}
            <div className="flex justify-center mb-6">
              <div className="bg-surface-container-high p-1 rounded-full">
                <button
                  onClick={() => setCurrentWeek("A")}
                  className={`px-4 py-2 text-sm rounded-full transition-all ${
                    currentWeek === "A" ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  Week A
                </button>
                <button
                  onClick={() => setCurrentWeek("B")}
                  className={`px-4 py-2 text-sm rounded-full transition-all ${
                    currentWeek === "B" ? "bg-primary text-on-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  Week B
                </button>
              </div>
            </div>

            {/* Grid Timetable */}
            <Card className="bg-surface-container rounded-m3-xl border-none shadow-elevation-1">
              <div className="p-6">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-semibold text-on-surface">Week {currentWeek} Timetable</h2>
                  <p className="text-sm text-on-surface-variant">Grid View</p>
                </div>

                {/* Days Header */}
                <div className="grid grid-cols-5 gap-6 mb-6">
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day) => (
                    <div key={day} className="text-center">
                      <h3 className="font-semibold text-on-surface-variant text-base">
                        {day.substring(0, 3)}
                        {currentWeek}
                      </h3>
                    </div>
                  ))}
                </div>

                {/* Timetable Grid */}
                <div className="grid grid-cols-5 gap-6">
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day) => (
                    <div key={day} className="space-y-3">
                      {timetableData[day].map((period, index) => (
                        period.subject === "Break" ? (
                          <div key={`${period.id}-break-${index}`} className="bg-surface-container-high/50 rounded-lg p-2 text-sm text-on-surface-variant">
                            <div className="font-medium">{period.period}</div>
                            <div className="text-xs">{period.time}</div>
                          </div>
                        ) : (
                          <div key={period.id} className="flex items-center gap-3">
                            <div
                              className={`rounded-lg px-3 py-2 text-base font-bold flex-shrink-0 min-w-[40px] text-center ${getSubjectColor(period.subject)}`}
                            >
                              {getSubjectAbbr(period.subject)}
                            </div>
                            <div className="text-sm font-medium text-on-surface flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-sm truncate">{period.subject}</span>
                                <div className="hidden md:flex items-center gap-2 text-xs text-on-surface-variant">
                                  <span>{period.room}</span>
                                  <span>•</span>
                                  <span>{period.teacher}</span>
                                </div>
                              </div>
                              <div className="md:hidden text-xs text-on-surface-variant mt-1 truncate">{period.room} • {period.teacher}</div>
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </>
        )}
      </div>
    </PageTransition>
  )
}
