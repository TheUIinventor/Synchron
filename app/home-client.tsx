"use client";

import { useTimetable } from "@/contexts/timetable-context";
import { format } from "date-fns";
import { Loader2, Bell, MapPin, Calendar, ArrowRight, Mail, Clipboard as ClipboardIcon, Globe, BookOpen, Settings as SettingsIcon, Cloud, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { sbhsPortal } from "@/lib/api/client";
import { AuthButton } from "@/components/auth-button";
import { parseTimeRange, formatTo12Hour, isSchoolDayOver, getNextSchoolDay } from "@/utils/time-utils";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function HomeClient() {
  const { 
    timetableData, 
    currentMomentPeriodInfo, 
    isLoading, 
    error, 
    refreshExternal,
    selectedDay,
    selectedDateObject
  , timetableSource } = useTimetable();
  
  // Initialize immediately so header can render without waiting for effects
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [canvasLinks, setCanvasLinks] = useState<Record<string, string>>({})
  const [givenName, setGivenName] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('synchron-canvas-links')
      if (raw) {
        try {
          const parsed = JSON.parse(raw)
          // normalize keys to trimmed exact names
          const normalized: Record<string, string> = {}
          for (const k of Object.keys(parsed)) {
            normalized[k.trim()] = parsed[k]
          }
          setCanvasLinks(normalized)
        } catch (e) {
          setCanvasLinks(JSON.parse(raw))
        }
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await sbhsPortal.getStudentProfile()
        if (!mounted) return
        if (res && res.success && res.data && res.data.givenName) {
          setGivenName(res.data.givenName)
        }
      } catch (e) {
        // ignore
      }
    })()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    function reload(e?: Event) {
      try {
        const raw = localStorage.getItem('synchron-canvas-links')
        if (raw) setCanvasLinks(JSON.parse(raw))
        else setCanvasLinks({})
      } catch (err) {
        setCanvasLinks({})
      }
    }
    // Custom event dispatched from settings when links change
    window.addEventListener('synchron:canvas-links-updated', reload as EventListener)
    return () => window.removeEventListener('synchron:canvas-links-updated', reload as EventListener)
  }, [])

  if (!currentDate && !selectedDateObject) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
          <p className="text-muted-foreground animate-pulse font-medium">Syncing...</p>
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

  const { currentPeriod, nextPeriod, timeUntil, isCurrentlyInClass } = currentMomentPeriodInfo;
  
  // Determine the date to display: prefer provider's selected date, otherwise local currentDate.
  // If no user-selected date and it's after school hours or a weekend, show the next school day.
  const displayDate = selectedDateObject ?? (((): Date => {
    const now = currentDate
    const isWeekend = now.getDay() === 0 || now.getDay() === 6
    if (isWeekend || isSchoolDayOver()) return getNextSchoolDay(now)
    return now
  })());
  // Get today's periods for the sidebar - prefer selectedDay (context), otherwise use the displayDate's weekday
  const dayName = selectedDay || format(displayDate, "EEEE");
  const todaysPeriodsRaw = timetableData[dayName] || [];

  // Helper: normalize period label for comparison
  const normalizePeriodLabel = (p?: string) => String(p || '').trim().toLowerCase()
  const isRollCallEntry = (p: any) => {
    const subj = String(p.subject || '') .toLowerCase()
    const per = normalizePeriodLabel(p.period)
    return subj.includes('roll call') || subj === 'rollcall' || per === 'rc' || subj === 'rc' || subj.includes('roll')
  }

  // If there is no real period '0' present in the raw data for this day, drop any placeholder period '0'
  const hasPeriod0 = todaysPeriodsRaw.some(p => normalizePeriodLabel(p.period) === '0')

  // Filter out roll-call entries and orphaned period 0 placeholders
  const todaysPeriods = todaysPeriodsRaw.filter(p => {
    if (isRollCallEntry(p)) return false
    if (!hasPeriod0 && normalizePeriodLabel(p.period) === '0') return false
    return true
  })

  // Calculate progress percent for the current block (class or break)
  function calcProgressPercent() {
    const now = new Date().getTime();
    // Only show progress when currently inside a period. This ensures the bar
    // strictly represents period progress (start -> end). When not in a period
    // show 0% so the UI represents 'no active period'.
    if (currentPeriod && currentPeriod.time) {
      try {
        const { start, end } = parseTimeRange(currentPeriod.time);
        const total = end.getTime() - start.getTime();
        if (!isFinite(total) || total <= 0) return 0;
        const elapsed = now - start.getTime();
        const pct = Math.round((elapsed / total) * 100);
        return Math.max(0, Math.min(100, isFinite(pct) ? pct : 0));
      } catch (e) {
        return 0;
      }
    }

    // Not currently in a period
    return 0;
  }

  const progress = calcProgressPercent();

  // Format a concise remaining label to show on the right-hand side of the bar
  function remainingLabel() {
    // Return countdown as HH:MM:SS (zero-padded). Use currentPeriod end if in class, otherwise nextPeriod start.
    try {
      const now = new Date()
      let target: Date | null = null
      if (isCurrentlyInClass && currentPeriod?.time) {
        const { end } = parseTimeRange(currentPeriod.time)
        target = end
      } else if (nextPeriod?.time) {
        const { start } = parseTimeRange(nextPeriod.time)
        target = start
      }

      if (!target) {
        return timeUntil || ""
      }

      let diff = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000))
      const hours = Math.floor(diff / 3600)
      diff = diff % 3600
      const minutes = Math.floor(diff / 60)
      const seconds = diff % 60

      const hh = String(hours).padStart(2, "0")
      const mm = String(minutes).padStart(2, "0")
      const ss = String(seconds).padStart(2, "0")

      return `${hh}:${mm}:${ss}`
    } catch (e) {
      return timeUntil || ""
    }
  }

  return (
    <div className="space-y-4 pb-6 md:pb-6 animate-in fade-in duration-700">
      
      {/* Header Section */}
      <div className="flex items-start justify-between gap-4 pt-4 md:pt-0">
        <div className="flex flex-col gap-1">
          <h2 className="mt-[10px] text-3xl md:text-4xl font-medium text-foreground">{givenName ? `Hello, ${givenName}!` : 'Hello!'}</h2>
          {/* Page title and date removed per user preference; greeting shown above */}
        </div>

          <div className="flex items-center gap-3">
            {/* Sync indicator placed left of the settings icon. Spinner while loading, cloud+check when synced. */}
            <div className="flex items-center">
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" title="Syncing" />
              ) : (timetableSource && timetableSource !== 'fallback-sample' && timetableSource !== 'cache') ? (
                <div className="relative w-5 h-5" title="Synced to cloud">
                  <Cloud className="h-5 w-5 text-muted-foreground" />
                  <span className="absolute -right-0 -top-0 bg-white rounded-full">
                    <Check className="h-3 w-3 text-green-600" />
                  </span>
                </div>
              ) : null}
            </div>

            <Link href="/settings" className="rounded-full p-2 hover:bg-surface-variant transition-colors">
              <SettingsIcon className="h-5 w-5 text-muted-foreground" />
            </Link>
            <AuthButton />
          </div>
      </div>

        {/* Small inline sync indicator placed left of settings icon */}
      {/* Main Expressive Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-4 items-start md:items-stretch">
        
        {/* HERO: Current/Next Period - Spans full width on mobile, 8 cols on desktop */}
        <div className="md:col-span-8 space-y-3 flex flex-col md:h-full">
            
            {/* Primary Status Card */}
            <div className="relative overflow-hidden rounded-m3-2xl bg-primary-container text-primary-container-foreground p-5 md:p-6 shadow-elevation-1 transition-all duration-300 ease-expressive group mx-auto w-[92%] max-w-[720px] md:mx-0 md:w-full md:max-w-none">
              {/* Background Blob */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-primary/20" />
              
              <div className="relative z-10 flex flex-col h-full justify-between min-h-[150px]">
                <div className="flex justify-between items-start">
                  <Badge variant="secondary" className="bg-primary/20 text-primary-container-foreground hover:bg-primary/30 rounded-full px-4 py-1 text-sm font-medium">
                    Now
                  </Badge>
                  <MapPin className="h-6 w-6 opacity-60" />
                </div>
                
                <div className="mt-3">
                  <h2 className="text-3xl md:text-5xl font-serif leading-tight mb-2">
                    {currentPeriod?.subject ? (
                      canvasLinks[currentPeriod.subject] ? (
                        <a href={canvasLinks[currentPeriod.subject]} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          {currentPeriod.subject}
                        </a>
                      ) : (
                        currentPeriod.subject
                      )
                    ) : (
                      "Free Period"
                    )}
                  </h2>
                  <div className="flex items-center gap-3 text-lg opacity-80 font-medium">
                    <span className="bg-primary-foreground/20 px-3 py-1 rounded-md">
                      {currentPeriod?.fullTeacher || currentPeriod?.teacher || "Self Study"}
                    </span>
                    <span>•</span>
                    <span>{currentPeriod?.room || "Campus"}</span>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex flex-col items-end text-sm mb-1">
                    <span className="text-[15px] opacity-90">{nextPeriod?.subject ? `${nextPeriod.subject} in` : ""}</span>
                    <span className="font-bold text-[15px]">{remainingLabel()}</span>
                  </div>
                  <div className="h-2 w-full bg-primary/20 rounded-full overflow-hidden">
                    {/* Progress bar updates based on current time within the period/gap */}
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm mt-2 font-medium opacity-70">
                    <span>{((currentPeriod?.time) || "").split(' - ')[0] || "Now"}</span>
                    <span>{((currentPeriod?.time) || "").split(' - ')[1] || "Later"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Links (replaces Up Next card) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 mx-auto w-[92%] max-w-[720px] md:mx-0 md:w-full md:max-w-none md:items-stretch">
              <div className="rounded-m3-xl bg-surface-container-high p-4 hover:bg-surface-variant transition-colors duration-300 flex flex-col justify-between h-full overflow-hidden sm:overflow-visible">
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href="https://mail.google.com/a/student.sbhs.nsw.edu.au"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-muted/5 hover:bg-muted/10 px-4 py-2 rounded-full shadow-sm border border-transparent hover:border-primary/10 transition-all"
                  >
                    <Mail className="h-4 w-4" />
                    <span className="text-sm font-medium">Mail</span>
                  </a>

                  <a
                    href="https://student.sbhs.net.au/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-muted/5 hover:bg-muted/10 px-4 py-2 rounded-full shadow-sm border border-transparent hover:border-primary/10 transition-all"
                  >
                    <Globe className="h-4 w-4" />
                    <span className="text-sm font-medium">Portal</span>
                  </a>

                  <a
                    href="https://sydneyboyshigh.instructure.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-muted/5 hover:bg-muted/10 px-4 py-2 rounded-full shadow-sm border border-transparent hover:border-primary/10 transition-all"
                  >
                    <BookOpen className="h-4 w-4" />
                    <span className="text-sm font-medium">Canvas</span>
                  </a>
                </div>
                {/* Divider and adaptive class links row */}
                <div className="mt-4">
                  <div className="border-t border-outline-variant" />
                  <div className="mt-3 flex items-center gap-3">
                    {(() => {
                      const subject = (currentPeriod?.subject ?? "").trim()
                      // Normalize subject: remove digits/punctuation and lower-case
                      const cleaned = subject.replace(/[^a-zA-Z\s]/g, "").toLowerCase()
                      const tokens = cleaned.split(/\s+/).filter(Boolean)
                      const first = tokens[0] ?? ""

                      const mapping: Record<string, { label: string; url: string }> = {
                        chinese: { label: "Junqi", url: "https://www.junqi.app/en/game/ZGIV?mode=private" },
                        ved: { label: "Wellio", url: "https://app.wellioeducation.com/" },
                        va: { label: "SmartHistory", url: "https://smarthistory.org/" },
                        math: { label: "Dictionary", url: "https://www.mathsisfun.com/definitions/" },
                      }

                      const codeMap: Record<string, string> = {
                        // Chinese codes
                        chi: "chinese",
                        chin: "chinese",
                        chinese: "chinese",
                        // VED
                        ved: "ved",
                        // Visual Art
                        va: "va",
                        visual: "va",
                        art: "va",
                        // Math codes
                        math: "math",
                        maths: "math",
                        mat: "math",
                        ma: "math",
                      }

                      let canonical: string | null = null
                      if (codeMap[first]) canonical = codeMap[first]
                      else {
                        // Fallback to contains checks on the cleaned subject
                        if (cleaned.includes("chinese") || cleaned.includes("chin")) canonical = "chinese"
                        else if (cleaned.includes("ved")) canonical = "ved"
                        else if (/\bva\b/.test(cleaned) || cleaned.includes("visual") || cleaned.includes(" art")) canonical = "va"
                        else if (cleaned.includes("math") || cleaned.includes("mat")) canonical = "math"
                      }

                      const matched = canonical ? mapping[canonical as keyof typeof mapping] ?? null : null

                      // Render three boxes; centre one contains the adaptive link when available.
                      return [0, 1, 2].map((i) => {
                        const isCenter = i === 1
                        if (isCenter && matched) {
                          return (
                            <a
                              key={i}
                              href={matched.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 min-w-[6rem] px-4 py-3 rounded-md border border-outline-variant bg-surface-container-high hover:bg-surface-variant transition-colors text-center flex items-center justify-center gap-2"
                            >
                              <Globe className="h-4 w-4" />
                              <span className="font-medium">{matched.label}</span>
                            </a>
                          )
                        }

                        // Empty placeholder boxes
                        return (
                          <div
                            key={i}
                            className="flex-1 min-w-[6rem] h-10 rounded-md border border-outline-variant bg-transparent"
                            aria-hidden
                          />
                        )
                      })
                    })()}
                  </div>
                </div>
              </div>

               <Link href="/notices" className="hidden sm:flex rounded-m3-xl bg-tertiary-container text-tertiary-container-foreground p-4 flex-col justify-between hover:brightness-95 transition-all cursor-pointer h-full">
                  <div className="flex items-center gap-2 mb-4 opacity-80">
                    <Bell className="h-5 w-5" />
                    <span className="font-medium">Notices</span>
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <h3 className="text-3xl font-serif">View</h3>
                      <p className="text-sm font-medium opacity-80">Daily Notices</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-tertiary/20 flex items-center justify-center">
                        <ArrowRight className="h-5 w-5" />
                    </div>
                  </div>
               </Link>
            </div>
        </div>

        {/* SIDEBAR: Date & Quick Actions - 4 cols on desktop */}
        <div className="md:col-span-4 space-y-3">
          <div className="rounded-m3-xl bg-surface-container p-4 h-full min-h-[180px] flex flex-col">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  {format(displayDate, "EEEE, d MMMM")}
                </h3>
                
                <div className="space-y-3 flex-1 pr-2">
                  {todaysPeriods.length > 0 ? (
                    todaysPeriods.map((period, i) => {
                      let startTime = (period.time || '').split(' - ')[0] || ''
                      try {
                        const { start } = parseTimeRange(period.time || '')
                        startTime = formatTo12Hour(start)
                      } catch (e) {}
                      const isBreak = period.subject === 'Break'
                      const link = canvasLinks[(period.subject ?? '').trim()]
                      const cardClass = cn(
                        'flex-1 p-2 rounded-xl border transition-all shadow-sm',
                        period.subject === currentPeriod?.subject
                          ? 'bg-primary-container border-primary/20'
                          : 'bg-surface hover:bg-surface-container-high border-transparent hover:border-outline-variant'
                      )

                      return (
                    <div key={period.id ?? i} className="flex gap-3 items-center group cursor-pointer">
                          <div className="flex flex-col items-center min-w-[3rem]">
                            <span className="text-xs font-bold text-muted-foreground">{startTime}</span>
                          </div>

                            {isBreak ? (
                            <div className="flex-1 text-sm text-muted-foreground flex items-center">{period.period}</div>
                          ) : link ? (
                            <a href={link} target="_blank" rel="noopener noreferrer" className={`${cardClass} block`}>
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm truncate">{period.subject}</span>
                                  {period.isSubstitute && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-tertiary-container text-on-tertiary-container">Sub</span>
                                  )}
                                  {period.isRoomChange && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary-container text-on-secondary-container">Room</span>
                                  )}
                                </div>
                                <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
                                            <span>{period.isSubstitute ? period.teacher : (period.fullTeacher || period.teacher)}</span>
                                            <span>•</span>
                                            <span>{(period as any).toRoom || (period as any).roomTo || (period as any)["room_to"] || (period as any).newRoom || (period as any).to || period.room}</span>
                                </div>
                              </div>
                              <div className="md:hidden text-xs text-muted-foreground mt-1 truncate">{period.isSubstitute ? period.teacher : (period.fullTeacher || period.teacher)} • {(period as any).toRoom || (period as any).roomTo || (period as any)["room_to"] || (period as any).newRoom || (period as any).to || period.room}</div>
                            </a>
                          ) : (
                            <div className={cardClass}>
                              <div>
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-sm truncate">{period.subject}</p>
                                    {period.isSubstitute && (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-tertiary-container text-on-tertiary-container">Sub</span>
                                    )}
                                    {period.isRoomChange && (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary-container text-on-secondary-container">Room</span>
                                    )}
                                  </div>
                                  <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
                                    <span>{period.isSubstitute ? period.teacher : (period.fullTeacher || period.teacher)}</span>
                                    <span>•</span>
                                    <span>{period.room}</span>
                                  </div>
                                </div>
                                <div className="md:hidden text-xs text-muted-foreground mt-1 truncate">{period.isSubstitute ? period.teacher : (period.fullTeacher || period.teacher)} • {period.room}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No classes today</p>
                  )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
