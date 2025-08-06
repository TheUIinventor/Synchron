// app/page.tsx
"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
// Removed unused useRouter import
import { Button } from "@/components/ui/button" // Corrected: Removed duplicate import, kept the first one
import { Card, CardContent } from "@/components/ui/card"
import { getCurrentDay, formatDate, getCurrentTime } from "@/utils/time-utils"
import { trackSectionUsage } from "@/utils/usage-tracker"
import ThemeToggle from "@/components/theme-toggle"
import SettingsMenu from "@/components/settings-menu"
import { useTimetable } from "@/contexts/timetable-context"
import {
  Calendar,
  Clock,
  ArrowRight,
  LogIn, // Correct casing
  LogOut, // Correct casing
  UserRoundX,
  MapPinOff,
} from "lucide-react" // Consolidated all Lucide icon imports here
import { useAuth } from "@/lib/api/hooks"

export default function Home() {
  const [mounted, setMounted] = useState(false)
  const [currentTime, setCurrentTime] = useState("")
  // Use currentMomentPeriodInfo for the header status
  const { timetableData, currentMomentPeriodInfo, selectedDay, selectedDateObject, isShowingNextDay } = useTimetable()
  // Ensure useAuth hook provides isAuthenticated, initiateLogin and logout functions
  const { isAuthenticated, initiateLogin, logout } = useAuth() 

  // Memoize current day for the main timetable display
  const mainTimetableDisplayDay = useMemo(() => selectedDay, [selectedDay])
  const todaysTimetable = useMemo(
    () => timetableData[mainTimetableDisplayDay] || [],
    [timetableData, mainTimetableDisplayDay],
  )

  // Get display name for period (memoized)
  const getDisplaySubject = useCallback((period: any) => {
    if (period.subject === "Break") {
      return period.period
    }
    return period.subject
  }, [])

  useEffect(() => {
    setMounted(true)
    trackSectionUsage("home")

    const updateTime = () => {
      setCurrentTime(getCurrentTime())
    }

    updateTime()
    // Keep 1 second updates for time display
    const interval = setInterval(updateTime, 1000)

    return () => clearInterval(interval)
  }, [])

  // Memoize period rendering for the main timetable
  const renderedPeriods = useMemo(() => {
    return todaysTimetable.map((period) => {
      // These highlights are for the *displayed* timetable, not the current moment's
      // Only highlight current/next if we are showing the current day's timetable
      const isCurrentPeriod =
        !isShowingNextDay &&
        currentMomentPeriodInfo.isCurrentlyInClass &&
        currentMomentPeriodInfo.currentPeriod?.id === period.id
      const isNextPeriod =
        !isShowingNextDay &&
        !currentMomentPeriodInfo.isCurrentlyInClass &&
        currentMomentPeriodInfo.nextPeriod?.id === period.id

      // Determine highlighting for teacher/room
      const isSubstitute = period.isSubstitute
      const isRoomChange = period.isRoomChange

      return (
        <div
          key={period.id}
          className={`rounded-xl p-2 transition-colors duration-200 will-change-auto ${
            isCurrentPeriod
              ? "bg-green-100 dark:bg-green-900/30 border-2 border-green-300 dark:border-green-700"
              : isNextPeriod
                ? "bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-300 dark:border-blue-700"
                  : period.subject === "Break"
                  ? "bg-amber-50 dark:bg-amber-900/20"
                  : "bg-theme-secondary"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            {/* Removed Time on the left as per request */}
            {/* Subject */}
            <span className="font-semibold text-sm flex-1 min-w-0 truncate">{getDisplaySubject(period)}</span>

            {/* Teacher and Room (only for non-break periods) */}
            {period.subject !== "Break" && (
              <span className="text-xs text-gray-600 dark:text-gray-300 flex-shrink-0 ml-auto flex items-center gap-1">
                {isSubstitute && <UserRoundX className="h-3 w-3 text-orange-500" title="Substitute Teacher" />}
                {isRoomChange && <MapPinOff className="h-3 w-3 text-purple-500" title="Room Change" />}
                <span className={`${isSubstitute ? "text-orange-600 dark:text-orange-400 font-semibold" : ""}`}>
                  {period.teacher}
                </span>{" "}
                •{" "}
                <span className={`${isRoomChange ? "text-purple-600 dark:text-purple-400 font-semibold" : ""}`}>
                  {period.room}
                </span>
              </span>
            )}

            {/* Status Badges (only for non-break periods) */}
            {period.subject !== "Break" && (isCurrentPeriod || isNextPeriod) && (
              <div className="flex items-center gap-1 flex-shrink-0">
                {isCurrentPeriod && (
                  <div className="flex items-center gap-1 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs font-medium">Now</span>
                  </div>
                )}
                {isNextPeriod && (
                  <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">
                    <ArrowRight className="h-3 w-3" />
                    <span className="text-xs font-medium">Next</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )
    })
  }, [todaysTimetable, currentMomentPeriodInfo, getDisplaySubject, isShowingNextDay])

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <main className="min-h-screen pb-20 relative">
      {/* Header Section - Optimized */}
      <div className="header-optimized px-4 py-4 relative">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h1 className="text-xl font-bold">Synchron β</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Built For Sydney Boys High School</p>
          </div>
          <div className="flex gap-2">
            {/* Login/Logout Button */}
            <Button
              variant="outline"
              size="icon"
              className="rounded-full w-10 h-10 glass-button border-0 hover:bg-white/30 dark:hover:bg-white/15 transition-all duration-200 bg-transparent"
              onClick={() => {
                if (isAuthenticated) {
                  logout();
                } else {
                  // Use typeof window check to avoid SSR issues
                  if (typeof window === "undefined") return;

                  const clientId = process.env.NEXT_PUBLIC_SBHS_APP_ID;
                  const redirectUri = process.env.NODE_ENV === 'development'
                    ? process.env.NEXT_PUBLIC_SBHS_REDIRECT_URI_LOCAL
                    : process.env.NEXT_PUBLIC_SBHS_REDIRECT_URI_VERCEL;

                  if (!clientId || !redirectUri) {
                    alert("App ID or Redirect URI is not configured. Check your .env.local and Vercel environment variables.");
                    return;
                  }

                  const authUrl = `https://studentportal.sydneyboys-h.schools.nsw.edu.au/oauth/authorize?` +
                    `response_type=code&` +
                    `client_id=${clientId}&` +
                    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
                    `scope=all-ro`;

                  window.location.href = authUrl;
                }
              }}
            >
              {/* Only use LogIn and LogOut, not Login */}
              {isAuthenticated ? <LogOut className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
            </Button>
            <SettingsMenu />
          </div>
        </div>

        {/* Adjusted layout for mobile: stack welcome and time/next period */}
        <div className="flex flex-col sm:flex-row items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold theme-gradient">Welcome!</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Your school day at a glance</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {formatDate()} • {getCurrentDay()} {/* Always show current date/day here */}
            </p>
          </div>
          <div className="text-right mt-4 sm:mt-0 w-full sm:w-auto">
            {" "}
            {/* Added w-full for mobile stacking */}
            <div className="flex items-center gap-2 card-optimized px-3 py-2 rounded-xl mb-2 justify-end">
              {" "}
              {/* Added justify-end for alignment */}
              <div className="icon-optimized rounded-full p-1">
                <Clock className="h-4 w-4 text-theme-primary" />
              </div>
              <span className="text-lg font-semibold font-mono tracking-wide">{currentTime}</span>
            </div>
            {/* Next Period Countdown - Optimized */}
            {currentMomentPeriodInfo.isCurrentlyInClass && currentMomentPeriodInfo.currentPeriod ? (
              // Case 1: Currently in a class
              <div className="card-optimized px-3 py-2 rounded-xl min-w-[180px] ml-auto">
                <div className="flex items-center gap-2 mb-1 justify-end">
                  <span className="text-xs font-semibold">Current:</span>
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                </div>
                <div className="text-xs font-medium mb-1 text-right">
                  {getDisplaySubject(currentMomentPeriodInfo.currentPeriod)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 font-mono mb-1 text-right">
                  {currentMomentPeriodInfo.timeUntil}
                </div>
                {currentMomentPeriodInfo.nextPeriod && (
                  <div className="border-t border-gray-200 dark:border-gray-600 pt-1 mt-1 text-right">
                    <div className="flex items-center gap-1 mb-1 justify-end">
                      <ArrowRight className="h-2 w-2 text-blue-600 dark:text-blue-400" />
                      <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Next:</span>
                    </div>
                    <div className="text-xs font-medium">{getDisplaySubject(currentMomentPeriodInfo.nextPeriod)}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {currentMomentPeriodInfo.nextPeriod.room} • {currentMomentPeriodInfo.nextPeriod.teacher}
                    </div>
                  </div>
                )}
              </div>
            ) : currentMomentPeriodInfo.nextPeriod ? (
              // Case 2: Not in class, but there's a next class
              <div className="card-optimized px-3 py-2 rounded-xl min-w-[180px] ml-auto">
                <div className="flex items-center gap-2 mb-1 justify-end">
                  <span className="text-xs font-semibold">Next:</span>
                  <ArrowRight className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-xs font-medium mb-1 text-right">
                  {getDisplaySubject(currentMomentPeriodInfo.nextPeriod)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 font-mono mb-1 text-right">
                  {currentMomentPeriodInfo.timeUntil}
                </div>
              </div>
            ) : (
              // Case 3: No more classes today (neither in class nor a next class)
              <div className="card-optimized px-3 py-2 rounded-xl ml-auto">
                <p className="text-xs font-medium">No more classes today</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Enjoy your day! 🎉</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content - Optimized */}
      <div className="p-4 space-y-3">
        <Card className="card-optimized-main">
          <CardContent className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="icon-container-optimized text-theme-primary">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">
                  {isShowingNextDay ? "Tomorrow's Synchron" : "Today's Synchron"}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {mainTimetableDisplayDay} • {formatDate(selectedDateObject)}{" "}
                </p>
              </div>
            </div>

            {mainTimetableDisplayDay === "Saturday" || mainTimetableDisplayDay === "Sunday" ? (
              <div className="card-optimized rounded-xl p-6 text-center">
                <p className="text-gray-500 dark:text-gray-400">No classes scheduled for weekends</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  Enjoy your {mainTimetableDisplayDay}! 🎉
                </p>
              </div>
            ) : todaysTimetable.length > 0 ? (
              <div className="space-y-1.5 contain-layout">{renderedPeriods}</div>
            ) : (
              <div className="card-optimized rounded-xl p-6 text-center">
                <p className="text-gray-500 dark:text-gray-400">No classes scheduled for this day</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}