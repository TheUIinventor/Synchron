"use client";

import { useTimetable } from "@/contexts/timetable-context";
import { format } from "date-fns";
import { Loader2, Bell, MapPin, Calendar, ArrowRight, Mail, Clipboard as ClipboardIcon, Globe, BookOpen, Settings as SettingsIcon, Cloud, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { sbhsPortal } from "@/lib/api/client";
import { AuthButton } from "@/components/auth-button";
import { parseTimeRange, formatTo12Hour, isSchoolDayOver, getNextSchoolDay } from "@/utils/time-utils";
import { getNextBell } from "@/utils/bell-utils";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { cn, stripLeadingCasualCode } from "@/lib/utils";

  // Subject color mapping (copied from timetable page for consistency)
  const getSubjectColor = (subject: string) => {
    const s = (subject || '').toUpperCase();
    if (s.includes("ENG")) return "bg-yellow-200 text-yellow-900 dark:bg-yellow-900/50 dark:text-yellow-100";
    if (s.includes("MAT")) return "bg-orange-200 text-orange-900 dark:bg-orange-900/50 dark:text-orange-100";
    if (s.includes("SCI") || s.includes("PHY") || s.includes("CHE") || s.includes("BIO")) return "bg-teal-200 text-teal-900 dark:bg-teal-900/50 dark:text-teal-100";
    if (s.includes("HIS") || s.includes("GEO") || s.includes("ECO") || s.includes("BUS") || s.includes("LEG")) return "bg-blue-200 text-blue-900 dark:bg-blue-900/50 dark:text-blue-100";
    if (s.includes("COM") || s.includes("IST") || s.includes("SDD") || s.includes("IPT")) return "bg-cyan-200 text-cyan-900 dark:bg-cyan-900/50 dark:text-cyan-100";
    if (s.includes("MUS") || s.includes("ART") || s.includes("VA") || s.includes("DRA")) return "bg-purple-200 text-purple-900 dark:bg-purple-900/50 dark:text-purple-100";
    if (s.includes("PDH") || s.includes("PE") || s.includes("SP") || s.includes("SPO")) return "bg-green-200 text-green-900 dark:bg-green-900/50 dark:text-green-100";
    if (s.includes("TEC") || s.includes("D&T") || s.includes("TAS") || s.includes("FOO")) return "bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-100";
    if (s.includes("LAN") || s.includes("FRE") || s.includes("GER") || s.includes("JAP") || s.includes("CHI")) return "bg-pink-200 text-pink-900 dark:bg-pink-900/50 dark:text-pink-100";
    if (s.includes("REL") || s.includes("SCR") || s.includes("CAT")) return "bg-indigo-200 text-indigo-900 dark:bg-indigo-900/50 dark:text-indigo-100";
    if (s.includes("BRE") || s.includes("REC") || s.includes("LUN")) return "bg-surface-variant text-on-surface-variant";
    return "bg-surface-container-high text-on-surface";
  }

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
    return abbrMap[subject] || String(subject || '').substring(0,3).toUpperCase()
  }

