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
  // Timetable preview derives from TimetableContext; no direct API calls here
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
  const { data: profileData, loading: profileLoading, refetch: refetchProfile } = useStudentProfile();
  const [profileOverride, setProfileOverride] = useState<any | null>(null)

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
                    return `Welcome Back, ${first}!`
                  }

                  if (attemptingRefresh) {
                    return (
                      <>Refreshing session… <span className="inline-block align-middle ml-2"><span className="animate-spin inline-block w-4 h-4 border-b-2 border-theme-primary rounded-full" /></span></>
                    )
                  }

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
            {todaysPeriods.length > 0 ? (
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
