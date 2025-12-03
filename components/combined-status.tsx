"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useTimetable } from "@/contexts/timetable-context"
import { getCurrentDay, getCurrentTime } from "@/utils/time-utils"
import { Clock, ArrowRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export default function CombinedStatus() {
  const timetable = useTimetable()
  const { timetableData } = timetable
  // Support both new and legacy naming
  const nextPeriodInfo = (timetable.nextPeriodInfo ?? timetable.currentMomentPeriodInfo) as NonNullable<
    typeof timetable.currentMomentPeriodInfo
  >
  const [currentTime, setCurrentTime] = useState("")

  // Memoize current day and timetable
  const currentDay = useMemo(() => getCurrentDay(), [])
  const todaysTimetable = useMemo(() => timetableData[currentDay] || [], [timetableData, currentDay])

  // Memoized display subject function
  const getDisplaySubject = useCallback((period: any) => {
    if (period.subject === "Break") {
      return period.period
    }
    return period.subject
  }, [])

  useEffect(() => {
    const updateStatus = () => {
      setCurrentTime(getCurrentTime())
    }

    updateStatus()
    // Keep 1 second updates for time display
    const interval = setInterval(updateStatus, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <Card className="card-optimized-main">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="icon-container-optimized text-theme-primary">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Current Status</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">{currentTime}</p>
          </div>
        </div>

        {/* Current/Next Period Status - Optimized */}
        {nextPeriodInfo.isCurrentlyInClass && nextPeriodInfo.currentPeriod && (
          <div className="space-y-2">
            <div className="card-optimized rounded-xl p-3 text-center bg-green-50 dark:bg-green-900/20">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="font-semibold text-green-700 dark:text-green-300 text-sm">Currently in class</span>
              </div>
              <p className="font-medium mb-1">{getDisplaySubject(nextPeriodInfo.currentPeriod)}</p>
              <div className="flex items-center justify-center gap-3 text-xs text-gray-600 dark:text-gray-400 mb-2">
                {nextPeriodInfo.currentPeriod.isSubstitute && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-tertiary-container text-on-tertiary-container">Sub</span>
                )}
                <span>{nextPeriodInfo.currentPeriod.isSubstitute ? (nextPeriodInfo.currentPeriod.fullTeacher || nextPeriodInfo.currentPeriod.teacher) : (nextPeriodInfo.currentPeriod.originalTeacher || nextPeriodInfo.currentPeriod.fullTeacher || nextPeriodInfo.currentPeriod.teacher)}</span>
                <span>•</span>
                <span>{nextPeriodInfo.currentPeriod.room}</span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 font-mono bg-white/50 dark:bg-black/20 px-2 py-1 rounded-full inline-block">
                {nextPeriodInfo.timeUntil}
              </p>
            </div>

            {nextPeriodInfo.nextPeriod && (
              <div className="card-optimized rounded-xl p-3 text-center bg-blue-50 dark:bg-blue-900/20">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <ArrowRight className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                  <span className="font-medium text-blue-700 dark:text-blue-300 text-sm">Next class</span>
                </div>
                <p className="font-medium text-sm mb-1">{getDisplaySubject(nextPeriodInfo.nextPeriod)}</p>
                <div className="flex items-center justify-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                  {nextPeriodInfo.nextPeriod.isSubstitute && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-tertiary-container text-on-tertiary-container">Sub</span>
                  )}
                  <span>{nextPeriodInfo.nextPeriod.isSubstitute ? (nextPeriodInfo.nextPeriod.fullTeacher || nextPeriodInfo.nextPeriod.teacher) : (nextPeriodInfo.nextPeriod.originalTeacher || nextPeriodInfo.nextPeriod.fullTeacher || nextPeriodInfo.nextPeriod.teacher)}</span>
                  <span>•</span>
                  <span>{nextPeriodInfo.nextPeriod.room}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {!nextPeriodInfo.isCurrentlyInClass && nextPeriodInfo.nextPeriod && (
          <div className="card-optimized rounded-xl p-4 text-center mb-4 bg-blue-50 dark:bg-blue-900/20">
            <div className="flex items-center justify-center gap-2 mb-2">
              <ArrowRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="font-semibold text-blue-700 dark:text-blue-300">Next period</span>
            </div>
            <p className="font-medium mb-2">{getDisplaySubject(nextPeriodInfo.nextPeriod)}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 font-mono bg-white/50 dark:bg-black/20 px-3 py-1 rounded-full inline-block">
              {nextPeriodInfo.timeUntil}
            </p>
          </div>
        )}

        {!nextPeriodInfo.isCurrentlyInClass && !nextPeriodInfo.nextPeriod && (
          <div className="card-optimized rounded-xl p-4 text-center mb-4">
            <p className="text-gray-500 dark:text-gray-400">No more classes today</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Enjoy your afternoon! 🎉</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
