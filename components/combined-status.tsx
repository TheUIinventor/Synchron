"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useTimetable } from "@/contexts/timetable-context"
import { getCurrentDay, getCurrentTime } from "@/utils/time-utils"
import { stripLeadingCasualCode } from "@/lib/utils"
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

  // Helper to display teacher: if substitute and casualSurname provided,
  // show only the casualSurname per UX request. Otherwise prefer fullTeacher
  // then teacher.
  const displayTeacher = useCallback((p: any) => {
    if (!p) return ''
    if (p.isSubstitute && (p as any).casualSurname) return stripLeadingCasualCode((p as any).casualSurname)
    const candidate = p.fullTeacher || p.teacher || ''
    if (p.isSubstitute && candidate) return stripLeadingCasualCode(candidate)
    return stripLeadingCasualCode(candidate)
  }, [])

  const isSubstitutePeriod = useCallback((p: any) => {
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
        if (cleanedFull && cleanedRaw && cleanedFull !== cleanedRaw) return true
      } catch (e) {}
      const rawIsCode = /^[A-Z]{1,4}$/.test(teacher)
      const dispLooksName = disp && !/^[A-Z0-9\s]{1,6}$/.test(disp)
      if (rawIsCode && dispLooksName) return true
      return Boolean(p.isSubstitute || (p as any).casualSurname || changedTeacher)
    } catch (e) { return Boolean(p?.isSubstitute || (p as any)?.casualSurname) }
  }, [])

  const getDisplayRoom = useCallback((period: any) => {
    if (!period) return ''
    try {
      const display = (period as any).displayRoom || (period as any).toRoom || (period as any).roomTo || (period as any)['room_to'] || (period as any).newRoom || (period as any).to
      if (display && String(display).trim()) return String(display)
    } catch (e) {}
    return period.room || ''
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
                {(isSubstitutePeriod(nextPeriodInfo.currentPeriod)) ? (
                  <span className="inline-block px-2 py-0.5 rounded-md text-xs font-medium truncate max-w-[100px]"
                    style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}
                  >
                    {displayTeacher(nextPeriodInfo.currentPeriod)}
                  </span>
                ) : (
                  <span className="text-on-surface-variant">{displayTeacher(nextPeriodInfo.currentPeriod)}</span>
                )}
                <span>•</span>
                <span>{getDisplayRoom(nextPeriodInfo.currentPeriod)}</span>
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
                  {(isSubstitutePeriod(nextPeriodInfo.nextPeriod)) ? (
                    <span className="inline-block px-2 py-0.5 rounded-md text-xs font-medium truncate max-w-[100px]"
                      style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}
                    >
                      {displayTeacher(nextPeriodInfo.nextPeriod)}
                    </span>
                  ) : (
                    <span className="text-on-surface-variant">{displayTeacher(nextPeriodInfo.nextPeriod)}</span>
                  )}
                  <span>•</span>
                  <span>{getDisplayRoom(nextPeriodInfo.nextPeriod)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {!nextPeriodInfo.isCurrentlyInClass && nextPeriodInfo.nextPeriod && (
          <div className="card-optimized rounded-xl p-4 text-center mb-4 bg-blue-50 dark:bg-blue-900/20">
            <div className="flex items-center justify-center gap-2 mb-2">
              <ArrowRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="font-semibold text-blue-700 dark:text-blue-300">
                {((nextPeriodInfo.nextPeriod as any)?.isRollCallMarker) ? 'School in' : 'Next period'}
              </span>
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
