"use client";

<<<<<<< HEAD
import { useState, useEffect, useMemo, useCallback } from "react";
import { Bagel_Fat_One } from "next/font/google";

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
import { getCurrentDay, formatDate, getCurrentTime, isSchoolDayOver, getNextSchoolDay } from "@/utils/time-utils";
import { trackSectionUsage } from "@/utils/usage-tracker";
import ThemeToggle from "@/components/theme-toggle";
import SettingsMenu from "@/components/settings-menu";
=======
>>>>>>> 5a8fbd17f6f66af4c908daa74515d0c2a0559aa0
import { useTimetable } from "@/contexts/timetable-context";
import { format } from "date-fns";
import { Loader2, Bell, MapPin, Calendar, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
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
    selectedDay
  } = useTimetable();
  
  const [currentDate, setCurrentDate] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentDate(new Date());
  }, []);

<<<<<<< HEAD
  // Portal profile (preferred source for display name)
  const { data: profileData, loading: profileLoading, refetch: refetchProfile } = useStudentProfile();
  const [profileOverride, setProfileOverride] = useState<any | null>(null)

  // Try a direct probe of the server-side proxy endpoint on mount to pick up a name
  // (this helps when the generic hook hasn't resolved yet or returns a wrapped payload)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/portal/userinfo', { credentials: 'include' })
        if (!res.ok) return
        const payload = await res.json()
        // Prefer `data` wrapper if present
        const candidate = payload?.data ?? payload
        if (!cancelled && candidate && typeof candidate === 'object') {
          // only apply if we don't already have an override and candidate looks useful
          if (!profileOverride) setProfileOverride(candidate)
        }
      } catch (e) {
        // swallow; fallback to existing hook
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Diagnostic: try server-side proxy endpoint directly and show result (helps when profileData is empty)
  const [portalDebug, setPortalDebug] = useState<any>(null)
  const [showPortalDebugDetails, setShowPortalDebugDetails] = useState(false)
  const [cookieDebug, setCookieDebug] = useState<any | null>(null)
  const [cookieLoading, setCookieLoading] = useState(false)
  const [cookieError, setCookieError] = useState<string | null>(null)
  const [handshakeLoading, setHandshakeLoading] = useState(false)
  const [handshakeResult, setHandshakeResult] = useState<any | null>(null)
  const [handshakeError, setHandshakeError] = useState<string | null>(null)
  const [investigateLoading, setInvestigateLoading] = useState(false)
  const [investigateResult, setInvestigateResult] = useState<any | null>(null)
  const [investigateError, setInvestigateError] = useState<string | null>(null)
  const [attemptingRefresh, setAttemptingRefresh] = useState(false)
  const [refreshAttempts, setRefreshAttempts] = useState(0)
  const MAX_REFRESH_ATTEMPTS = 2
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

  // If proxy reports 401 with HTML (login page), attempt a silent refresh once then re-probe
  useEffect(() => {
    if (!portalDebug) return
    const payload = portalDebug.payload || {}
    const isHtmlLogin =
      payload?.error?.includes("Portal returned HTML") ||
      portalDebug.status === 401 && typeof payload?.responseBody === "string" && payload.responseBody.trim().startsWith("<")

    if (isHtmlLogin && refreshAttempts < MAX_REFRESH_ATTEMPTS && !attemptingRefresh) {
      // try a short retry loop to restore session via server-side handshake
      setAttemptingRefresh(true)
      setRefreshAttempts((n) => n + 1)

      ;(async () => {
        try {
          // POST to handshake which attempts to perform the minimal portal login flow and forward cookies
          const h = await fetch('/api/portal/handshake', { method: 'POST', credentials: 'include' })
          let handshakeJson: any
          try { handshakeJson = await h.json() } catch (e) { handshakeJson = { ok: false, error: 'Invalid JSON from handshake', status: h.status } }

          // Save handshake diagnostic into portalDebug so user can inspect
          setPortalDebug((prev: any) => ({ ...(prev || {}), handshake: handshakeJson }))

          // Allow cookies a moment to be set in the browser
          await new Promise((res) => setTimeout(res, 400))

          // Re-probe portal userinfo (server proxy will now include forwarded cookies)
          const rp = await fetch('/api/portal/userinfo', { credentials: 'include' })
          let payload2: any
          try {
            payload2 = await rp.json()
          } catch (e) {
            payload2 = { error: 'Invalid JSON', status: rp.status, text: await rp.text() }
          }
          setPortalDebug({ ok: rp.ok, status: rp.status, payload: payload2, handshake: handshakeJson })

          // If portal returned JSON profile, use it as an override so greeting updates immediately
          if (payload2 && payload2.success && payload2.data) {
            setProfileOverride(payload2.data)
            try { await refetchProfile() } catch (e) { /* ignore */ }
          }

          // Note: Timetable preview on home now derives from TimetableContext; no direct fetch here

        } catch (e) {
          setPortalDebug((prev: any) => ({ ...(prev || {}), refreshAttempted: true, refreshError: String(e) }))
        } finally {
          setAttemptingRefresh(false)
        }
      })()
    }
  }, [portalDebug])

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

  // Timetable: derive today's periods from context (no API calls in this component)
  const { selectedDay, timetableData, timetableSource } = useTimetable()
  const todaysPeriods = useMemo(() => {
    const day = selectedDay || getCurrentDay()
    return (timetableData?.[day] ?? []) as any[]
  }, [selectedDay, timetableData])

  const getDisplaySubject = useCallback((period: any) => {
    if (period.type === "break") {
      return period.name || period.period;
    }
    return period.subject || period.name;
  }, []);

  const renderedPeriods = useMemo(() => {
    return todaysPeriods.map((period, idx) => (
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
  }, [todaysPeriods, getDisplaySubject]);

  const bagel = Bagel_Fat_One({
    weight: "400",
    subsets: ["latin"],
    display: "swap",
    variable: "--font-bagel-fat-one",
  })

  if (!mounted) {
=======
  if (isLoading || !currentDate) {
>>>>>>> 5a8fbd17f6f66af4c908daa74515d0c2a0559aa0
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

  const { currentPeriod, nextPeriod, timeUntil } = currentMomentPeriodInfo;
  
  // Get today's periods for the sidebar
  // Use selectedDay if available, otherwise fallback to current day name
  const dayName = selectedDay || format(currentDate, "EEEE");
  const todaysPeriods = timetableData[dayName] || [];

  return (
<<<<<<< HEAD
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
              {(profileLoading && !profileOverride && !attemptingRefresh) ? (
                  <Skeleton className="h-8 w-48 rounded-lg" />
                ) : (() => {
                  // prefer any override (freshly fetched via refresh probe), then profileData
                  const source = profileOverride || profileData || {}
                  const inner = (source as any).data || {}

                  const candidates = [
                    (source as any)?.givenName,
                    (source as any)?.givenname,
                    (source as any)?.given_name,
                    (source as any)?.firstName,
                    (source as any)?.first_name,
                    (source as any)?.name,
                    (source as any)?.username,
                    inner.givenName,
                    inner.givenname,
                    inner.firstName,
                    inner.first_name,
                    inner.name,
                    (source as any)?.student?.givenName,
                    (source as any)?.student?.name,
                  ]

                  let maybeGiven: string | null = null
                  for (const c of candidates) {
                    if (typeof c === 'string' && c.trim().length > 0) { maybeGiven = c.trim(); break }
                  }

                  if (maybeGiven) {
                    const first = maybeGiven.split(/\s+/)[0]
                    return `Hello, ${first}!`
                  }

                  if (attemptingRefresh) {
                    return (
                      <>Refreshing session… <span className="inline-block align-middle ml-2"><span className="animate-spin inline-block w-4 h-4 border-b-2 border-theme-primary rounded-full" /></span></>
                    )
                  }

                  return "Hello!"
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
                  {portalDebug && (!timetableSource || timetableSource === 'fallback-sample') ? (
                    // If the proxy returned an HTML login page (401), show a friendly sign-in prompt
                    (() => {
                      const payload = portalDebug.payload || {}
                      const isHtmlLogin =
                        payload?.error?.includes("Portal returned HTML") ||
                        portalDebug.status === 401 && typeof payload?.responseBody === "string" && payload.responseBody.trim().startsWith("<")

                      if (isHtmlLogin) {
                        const truncated = (typeof payload.responseBody === "string" && payload.responseBody.length > 0)
                          ? payload.responseBody.slice(0, 2048)
                          : null

                        return (
                          <div className="mt-2 text-xs text-gray-700 dark:text-gray-300 w-full sm:w-auto">
                            <div className="bg-yellow-50 dark:bg-yellow-900/40 p-3 rounded-md border border-yellow-200 dark:border-yellow-800">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="font-medium">Not signed in to SBHS Portal</div>
                                  <div className="text-[13px] text-gray-600 dark:text-gray-400 mt-1">Sign in to view your profile details and personalised greeting.</div>
                                  <div className="mt-3">
                                    <div className="flex items-center gap-2">
                                      <AuthButton />
                                      <button
                                        className="text-xs underline text-gray-600 dark:text-gray-300"
                                        onClick={() => {
                                          try { window.location.href = '/api/auth/login' } catch { window.location.assign('/api/auth/login') }
                                        }}
                                      >
                                        Open portal login
                                      </button>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <button
                                    className="text-xs underline text-gray-500 dark:text-gray-400"
                                    onClick={() => setShowPortalDebugDetails(v => !v)}
                                  >
                                    {showPortalDebugDetails ? "Hide debug" : "Show diagnostic"}
                                  </button>
                                </div>
                              </div>
                              {showPortalDebugDetails && (
                                <div className="mt-3 text-[11px] text-gray-700 dark:text-gray-300">
                                  <div className="font-medium mb-1">Proxy diagnostic</div>
                                  <div>Status: {portalDebug.status}</div>
                                  <div className="mt-2 whitespace-pre-wrap max-h-48 overflow-auto bg-white/50 dark:bg-black/20 p-2 rounded text-[11px]">
                                    {truncated ?? "(no response body)"}
                                  </div>

                                  {portalDebug.payload?.responseHeaders && (
                                    <div className="mt-3">
                                      <div className="font-medium">Proxy response headers</div>
                                      <pre className="whitespace-pre-wrap max-h-36 overflow-auto text-[11px] mt-2 bg-white/40 dark:bg-black/20 p-2 rounded">{JSON.stringify(portalDebug.payload.responseHeaders, null, 2)}</pre>
                                    </div>
                                  )}

                                  {portalDebug.payload?.probeResults && (
                                    <div className="mt-3">
                                      <div className="font-medium">Probe results</div>
                                      <div className="mt-2 text-[11px] text-gray-700 dark:text-gray-300">
                                        {Object.entries(portalDebug.payload.probeResults).map(([path, info]: any) => (
                                          <div key={path} className="mb-2">
                                            <div className="font-semibold">{path} — {info.ok ? 'OK' : `Status ${info.status ?? 'ERR'}`}</div>
                                            <div className="text-[11px] mt-1 whitespace-pre-wrap max-h-28 overflow-auto bg-white/40 dark:bg-black/20 p-2 rounded">{info.snippet ?? JSON.stringify(info)}</div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  <div className="mt-3">
                                    <div className="font-medium mb-1">Server cookies (masked)</div>
                                    <div className="text-[12px] text-gray-600 dark:text-gray-300">This shows the cookies the server sees when handling requests (masked for safety).</div>
                                    <div className="mt-2">
                                      <button
                                        className="text-xs underline text-gray-600 dark:text-gray-300"
                                        onClick={async () => {
                                          if (cookieDebug || cookieLoading) return
                                          setCookieLoading(true)
                                          setCookieError(null)
                                          try {
                                            const r = await fetch('/api/debug/cookies', { credentials: 'include' })
                                            const j = await r.json()
                                            setCookieDebug(j)
                                          } catch (e) {
                                            setCookieError(String(e))
                                          } finally {
                                            setCookieLoading(false)
                                          }
                                        }}
                                      >
                                        {cookieLoading ? 'Fetching cookies…' : (cookieDebug ? 'Refresh cookies' : 'Show cookies')}
                                      </button>
                                    </div>

                                    {cookieError && <div className="text-red-500 mt-2 text-xs">{cookieError}</div>}

                                    {cookieDebug && (
                                      <div className="mt-2 bg-white/50 dark:bg-black/20 p-2 rounded text-[12px] max-h-40 overflow-auto">
                                        <pre className="whitespace-pre-wrap">{JSON.stringify(cookieDebug, null, 2)}</pre>
                                      </div>
                                    )}

                                    <div className="mt-3">
                                      <div className="font-medium mb-1">Investigate session (handshake)</div>
                                      <div className="mt-2">
                                        <div className="flex items-center gap-3">
                                          <button
                                            className="text-xs underline text-gray-600 dark:text-gray-300"
                                            onClick={async () => {
                                              if (handshakeLoading) return
                                              setHandshakeLoading(true)
                                              setHandshakeError(null)
                                              try {
                                                const r = await fetch('/api/portal/handshake', { method: 'POST', credentials: 'include' })
                                                const j = await r.json()
                                                setHandshakeResult(j)
                                              } catch (e) {
                                                setHandshakeError(String(e))
                                              } finally {
                                                setHandshakeLoading(false)
                                              }
                                            }}
                                          >
                                            {handshakeLoading ? 'Running handshake…' : (handshakeResult ? 'Re-run handshake' : 'Run handshake')}
                                          </button>

                                          {/* Open IdP redirect (prefer captured location if present) */}
                                          <button
                                            className="text-xs underline text-gray-600 dark:text-gray-300"
                                            onClick={() => {
                                              // prefer the handshakeResult or portalDebug handshake locations if available
                                              const url = (handshakeResult?.locations?.[0]) || (portalDebug?.handshake?.locations?.[0]) || 'https://student.sbhs.net.au/auth/login'
                                              try { window.open(url, '_blank') } catch (e) { window.location.href = url }

                                              // start a short poll to auto-detect successful sign-in
                                              let attempts = 0
                                              const max = 15 // ~30s with 2s interval
                                              const iv = setInterval(async () => {
                                                attempts++
                                                try {
                                                  const ck = await fetch('/api/debug/cookies', { credentials: 'include' })
                                                  const cjson = await ck.json()
                                                  if (cjson && cjson.ok && Object.keys(cjson.cookies || {}).length > 0) {
                                                    // try userinfo now
                                                    const ui = await fetch('/api/portal/userinfo', { credentials: 'include' })
                                                    if (ui.ok) {
                                                      try { const uj = await ui.json(); setPortalDebug({ ok: true, status: ui.status, payload: uj }) } catch (e) {}
                                                      // refresh page state
                                                      try { await refetchProfile() } catch (e) {}
                                                      clearInterval(iv)
                                                      return
                                                    }
                                                  }
                                                } catch (e) {
                                                  // ignore
                                                }
                                                if (attempts >= max) clearInterval(iv)
                                              }, 2000)
                                            }}
                                          >
                                            Open IdP login
                                          </button>
                                        </div>
                                      </div>

                                      {handshakeError && <div className="text-red-500 mt-2 text-xs">{handshakeError}</div>}

                                      {handshakeResult && (
                                        <div className="mt-2 bg-white/50 dark:bg-black/20 p-2 rounded text-[12px] max-h-60 overflow-auto">
                                          <pre className="whitespace-pre-wrap">{JSON.stringify(handshakeResult, null, 2)}</pre>
                                        </div>
                                      )}
                                    </div>
                                    <div className="mt-3">
                                      <div className="font-medium mb-1">Deep investigation (verbose)</div>
                                      <div className="mt-2">
                                        <button
                                          className="text-xs underline text-gray-600 dark:text-gray-300"
                                          onClick={async () => {
                                            if (investigateLoading) return
                                            setInvestigateLoading(true)
                                            setInvestigateError(null)
                                            try {
                                              const r = await fetch('/api/portal/investigate', { credentials: 'include' })
                                              const j = await r.json()
                                              setInvestigateResult(j)
                                            } catch (e) {
                                              setInvestigateError(String(e))
                                            } finally {
                                              setInvestigateLoading(false)
                                            }
                                          }}
                                        >{investigateLoading ? 'Investigating…' : (investigateResult ? 'Re-run investigation' : 'Run deep investigation')}</button>
                                      </div>

                                      {investigateError && <div className="text-red-500 mt-2 text-xs">{investigateError}</div>}

                                      {investigateResult && (
                                        <div className="mt-2 bg-white/40 dark:bg-black/20 p-2 rounded max-h-72 overflow-auto">
                                          <pre className="whitespace-pre-wrap text-[11px]">{JSON.stringify(investigateResult, null, 2)}</pre>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      }

                      // Fallback: non-HTML diagnostic (show compact JSON, not raw HTML)
                      return (
                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <details className="bg-yellow-50 dark:bg-yellow-900 p-2 rounded-md border border-yellow-200 dark:border-yellow-800">
                            <summary className="cursor-pointer">/api/portal/userinfo (diagnostic)</summary>
                            <pre className="whitespace-pre-wrap max-h-60 overflow-auto text-[11px] mt-2">{JSON.stringify(portalDebug, (k, v) => {
                              // avoid dumping huge HTML bodies accidentally
                              if (k === 'responseBody' && typeof v === 'string') return v.slice(0, 2048)
                              return v
                            }, 2)}</pre>
                          </details>
                        </div>
                      )
                    })()
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
=======
    <div className="space-y-6 pb-24 md:pb-8 animate-in fade-in duration-700">
      
      {/* Header Section */}
      <div className="flex flex-col gap-1 pt-4 md:pt-0">
        <h1 className="text-4xl md:text-5xl font-serif text-foreground">
          {format(currentDate, "EEEE")}
        </h1>
        <p className="text-lg text-muted-foreground font-medium">
          {format(currentDate, "MMMM do")}
        </p>
>>>>>>> 5a8fbd17f6f66af4c908daa74515d0c2a0559aa0
      </div>

      {/* Main Expressive Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
        
        {/* HERO: Current/Next Period - Spans full width on mobile, 8 cols on desktop */}
        <div className="md:col-span-8 space-y-4">
            
            {/* Primary Status Card */}
            <div className="relative overflow-hidden rounded-m3-2xl bg-primary-container text-primary-container-foreground p-6 md:p-8 shadow-elevation-1 hover:shadow-elevation-2 transition-all duration-500 ease-expressive hover:scale-[1.01] group">
              {/* Background Blob */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-primary/20" />
              
              <div className="relative z-10 flex flex-col h-full justify-between min-h-[200px]">
                <div className="flex justify-between items-start">
                  <Badge variant="secondary" className="bg-primary/20 text-primary-container-foreground hover:bg-primary/30 rounded-full px-4 py-1 text-sm font-medium">
                    Now
                  </Badge>
                  <MapPin className="h-6 w-6 opacity-60" />
                </div>
                
                <div className="mt-4">
                  <h2 className="text-4xl md:text-6xl font-serif leading-tight mb-2">
                    {currentPeriod?.subject || "Free Period"}
                  </h2>
                  <div className="flex items-center gap-3 text-lg opacity-80 font-medium">
                    <span className="bg-primary-foreground/20 px-3 py-1 rounded-md">
                      {currentPeriod?.room || "Campus"}
                    </span>
                    <span>•</span>
                    <span>{currentPeriod?.teacher || "Self Study"}</span>
                  </div>
                </div>

                <div className="mt-8">
                  <div className="h-2 w-full bg-primary/20 rounded-full overflow-hidden">
                    {/* Progress bar could be calculated based on time */}
                    <div className="h-full bg-primary w-[45%] rounded-full" />
                  </div>
                  <div className="flex justify-between text-sm mt-2 font-medium opacity-70">
                    <span>{currentPeriod?.time?.split(' - ')[0] || "Now"}</span>
                    <span>{currentPeriod?.time?.split(' - ')[1] || "Later"}</span>
                  </div>
                </div>
              </div>
<<<<<<< HEAD
              <div>
                <h3 className={`${bagel.className} font-semibold text-lg`}>
                  {isSchoolDayOver()
                    ? `${getCurrentDay(getNextSchoolDay(new Date()))}'s Synchron`
                    : "Today's Synchron"}
=======
            </div>

            {/* Next Up Card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div className="rounded-m3-xl bg-surface-container-high p-6 flex flex-col justify-between hover:bg-surface-variant transition-colors duration-300">
                  <div className="flex items-center gap-2 text-muted-foreground mb-4">
                    <ArrowRight className="h-5 w-5" />
                    <span className="font-medium">Up Next {timeUntil && `(${timeUntil})`}</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-1">{nextPeriod?.subject || "End of Day"}</h3>
                    <p className="text-muted-foreground">{nextPeriod?.room || "Home"}</p>
                  </div>
               </div>

               <Link href="/notices" className="rounded-m3-xl bg-tertiary-container text-tertiary-container-foreground p-6 flex flex-col justify-between hover:brightness-95 transition-all cursor-pointer">
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
        <div className="md:col-span-4 space-y-4">
            <div className="rounded-m3-xl bg-surface-container p-6 h-full min-h-[300px] flex flex-col">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    {dayName}
>>>>>>> 5a8fbd17f6f66af4c908daa74515d0c2a0559aa0
                </h3>
                
                <div className="space-y-4 flex-1 overflow-y-auto max-h-[400px] pr-2">
                    {todaysPeriods.length > 0 ? (
                      todaysPeriods.map((period, i) => (
                          <div key={i} className="flex gap-4 items-center group cursor-pointer">
                              <div className="flex flex-col items-center min-w-[3rem]">
                                  <span className="text-xs font-bold text-muted-foreground">{period.time.split(' - ')[0]}</span>
                              </div>
                              <div className={cn(
                                "flex-1 p-3 rounded-xl border transition-all shadow-sm",
                                period.subject === currentPeriod?.subject 
                                  ? "bg-primary-container border-primary/20" 
                                  : "bg-surface hover:bg-surface-container-high border-transparent hover:border-outline-variant"
                              )}>
                                  <p className="font-medium text-sm">{period.subject}</p>
                                  <p className="text-xs text-muted-foreground">{period.room}</p>
                              </div>
                          </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-center py-8">No classes today</p>
                    )}
                </div>
                
                <Link href="/timetable" className="mt-6 w-full py-3 rounded-full border border-outline text-center text-sm font-medium hover:bg-surface-variant transition-colors">
                    View Full Week
                </Link>
            </div>
        </div>
      </div>
    </div>
  );
}
