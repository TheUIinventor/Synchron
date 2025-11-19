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
    const colorMap: Record<string, string> = {
      English: "bg-yellow-400 text-yellow-900",
      Mathematics: "bg-orange-400 text-orange-900",
      Science: "bg-teal-400 text-teal-900",
      History: "bg-orange-300 text-orange-900",
      Geography: "bg-teal-500 text-teal-100",
      Computing: "bg-blue-400 text-blue-900",
      Music: "bg-purple-300 text-purple-900",
      Art: "bg-purple-500 text-purple-100",
      PE: "bg-green-400 text-green-900",
      Break: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
    }
    return colorMap[subject] || "bg-gray-300 text-gray-800"
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
      <div className="container max-w-6xl mx-auto px-4 py-6">
  <div className="flex items-center justify-between mb-4 md:mb-6 fade-in px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 w-full">
          <Link
            href="/"
            className="hidden md:flex text-gray-500 dark:text-gray-400 transition-all duration-200 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-lg font-bold text-left md:text-center md:flex-1">My Synchron</h1>
          {/* Data source badge and manual refresh */}
          <div className="flex items-center gap-2">
            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
              {timetableSource === 'fallback-sample' ? (
                <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">Using sample data</span>
              ) : timetableSource ? (
                <span className="px-2 py-1 rounded-full bg-green-100 text-green-800">Live data</span>
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
              className="hidden md:inline-flex px-3 py-1 rounded-full glass-card text-sm"
              title="Retry loading live timetable"
            >
              Refresh
            </button>
            <button
              onClick={() => fetchDiagnostics()}
              className="hidden md:inline-flex px-3 py-1 rounded-full glass-card text-sm"
              title="Run portal diagnostics"
            >
              {diagLoading ? 'Checking...' : 'Diagnostics'}
            </button>
          </div>
          <div className="w-6"></div>
        </div>
        {/* When we're using the bundled sample because live data couldn't be obtained, show a clear, non-technical call-to-action */}
        {timetableSource === 'fallback-sample' && (
          <div className="w-full px-4 mt-4">
            <Card className="one-ui-card p-3 mb-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium">Can't load your live timetable</div>
                  <div className="text-sm text-gray-500">Sign in to the SBHS Portal and then click Retry to load your live timetable.</div>
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
          <div className="glass-card p-1 rounded-full">
            <button
              onClick={() => setViewMode("daily")}
              className={`px-4 py-2 text-sm rounded-full transition-all ${
                viewMode === "daily" ? "liquid-gradient text-white shadow-lg" : ""
              }`}
            >
              Daily View
            </button>
            <button
              onClick={() => setViewMode("cycle")}
              className={`px-4 py-2 text-sm rounded-full transition-all ${
                viewMode === "cycle" ? "liquid-gradient text-white shadow-lg" : ""
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
                className="p-2 rounded-full glass-card transition-all duration-200 ease-in-out hover:bg-gray-200 dark:hover:bg-gray-700"
                onClick={goToPreviousDay}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <div className="text-center">
                <h2 className="font-semibold">{selectedDayName}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>

              <button
                className="p-2 rounded-full glass-card transition-all duration-200 ease-in-out hover:bg-gray-200 dark:hover:bg-gray-700"
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
                className="rounded-full glass-card border-0 bg-transparent"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Today
              </Button>
            </div>

            {/* Daily Schedule */}
            <Card className="one-ui-card max-w-lg mx-auto">
              <div className="flex items-center gap-3 mb-4">
                <div className="one-ui-icon-container text-theme-primary">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{selectedDayName} Schedule</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{formatSelectedDate()}</p>
                </div>
              </div>

              {isWeekend && (
                <div className="py-8 text-center text-gray-500 dark:text-gray-400 glass-card rounded-xl">
                  No classes scheduled for weekends
                </div>
              )}

              {!isWeekend && todaysTimetable.length > 0 && (
                <>
                  {showDiag && (
                    <div className="w-full px-4 mb-4">
                      <Card className="one-ui-card p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium">Portal Diagnostics</div>
                          <div>
                            <button
                              className="px-2 py-1 text-xs rounded-full glass-card"
                              onClick={() => {
                                setShowDiag(false)
                                setDiagResult(null)
                              }}
                            >
                              Close
                            </button>
                          </div>
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-300">
                          {diagLoading && <div>Running diagnostics…</div>}
                          {!diagLoading && diagResult && (
                            <>
                              <pre className="text-xs overflow-auto max-h-64 bg-gray-50 dark:bg-gray-800 p-2 rounded">{JSON.stringify(diagResult, null, 2)}</pre>
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
                            <div className="text-sm text-gray-500">No diagnostics run yet. Click Diagnostics to probe portal endpoints.</div>
                          )}
                        </div>
                      </Card>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {todaysTimetable.map((period) => (
                      <div
                        key={period.id}
                        className={`rounded-xl p-2 transition-all duration-200 ease-in-out ${
                          period.subject === "Break" ? "glass-card" : "bg-theme-secondary"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          {/* Time on the left */}
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400 flex-shrink-0 w-[4.5rem] text-left">
                            {period.time.split(" - ")[0]} {/* Only show start time */}
                          </span>

                          {/* Subject */}
                          <span className="font-semibold text-sm flex-1 min-w-0 truncate">
                            {getDisplaySubject(period)}
                          </span>

                          {/* Teacher and Room (only for non-break periods) */}
                          {period.subject !== "Break" && (
                            <span className="text-xs text-gray-600 dark:text-gray-300 flex-shrink-0 ml-auto flex items-center gap-2">
                              <span>{period.teacher} • {period.room}</span>
                              {/* Substitution / room-change badges */}
                              {period.isSubstitute && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-100 text-yellow-800">Sub</span>
                              )}
                              {period.isRoomChange && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-100 text-sky-800">Room</span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {!isWeekend && todaysTimetable.length === 0 && (
                <div className="py-8 text-center text-gray-500 dark:text-gray-400 glass-card rounded-xl">
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
              <div className="glass-card p-1 rounded-full">
                <button
                  onClick={() => setCurrentWeek("A")}
                  className={`px-4 py-2 text-sm rounded-full transition-all ${
                    currentWeek === "A" ? "liquid-gradient text-white shadow-lg" : ""
                  }`}
                >
                  Week A
                </button>
                <button
                  onClick={() => setCurrentWeek("B")}
                  className={`px-4 py-2 text-sm rounded-full transition-all ${
                    currentWeek === "B" ? "liquid-gradient text-white shadow-lg" : ""
                  }`}
                >
                  Week B
                </button>
              </div>
            </div>

            {/* Grid Timetable */}
            <Card className="one-ui-card">
              <div className="p-6">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-semibold">Week {currentWeek} Timetable</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Grid View</p>
                </div>

                {/* Days Header */}
                <div className="grid grid-cols-5 gap-6 mb-6">
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day) => (
                    <div key={day} className="text-center">
                      <h3 className="font-semibold text-gray-600 dark:text-gray-300 text-base">
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
                      {timetableData[day]
                        .filter((period) => period.subject !== "Break")
                        .map((period, index) => (
                          <div key={period.id} className="flex items-center gap-3">
                            <div
                              className={`rounded-lg px-3 py-2 text-base font-bold flex-shrink-0 min-w-[48px] text-center ${getSubjectColor(period.subject)}`}
                            >
                              {getSubjectAbbr(period.subject)}
                            </div>
                            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1">
                              {/* Desktop: keep room inline. Mobile: show subject name with room underneath */}
                              <div className="hidden md:block flex items-center gap-2">
                                <span>{period.room}</span>
                                {period.isRoomChange && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-100 text-sky-800">Room</span>
                                )}
                                {period.isSubstitute && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-100 text-yellow-800">Sub</span>
                                )}
                              </div>
                              <div className="md:hidden flex flex-col">
                                <span className="font-semibold text-sm truncate">{period.subject}</span>
                                <span className="text-xs text-gray-600 dark:text-gray-300 truncate">{period.room}</span>
                              </div>
                            </div>
                          </div>
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