export default function HomeClient() {
  const { 
    timetableData, 
    currentMomentPeriodInfo, 
    isLoading, 
    isRefreshing,
    error, 
    refreshExternal,
    selectedDay,
    selectedDateObject,
    timetableSource,
    bellTimes,
    reauthRequired } = useTimetable() as any;
  
  // Initialize immediately so header can render without waiting for effects
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [canvasLinks, setCanvasLinks] = useState<Record<string, string>>({})
  const [givenName, setGivenName] = useState<string | null>(() => {
    try {
      if (typeof window === 'undefined') return null
      const raw = localStorage.getItem('synchron-given-name')
      return raw || null
    } catch (e) {
      return null
    }
  })

  useEffect(() => {
    // keep clock updated every second so countdowns refresh on mobile pill
    const t = setInterval(() => setCurrentDate(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

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
          const name = res.data.givenName
          setGivenName(name)
          try {
            localStorage.setItem('synchron-given-name', String(name))
          } catch (e) {
            // ignore storage errors
          }
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

  

  if (error) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-[50vh] text-center space-y-4">
        <div className="w-24 h-24 rounded-3xl bg-destructive/10 flex items-center justify-center mb-4">
          <Loader2 className="h-10 w-10 text-destructive animate-spin" />
        </div>
        <h2 className="text-2xl font-sans font-semibold text-destructive">Connection Error</h2>
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
  
  // Determine the date to display for the HOME page. The home page should
  // not be influenced by a manual date selection on the timetable page, so
  // do not use `selectedDateObject` from the provider here. Instead use the
  // local clock and auto-advance after school hours/weekends.
  const displayDate = (() => {
    const now = currentDate
    const isWeekend = now.getDay() === 0 || now.getDay() === 6
    if (isWeekend || isSchoolDayOver()) return getNextSchoolDay(now)
    return now
  })()

  // Use the displayDate's weekday to pick today's timetable for the home page.
  const dayName = format(displayDate, "EEEE");
  const todaysPeriodsRaw = timetableData[dayName] || [];

  // Map provider bell buckets into the day-specific bucket keys used elsewhere.
  const bellsForDay = (() => {
    if (!bellTimes) return []
    if (dayName === 'Friday') return (bellTimes as any).Fri || []
    if (dayName === 'Wednesday' || dayName === 'Thursday') return (bellTimes as any)['Wed/Thurs'] || []
    return (bellTimes as any)['Mon/Tues'] || []
  })()

  // Debug: log timetable state to help diagnose missing classes on home page
  if (typeof window !== 'undefined') {
    try {
      // keep these logs lightweight and helpful
      console.debug('[home-client] dayName', dayName)
      console.debug('[home-client] todaysPeriodsRaw', (todaysPeriodsRaw || []).map(p => ({ period: p.period, subject: p.subject, time: p.time })))
      console.debug('[home-client] bellTimes', bellTimes)
      console.debug('[home-client] currentMomentPeriodInfo', currentMomentPeriodInfo)
    } catch (e) {}
  }

  // Helper: normalize period label for comparison
  const normalizePeriodLabel = (p?: string) => String(p || '').trim().toLowerCase()
  // Keep roll call and period 0 visible — show all entries
  const todaysPeriods = todaysPeriodsRaw

  // Helper: find a bell time for a given period by label matching, falling
  // back to index-based lookup when a direct label match isn't found.
  const findBellTimeForPeriod = (p: any, bucket: any[] | null, index: number) => {
    try {
      if (!bucket || !Array.isArray(bucket)) return ''
      const label = String(p?.period || p?.title || '').trim()
      if (label) {
        const found = bucket.find((b: any) => {
          const bLabel = String(b?.originalPeriod || b?.period || b?.bell || b?.bellDisplay || '').trim()
          if (!bLabel) return false
          if (bLabel.toLowerCase() === label.toLowerCase()) return true
          if (bLabel.toLowerCase().includes(label.toLowerCase())) return true
          if (label.toLowerCase().includes(bLabel.toLowerCase())) return true
          // numeric match (e.g. '1' vs 'Period 1')
          const n1 = (label.match(/\d+/) || [])[0]
          const n2 = (bLabel.match(/\d+/) || [])[0]
          if (n1 && n2 && n1 === n2) return true
          // RC / Roll Call tolerance
          if ((/^(rc|roll call)$/i).test(label) && /rc|roll/i.test(bLabel)) return true
          return false
        })
        if (found) {
          return found.time || (found.startTime ? (found.startTime + (found.endTime ? ' - ' + found.endTime : '')) : '')
        }
      }
      // fallback to index-based bucket lookup
      const byIndex = bucket[index]
      if (byIndex) return byIndex.time || (byIndex.startTime ? (byIndex.startTime + (byIndex.endTime ? ' - ' + byIndex.endTime : '')) : '')
    } catch (e) {
      // ignore
    }
    return ''
  }

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

  // Helper to determine which teacher name to display for a period, preferring full names.
  const displayTeacher = (p: any) => {
    if (!p) return null
    // Prefer the provider-computed `displayTeacher` when available which
    // already prefers `casualSurname` over codes and strips leading casual codes.
    if ((p as any).displayTeacher) return stripLeadingCasualCode((p as any).displayTeacher)
    // Fallbacks
    if (p.isSubstitute && (p as any).casualSurname) return (p as any).casualSurname
    const candidate = p.fullTeacher || p.teacher || null
    if (p.isSubstitute && candidate) return stripLeadingCasualCode(candidate)
    return candidate
  }

  const isSubstitutePeriod = (p: any) => {
    try {
      if (!p) return false
      // Only treat a period as a substitute-highlight when there is an
      // explicit casual marker. To be resilient when `isSubstitute` may
      // be missing, also consider `casualToken`, `displayTeacher` differing
      // from `teacher`, or an explicit `isSubstitute` flag.
      const hasCasual = Boolean((p as any).casualSurname || (p as any).casual || (p as any).casualToken)
      const disp = String((p as any).displayTeacher || '').trim()
      const teacher = String(p.teacher || '').trim()
      const rawIsCode = /^[A-Z]{1,4}$/.test(teacher)
      const dispLooksName = disp && !/^[A-Z0-9\s]{1,6}$/.test(disp)
      const displayDiff = disp && teacher && stripLeadingCasualCode(disp) !== stripLeadingCasualCode(teacher)
      const displayIndicatesSub = (rawIsCode && dispLooksName) || (displayDiff && hasCasual)
      return Boolean(p.isSubstitute || hasCasual || displayIndicatesSub)
    } catch (e) { return Boolean(p?.isSubstitute || (p as any)?.casualSurname) }
  }

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

  // Format milliseconds to HH:MM:SS (always show hours)
  const formatMsHHMMSS = (ms: number) => {
    const total = Math.max(0, Math.floor(ms / 1000))
    const hours = Math.floor(total / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    const seconds = total % 60
    const hh = String(hours).padStart(2, '0')
    const mm = String(minutes).padStart(2, '0')
    const ss = String(seconds).padStart(2, '0')
    return `${hh}:${mm}:${ss}`
  }

  // Compute bell state for the display day
  const bellState = getNextBell(bellsForDay as any);
  const noClassesByBells = !bellsForDay || (Array.isArray(bellsForDay) && bellsForDay.length === 0) || (!bellState.nextBell && !bellState.isCurrentlyInPeriod);

  return (
    <div className="space-y-4 pb-6 md:pb-6 animate-in fade-in duration-700">
      
      {/* Header Section */}
      <div className="flex items-start justify-between gap-4 pt-4 md:pt-0">
        <div className="flex flex-col gap-1">
          <h2 className="mt-[10px] text-2xl sm:text-3xl md:text-4xl font-medium text-foreground leading-tight truncate">{givenName ? `Hello, ${givenName}!` : 'Hello!'}</h2>
          {/* Page title and date removed per user preference; greeting shown above */}
        </div>

          <div className="flex items-center gap-3">
            {/* Sync indicator placed left of the settings icon. Spinner while loading, cloud+check when synced. */}
            <div className="flex items-center">
              {(isLoading || isRefreshing) ? (
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
        
        {/* HERO: Current/Next Period - Spans full width on mobile, 6 cols on desktop */}
        <div className="md:col-span-6 space-y-3 flex flex-col md:h-full">
            
            {/* Primary Status Card */}
            {/* Mobile-only compact pill (shows countdown and next period) */}
            {!noClassesByBells && (
              <Link href="/timetable" className="block sm:hidden w-full">
                <div className="mx-auto max-w-[680px] px-3 py-2 rounded-full bg-primary text-primary-foreground font-medium flex items-center justify-between shadow-sm">
                  <>
                    <span className="text-sm md:text-base truncate">
                      {formatMsHHMMSS(bellState.timeUntil)} to {bellState.isCurrentlyInPeriod ? (bellState.currentPeriod?.period || 'class') : (bellState.nextBell?.period || 'next bell')}
                    </span>
                    <ArrowRight className="ml-3 h-4 w-4 opacity-90" />
                  </>
                </div>
              </Link>
            )}

            {/* Desktop / tablet expressive card (hidden on small screens) */}
            <div className="hidden sm:block relative overflow-hidden rounded-m3-2xl now-card text-primary-container-foreground p-4 sm:p-5 md:p-6 shadow-elevation-1 transition-all duration-300 ease-expressive group w-full md:w-full md:max-w-none">
              {/* Background Blob (hidden on small screens to avoid overflow) */}
              <div className="hidden md:block absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl md:-mr-16 md:-mt-16 transition-all group-hover:bg-primary/20 pointer-events-none" />
              
              <div className="relative z-10 flex flex-col h-full justify-between min-h-[150px]">
                <div className="flex justify-between items-start">
                  <Badge variant="secondary" className="bg-primary/20 text-current hover:bg-primary/30 rounded-full px-4 py-1 text-sm font-medium">
                    Now
                  </Badge>
                  <MapPin className="h-6 w-6 opacity-60" />
                </div>
                
                <div className="mt-3">
                  <h2 className="text-2xl sm:text-3xl md:text-5xl font-sans font-semibold leading-tight mb-2">
                    {currentPeriod?.subject ? (
                      canvasLinks[currentPeriod.subject] ? (
                        <a href={canvasLinks[currentPeriod.subject]} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          {currentPeriod.subject}
                        </a>
                      ) : (
                        <>{currentPeriod.subject}</>
                      )
                    ) : (
                      "Free Period"
                    )}
                  </h2>
                  <div className="flex items-center gap-3 text-lg opacity-80 font-medium">
                    {isSubstitutePeriod(currentPeriod) ? (
                      <span className="inline-block bg-blue-600 text-white px-3 py-1 rounded-full">
                        {displayTeacher(currentPeriod) || "Self Study"}
                      </span>
                    ) : (
                      <span className="bg-primary-foreground/20 px-3 py-1 rounded-md">
                        {displayTeacher(currentPeriod) || "Self Study"}
                      </span>
                    )}
                    <span>•</span>
                    <span>{currentPeriod?.room || "Campus"}</span>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex flex-col items-end text-sm mb-1">
                    <span className="text-[15px] opacity-90">
                      {nextPeriod?.subject ? (
                        <>
                          <span className="inline md:hidden">{nextPeriod.subject}</span>
                          <span className="hidden md:inline">{(nextPeriod as any)?.title || nextPeriod.subject}</span>
                          {" in"}
                        </>
                      ) : ""}
                    </span>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 w-full md:w-full md:items-stretch">
              <div className="rounded-m3-xl bg-surface-container-high p-4 hover:bg-surface-container-highest transition-colors duration-300 flex flex-col justify-between h-full overflow-hidden sm:overflow-visible">
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
                        chi: "chinese",
                        chin: "chinese",
                        chinese: "chinese",
                        ved: "ved",
                        va: "va",
                        visual: "va",
                        art: "va",
                        math: "math",
                        maths: "math",
                        mat: "math",
                        ma: "math",
                      }

                      let canonical: string | null = null
                      if (codeMap[first]) canonical = codeMap[first]
                      else {
                        if (cleaned.includes("chinese") || cleaned.includes("chin")) canonical = "chinese"
                        else if (cleaned.includes("ved")) canonical = "ved"
                        else if (/\bva\b/.test(cleaned) || cleaned.includes("visual") || cleaned.includes(" art")) canonical = "va"
                        else if (cleaned.includes("math") || cleaned.includes("mat")) canonical = "math"
                      }

                      const matched = canonical ? mapping[canonical as keyof typeof mapping] ?? null : null

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
                      <h3 className="text-3xl font-sans font-semibold">View</h3>
                      <p className="text-sm font-medium opacity-80">Daily Notices</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-tertiary/20 flex items-center justify-center">
                        <ArrowRight className="h-5 w-5" />
                    </div>
                  </div>
               </Link>
            </div>
        </div>

        {/* SIDEBAR: Date & Quick Actions - 6 cols on desktop (approx. 50%) */}
        <div className="md:col-span-6 space-y-3">
          <div className="rounded-m3-xl bg-surface-container p-4 h-full min-h-[180px] flex flex-col">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  {format(displayDate, "EEEE, d MMMM")}
                </h3>
                
                <div className="space-y-3 flex-1 pr-2">
                  {todaysPeriods.length > 0 ? (
                    todaysPeriods.map((period, i) => {
                      // prefer explicit period.time, otherwise use provider bell bucket
                      let startTime = (period.time || '')
                      try {
                        if (!startTime && bellTimes) {
                          const bucket = (dayName === 'Friday' ? bellTimes.Fri : (dayName === 'Wednesday' || dayName === 'Thursday' ? bellTimes['Wed/Thurs'] : bellTimes['Mon/Tues']))
                          startTime = startTime || findBellTimeForPeriod(period, bucket, i)
                        }
                        const { start } = parseTimeRange(startTime || '')
                        startTime = formatTo12Hour(start)
                      } catch (e) {}
                      
                      // Treat Period 0, Roll Call, End of Day, and Break as non-class periods
                      const periodLabel = String(period.period || '').trim().toLowerCase()
                      const subjectLabel = String(period.subject || '').trim().toLowerCase()
                      const isNonClass = period.subject === 'Break' || 
                        periodLabel === '0' || periodLabel === 'rc' || periodLabel === 'eod' ||
                        subjectLabel.includes('period 0') || subjectLabel.includes('roll call') || subjectLabel.includes('end of day')
                      // Get display label for non-class periods
                      const nonClassLabel = (() => {
                        if (period.subject === 'Break') return period.period
                        if (periodLabel === '0' || subjectLabel.includes('period 0')) return 'Period 0'
                        if (periodLabel === 'rc' || subjectLabel.includes('roll call')) return 'Roll Call'
                        if (periodLabel === 'eod' || subjectLabel.includes('end of day')) return 'End of Day'
                        return period.period || period.subject
                      })()
                      
                      const link = canvasLinks[(period.subject ?? '').trim()]
                      const cardClass = cn(
                        'flex-1 p-2 rounded-xl border transition-all shadow-sm',
                        period.subject === currentPeriod?.subject
                          ? 'sidebar-current border-primary/20'
                          : 'bg-surface hover:bg-surface-container-high border-transparent hover:border-outline-variant'
                      )

                      return (
                    <div key={period.id ?? i} className="flex gap-3 items-center group cursor-pointer">
                          <div className="flex flex-col items-center min-w-[3rem]">
                            <span className="text-xs font-bold text-muted-foreground">{startTime}</span>
                          </div>

                            {isNonClass ? (
                            <div className="flex-1 text-sm text-muted-foreground flex items-center">{nonClassLabel}</div>
                          ) : link ? (
                            <a href={link} target="_blank" rel="noopener noreferrer" className={`${cardClass} flex items-stretch gap-2`}>
                              {/* Subject colour bar */}
                              {period.colour && (
                                <div 
                                  className="w-1 min-w-[4px] rounded-lg self-stretch" 
                                  style={{ backgroundColor: `#${period.colour}` }} 
                                />
                              )}
                              <div className="flex-1">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className={`hidden md:inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold flex-shrink-0 max-w-[220px] truncate ${getSubjectColor(period.subject)}`}>
                                      <span className="truncate block max-w-full text-xs font-semibold leading-none">{period.subject}</span>
                                    </div>
                                  </div>
                                  <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
                                    {(isSubstitutePeriod(period)) ? (
                                      <span className="inline-block px-2 py-0.5 rounded-md text-xs font-medium truncate max-w-[100px]"
                                        style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}
                                      >
                                        {displayTeacher(period)}
                                      </span>
                                    ) : (
                                      <span className="text-on-surface-variant truncate max-w-[100px]">{displayTeacher(period)}</span>
                                    )}
                                    <span>•</span>
                                    {/* Room: prefer destination room fields when present; highlight if a room change */}
                                    {(() => {
                                      // NOTE: Do NOT include `.to` - that field is commonly used for end times
                                      const displayRoom = (period as any).displayRoom || (period as any).toRoom || (period as any).roomTo || (period as any)["room_to"] || (period as any).newRoom || period.room
                                      return (
                                        <span className={`truncate max-w-[72px] text-sm ${period.isRoomChange ? 'inline-block px-2 py-0.5 rounded-md font-medium' : 'text-on-surface-variant'}`} style={period.isRoomChange ? { backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' } : {}}>{displayRoom}</span>
                                      )
                                    })()}
                                  </div>
                                </div>
                                  <div className="md:hidden text-xs text-muted-foreground mt-1 truncate">
                                    {(isSubstitutePeriod(period)) ? (
                                      <span className="inline-block px-2 py-0.5 rounded-md text-xs font-medium truncate max-w-[100px]"
                                        style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}
                                      >
                                        {displayTeacher(period)}
                                      </span>
                                    ) : (
                                      <span className="text-on-surface-variant truncate max-w-[100px]">{displayTeacher(period)}</span>
                                    )}
                                    <span className="mx-2">•</span>
                                    {(() => {
                                      // NOTE: Do NOT include `.to` - that field is commonly used for end times
                                      const displayRoom = (period as any).displayRoom || (period as any).toRoom || (period as any).roomTo || (period as any)["room_to"] || (period as any).newRoom || period.room
                                      return (
                                        <span className={`truncate max-w-[72px] text-sm ${period.isRoomChange ? 'inline-block px-2 py-0.5 rounded-md font-medium' : 'text-on-surface-variant'}`}
                                          style={period.isRoomChange ? { backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' } : {}}>
                                          {displayRoom}
                                        </span>
                                      )
                                    })()}
                                  </div>
                              </div>
                            </a>
                          ) : (
                            <div className={`${cardClass} flex items-stretch gap-2`}>
                              {/* Subject colour bar */}
                              {period.colour && (
                                <div 
                                  className="w-1 min-w-[4px] rounded-lg self-stretch" 
                                  style={{ backgroundColor: `#${period.colour}` }} 
                                />
                              )}
                              <div className="flex-1">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className={`rounded-md px-2 py-0.5 text-xs font-semibold flex-shrink-0 min-w-[32px] text-center ${getSubjectColor(period.subject)}`}>
                                      {getSubjectAbbr(period.subject)}
                                    </div>
                                    <div className="truncate font-medium text-sm">{period.subject}</div>
                                  </div>
                                  <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
                                    {(isSubstitutePeriod(period)) ? (
                                      <span className="inline-block px-2 py-0.5 rounded-md text-xs font-medium truncate max-w-[100px]"
                                        style={{ backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}
                                      >
                                        {displayTeacher(period)}
                                      </span>
                                    ) : (
                                      <span className="text-on-surface-variant truncate max-w-[100px]">{displayTeacher(period)}</span>
                                    )}
                                    <span>•</span>
                                    <span className="text-on-surface-variant">{(period as any).displayRoom || period.room}</span>
                                  </div>
                                </div>
                                <div className="md:hidden text-xs text-muted-foreground mt-1 truncate">
                                  <span className={`text-sm truncate max-w-[100px] ${isSubstitutePeriod(period) ? 'bg-tertiary-container text-on-tertiary-container px-2 py-1 rounded-md' : 'text-on-surface-variant'}`}>
                                    {displayTeacher(period)}
                                    </span>
                                    <span className="mx-2">•</span>
                                    {(() => {
                                      // NOTE: Do NOT include `.to` - that field is commonly used for end times
                                      const displayRoom = (period as any).displayRoom || (period as any).toRoom || (period as any).roomTo || (period as any)["room_to"] || (period as any).newRoom || period.room
                                      return (
                                        <span className={`truncate max-w-[72px] text-sm ${period.isRoomChange ? 'inline-block px-2 py-0.5 rounded-md font-medium' : (isSubstitutePeriod(period) ? 'text-on-primary-foreground' : 'text-on-surface-variant')}`}
                                          style={period.isRoomChange ? { backgroundColor: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' } : {}}>
                                          {displayRoom}
                                        </span>
                                      )
                                    })()}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })
                  ) : reauthRequired ? (
                    <div className="text-center py-8 space-y-3">
                      <p className="text-muted-foreground">Sign in to see your timetable</p>
                      <AuthButton />
                    </div>
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
