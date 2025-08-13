"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentDay, formatDate, getCurrentTime } from "@/utils/time-utils";
import { trackSectionUsage } from "@/utils/usage-tracker";
import ThemeToggle from "@/components/theme-toggle";
import SettingsMenu from "@/components/settings-menu";
import { useTimetable } from "@/contexts/timetable-context";
import {
  Calendar,
  Clock,
  ArrowRight,
  UserRoundX,
  MapPinOff,
} from "lucide-react";
import { AuthButton } from "@/components/auth-button";

export default function HomeClient() {
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const { timetableData, currentMomentPeriodInfo, selectedDay, selectedDateObject, isShowingNextDay } = useTimetable();

  const mainTimetableDisplayDay = useMemo(() => selectedDay, [selectedDay]);
  const todaysTimetable = useMemo(
    () => timetableData[mainTimetableDisplayDay] || [],
    [timetableData, mainTimetableDisplayDay],
  );

  const getDisplaySubject = useCallback((period: any) => {
    if (period.subject === "Break") {
      return period.period;
    }
    return period.subject;
  }, []);

  useEffect(() => {
    setMounted(true);
    trackSectionUsage("home");

    const updateTime = () => {
      setCurrentTime(getCurrentTime());
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const renderedPeriods = useMemo(() => {
    return todaysTimetable.map((period) => {
      const isCurrentPeriod =
        !isShowingNextDay &&
        currentMomentPeriodInfo.isCurrentlyInClass &&
        currentMomentPeriodInfo.currentPeriod?.id === period.id;
      const isNextPeriod =
        !isShowingNextDay &&
        !currentMomentPeriodInfo.isCurrentlyInClass &&
        currentMomentPeriodInfo.nextPeriod?.id === period.id;

      const isSubstitute = period.isSubstitute;
      const isRoomChange = period.isRoomChange;

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
            <span className="font-semibold text-sm flex-1 min-w-0 truncate">{getDisplaySubject(period)}</span>

            {period.subject !== "Break" && (
              <span className="text-xs text-gray-600 dark:text-gray-300 flex-shrink-0 ml-auto flex items-center gap-1">
                {isSubstitute && <UserRoundX className="h-3 w-3 text-orange-500" />}
                {isRoomChange && <MapPinOff className="h-3 w-3 text-purple-500" />}
                <span className={`${isSubstitute ? "text-orange-600 dark:text-orange-400 font-semibold" : ""}`}>
                  {period.teacher}
                </span>{" "}
                •{" "}
                <span className={`${isRoomChange ? "text-purple-600 dark:text-purple-400 font-semibold" : ""}`}>
                  {period.room}
                </span>
              </span>
            )}

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
      );
    });
  }, [todaysTimetable, currentMomentPeriodInfo, getDisplaySubject, isShowingNextDay]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen pb-20 relative">
      <div className="header-optimized px-4 py-4 relative">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h1 className="text-xl font-bold">Synchron β</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Built For Sydney Boys High School</p>
          </div>
          <div className="flex gap-2">
            <AuthButton />
            <SettingsMenu />
            <ThemeToggle />
          </div>
        </div>
        
        {/* The main content area now has a single div for the timetable */}
        <div className="flex flex-col sm:flex-row items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold theme-gradient">Welcome!</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Your school day at a glance</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {formatDate()} • {getCurrentDay()}
            </p>
          </div>
          <div className="text-right mt-4 sm:mt-0 w-full sm:w-auto">
            <div className="flex items-center gap-2 card-optimized px-3 py-2 rounded-xl mb-2 justify-end">
              <div className="icon-optimized rounded-full p-1">
                <Clock className="h-4 w-4 text-theme-primary" />
              </div>
              <span className="text-lg font-semibold font-mono tracking-wide">{currentTime}</span>
            </div>
            {currentMomentPeriodInfo.isCurrentlyInClass && currentMomentPeriodInfo.currentPeriod ? (
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
              <div className="card-optimized px-3 py-2 rounded-xl ml-auto">
                <p className="text-xs font-medium">No more classes today</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Enjoy your day! 🎉</p>
              </div>
            )}
          </div>
        </div>
      </div>

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
  );
}
