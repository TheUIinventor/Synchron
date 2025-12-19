"use client";

import React, { useEffect, useState } from "react";
import { Bagel_Fat_One } from "next/font/google";
import { useTimetable } from "@/contexts/timetable-context";
import { useStudentProfile } from "@/lib/api/hooks";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { AuthButton } from "@/components/auth-button";
import ThemeToggle from "@/components/theme-toggle";
import SettingsMenu from "@/components/settings-menu";
import { getCurrentDay, formatDate } from "@/utils/time-utils";

const bagel = Bagel_Fat_One({ weight: "400", subsets: ["latin"], display: "swap", variable: "--font-bagel-fat-one" });

export default function HomeClient() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Don't render anything until we're on the client
  if (!isClient) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  const { timetableData, currentMomentPeriodInfo, isLoading, error, refreshExternal, selectedDay } = useTimetable();
  const { data: profileData, loading: profileLoading } = useStudentProfile();

  if (isLoading || !currentDate) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Syncing…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-[50vh] text-center space-y-4">
        <div className="w-24 h-24 rounded-3xl bg-destructive/10 flex items-center justify-center mb-4">
          <Loader2 className="h-10 w-10 text-destructive animate-spin" />
        </div>
        <h2 className="text-2xl font-serif text-destructive">Connection Error</h2>
        <p className="text-muted-foreground max-w-xs">{error}</p>
        <button
          onClick={() => refreshExternal && refreshExternal()}
          className="px-6 py-3 rounded-full bg-primary text-primary-foreground hover:shadow-lg transition-all active:scale-95"
        >
          Try Again
        </button>
      </div>
    );
  }

  const { currentPeriod, nextPeriod, timeUntil } = currentMomentPeriodInfo;

  // Get today's periods for the sidebar
  // Use selectedDay if available, otherwise fallback to current day name
  const dayName = selectedDay || format(currentDate, "EEEE");
  const todaysPeriods = timetableData[dayName] || [];

  return (
    <main className="min-h-screen pb-20 relative">
      <header className="px-4 pt-3 pb-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 z-10">
        <div className="flex items-center justify-between">
          <div className="pt-1">
            <h1 className="text-lg font-bold">Synchron β</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Built For Sydney Boys High School</p>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <AuthButton />
            <SettingsMenu />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="px-4 pt-3">
        <div className="flex flex-col sm:flex-row items-start sm:justify-between">
          <div>
            <h2 className={`${bagel.className} text-2xl font-bold theme-gradient`}>
              {(profileLoading && !profileData) ? (
                  <Skeleton className="h-8 w-48 rounded-lg" />
                ) : (() => {
                  const candidates = [
                    profileData?.givenName,
                    profileData?.givenname,
                    profileData?.given_name,
                    profileData?.firstName,
                    profileData?.first_name,
                    profileData?.name,
                    profileData?.username,
                  ]

                  let maybeGiven: string | null = null
                  for (const c of candidates) {
                    if (typeof c === 'string' && c.trim().length > 0) { maybeGiven = c.trim(); break }
                  }

                  if (maybeGiven) {
                    const first = maybeGiven.split(/\s+/)[0]
                    return `Hello, ${first}!`
                  }

                  return "Hello!"
                })()}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Your school day at a glance</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{formatDate()} • {getCurrentDay()}</p>
          </div>

          <div className="mt-4 sm:mt-0">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {currentPeriod?.subject || "Free Period"}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {currentPeriod?.time || "Now"}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {currentPeriod?.room && `Room ${currentPeriod.room}`}
                </div>
                {nextPeriod && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Next: {nextPeriod.subject}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {timeUntil}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-3">Today's Schedule</h3>
          <div className="space-y-2">
            {todaysPeriods.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">No classes scheduled</p>
            ) : (
              todaysPeriods.map((period, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <div>
                    <div className="font-medium">{period.subject}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {period.time} • Room {period.room}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{period.teacher}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <Link href="/timetable">
            <Button variant="outline" className="px-6">
              View Full Timetable
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
