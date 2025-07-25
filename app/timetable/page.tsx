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
  const { currentWeek, setCurrentWeek, timetableData } = useTimetable()

  useEffect(() => {
    setMounted(true)
    trackSectionUsage("timetable")
  }, [])

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
        <div className="flex items-center justify-between mb-6 fade-in">
          <Link
            href="/"
            className="text-gray-500 dark:text-gray-400 transition-all duration-200 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-2xl font-bold">My Synchron</h1>
          <div className="w-6"></div>
        </div>

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

              {isWeekend ? (
                <div className="py-8 text-center text-gray-500 dark:text-gray-400 glass-card rounded-xl">
                  No classes scheduled for weekends
                </div>
              ) : todaysTimetable.length > 0 ? (
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
                          <span className="text-xs text-gray-600 dark:text-gray-300 flex-shrink-0 ml-auto">
                            {period.teacher} • {period.room}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
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
                              {period.room}
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
