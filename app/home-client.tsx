"use client";

import { useState, useEffect, useMemo, useCallback } from "react";

// Prefetch notices in the background and cache in sessionStorage
function prefetchNotices() {
  if (typeof window === "undefined") return;
  if (sessionStorage.getItem("notices-prefetched")) return;
  fetch("/api/notices")
    .then(res => res.ok ? res.json() : null)
    .then(data => {
      if (data) {
        sessionStorage.setItem("notices-data", JSON.stringify(data));
        sessionStorage.setItem("notices-prefetched", "1");
      }
    })
    .catch(() => {});
}
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentDay, formatDate, getCurrentTime } from "@/utils/time-utils";
import { trackSectionUsage } from "@/utils/usage-tracker";
import ThemeToggle from "@/components/theme-toggle";
import SettingsMenu from "@/components/settings-menu";
import { useTimetable } from "@/contexts/timetable-context";
import { useStudentProfile } from "@/lib/api/hooks";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  Clock,
  ArrowRight,
  UserRoundX,
  MapPinOff,
} from "lucide-react";
import { AuthButton } from "@/components/auth-button";

export default function HomeClient() {
  // Prefetch notices on home page mount
  useEffect(() => {
    prefetchNotices();
  }, []);
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

  // Portal profile (preferred source for display name)
  const { data: profileData, loading: profileLoading } = useStudentProfile();

  // Diagnostic: try server-side proxy endpoint directly and show result (helps when profileData is empty)
  const [portalDebug, setPortalDebug] = useState<any>(null)
  useEffect(() => {
    let cancelled = false
    async function probe() {
      try {
        const res = await fetch('/api/portal/userinfo', { credentials: 'include' })
        let payload: any
        try {
          payload = await res.json()
        } catch (e) {
          payload = { error: 'Invalid JSON', status: res.status, text: await res.text() }
        }
        if (!cancelled) setPortalDebug({ ok: res.ok, status: res.status, payload })
      } catch (err) {
        if (!cancelled) setPortalDebug({ ok: false, error: String(err) })
      }
    }
    probe()
    return () => { cancelled = true }
  }, [])

  const displayName = (() => {
    const p: any = profileData || {}
    const inner = p.data || {}
    // try a few common keys and casings
    const candidates = [
      // top-level fields
      p.givenName,
      p.givenname,
      p.given_name,
      p.firstName,
      p.first_name,
      p.name,
      p.username,
      p.email,
      // nested under `student` (HTML-scraped)
      p.student?.givenName,
      p.student?.givenname,
      p.student?.name,
      p.student?.username,
      p.student?.email,
      // ApiResponse wrapper: { success, data: { ... } }
      inner.givenName,
      inner.givenname,
      inner.given_name,
      inner.firstName,
      inner.first_name,
      inner.name,
      inner.username,
      inner.email,
      inner.student?.givenName,
      inner.student?.name,
      inner.student?.email,
    ]

    for (const c of candidates) {
      if (typeof c === "string" && c.trim().length > 0) return c.trim()
    }

    // As a last resort, extract local-part of email if present
    const email = p.email || p.student?.email
    if (typeof email === "string" && email.includes("@")) {
      return email.split("@")[0]
    }

    return null
  })()

  // Helpful debug: if profile payload exists but no displayName was resolved, log it so we can inspect shape
  useEffect(() => {
    if (profileData && !displayName) {
      try {
        console.debug("profileData from portal (no resolved name):", profileData)
      } catch (e) {
        /* ignore */
      }
    }
  }, [profileData, displayName])

  useEffect(() => {
    async function fetchTimetable() {
      setTimetableLoading(true);
      setTimetableError(null);
      try {
        const response = await fetch("/api/timetable", {
          credentials: "include"
        });
        if (!response.ok) throw new Error("Failed to fetch timetable");
        const data = await response.json();
        console.log("Timetable API response:", data); // Debug log
        setTimetable(data.timetable || []);
        // Extract student name from API response
        if (data.student) {
          console.log("Student object:", data.student); // Debug log
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
            <h2 className="text-2xl font-bold theme-gradient">
              {profileLoading ? (
                <Skeleton className="h-8 w-48 rounded-lg" />
              ) : (() => {
                // Resolve name from a few possible response shapes returned by the portal client
                const maybeGiven =
                  // direct JSON shape: { givenName }
                  (profileData as any)?.givenName ||
                  // scraped HTML shape: { student: { givenName } }
                  (profileData as any)?.student?.givenName ||
                  // scraped HTML fallback: { student: { name } }
                  (profileData as any)?.student?.name ||
                  // another possible top-level name field
                  (profileData as any)?.name ||
                  null

                if (maybeGiven && typeof maybeGiven === "string" && maybeGiven.trim().length > 0) {
                  const first = maybeGiven.trim().split(/\s+/)[0]
                  return `Welcome, ${first}!`
                }

                if (studentName) return `Welcome, ${studentName}!`
                return "Welcome!"
              })()}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Your school day at a glance</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{formatDate()} • {getCurrentDay()}</p>
          </div>
          {/* Developer debug: if profile payload exists but we couldn't resolve a display name, show payload in dev */}
          {profileData && !displayName ? (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              <details className="bg-gray-50 dark:bg-gray-800 p-2 rounded-md">
                <summary className="cursor-pointer">profile payload (debug)</summary>
                <pre className="whitespace-pre-wrap max-h-48 overflow-auto text-[11px] mt-2">{JSON.stringify(profileData, null, 2)}</pre>
              </details>
            </div>
          ) : null}

          {/* Always-show diagnostic of the proxy endpoint so we can see why profileData may be empty */}
          {portalDebug ? (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              <details open className="bg-yellow-50 dark:bg-yellow-900 p-2 rounded-md border border-yellow-200 dark:border-yellow-800">
                <summary className="cursor-pointer">/api/portal/userinfo (diagnostic)</summary>
                <pre className="whitespace-pre-wrap max-h-60 overflow-auto text-[11px] mt-2">{JSON.stringify(portalDebug, null, 2)}</pre>
              </details>
            </div>
          ) : null}
          <div className="text-right sm:mt-0 w-full sm:w-auto">
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
