"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentDay, formatDate, getCurrentTime } from "@/utils/time-utils";
import { trackSectionUsage } from "@/utils/usage-tracker";
import ThemeToggle from "@/components/theme-toggle";
import SettingsMenu from "@/components/settings-menu";
import { useTimetable } from "@/contexts/timetable-context";
import { useStudentProfile } from "@/lib/api/hooks";
import {
  Calendar,
  Clock,
  ArrowRight,
  UserRoundX,
  MapPinOff,
} from "lucide-react";
import { AuthButton } from "@/components/auth-button";

export default function HomeClient() {
  // Timetable API integration
  const [timetable, setTimetable] = useState<any[]>([]);
  const [studentName, setStudentName] = useState<string>("");
  const [timetableLoading, setTimetableLoading] = useState(true);
  const [timetableError, setTimetableError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState("");

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

  useEffect(() => {
    async function fetchTimetable() {
      setTimetableLoading(true);
      setTimetableError(null);
      try {
        const response = await fetch("https://student.sbhs.net.au/api/timetable/timetable.json", {
          credentials: "include"
        });
        if (!response.ok) throw new Error("Failed to fetch timetable");
        const data = await response.json();
        setTimetable(data.timetable || []);
        // Extract student name from API response
        if (data.student) {
          if (data.student.name) {
            setStudentName(data.student.name);
          } else if (data.student.givenName && data.student.surname) {
            setStudentName(`${data.student.givenName} ${data.student.surname}`);
          }
        }
      } catch (err) {
        setTimetableError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setTimetableLoading(false);
      }
    }
    fetchTimetable();
  }, []);

  const getDisplaySubject = useCallback((period: any) => {
    if (period.type === "break") {
      return period.name || period.period;
    }
    return period.subject || period.name;
  }, []);

  const renderedPeriods = useMemo(() => {
    return timetable.map((period, idx) => (
      <div
        key={period.id || idx}
        className={`rounded-xl p-2 transition-colors duration-200 will-change-auto ${
          period.type === "break"
            ? "bg-amber-50 dark:bg-amber-900/20"
            : "bg-theme-secondary"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-sm flex-1 min-w-0 truncate">{getDisplaySubject(period)}</span>
          <span className="text-xs text-gray-600 dark:text-gray-300 flex-shrink-0 ml-auto flex items-center gap-1">
            {period.teacher && <span>{period.teacher}</span>}
            {period.room && <span>• {period.room}</span>}
          </span>
        </div>
      </div>
    ));
  }, [timetable, getDisplaySubject]);

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
        <div className="flex flex-col sm:flex-row items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold theme-gradient">
              {studentName ? `Welcome, ${studentName}!` : "Welcome!"}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Your school day at a glance</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{formatDate()} • {getCurrentDay()}</p>
          </div>
          <div className="text-right mt-4 sm:mt-0 w-full sm:w-auto">
            <div className="flex items-center gap-2 card-optimized px-3 py-2 rounded-xl mb-2 justify-end">
              <div className="icon-optimized rounded-full p-1">
                <Clock className="h-4 w-4 text-theme-primary" />
              </div>
              <span className="text-lg font-semibold font-mono tracking-wide">{currentTime}</span>
            </div>
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
                <h3 className="font-semibold text-lg">Today's Synchron</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate()} • {getCurrentDay()}</p>
              </div>
            </div>
            {timetableLoading ? (
              <div className="card-optimized rounded-xl p-6 text-center">
                <p className="text-gray-500 dark:text-gray-400">Loading timetable...</p>
              </div>
            ) : timetableError ? (
              <div className="card-optimized rounded-xl p-6 text-center">
                <p className="text-red-500">Error loading timetable: {timetableError}</p>
              </div>
            ) : timetable.length > 0 ? (
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
