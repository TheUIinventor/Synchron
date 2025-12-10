"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Type, Home, ChevronLeft, Calendar, Bell, Clipboard, Award } from "lucide-react"
import { Button } from "@/components/ui/button"
import ThemeToggle from "@/components/theme-toggle"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { useUserSettings, type ColorTheme, type FontTheme } from "@/components/theme-provider"
import { useTimetableSafe } from "@/contexts/timetable-context"
import { useToast } from "@/hooks/use-toast"
// Feedback is now an embedded Google Form iframe; no local textarea needed
// NavItem removed - navigation tabs control is no longer user-configurable
import { trackSectionUsage } from "@/utils/usage-tracker"
import PageTransition from "@/components/page-transition"
import InstallAppButton from "@/components/install-app-button"

const CANVAS_LINKS_KEY = "synchron-canvas-links"

function CanvasLinksEditor() {
  const timetableCtx = useTimetableSafe()
  const timetableData = timetableCtx?.timetableData || {}
  const { toast } = useToast()
  const [links, setLinks] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CANVAS_LINKS_KEY)
      if (raw) setLinks(JSON.parse(raw))
    } catch (e) {}
  }, [])

  const subjects = Array.from(
    new Set(
      Object.values(timetableData || {})
        .flat()
        .map((p: any) => (p.subject ?? "").trim())
        .filter((s: string) => !!s && s.toLowerCase() !== "break")
    )
  ).sort()

  function handleChange(subject: string, value: string) {
    const key = subject.trim()
    setLinks((prev) => ({ ...prev, [key]: value }))
  }

  function handleSave(subject?: string) {
    try {
      // Normalize URLs: ensure protocol present
      const normalize = (u: string) => {
        if (!u) return u
        if (/^https?:\/\//i.test(u)) return u
        return `https://${u}`
      }
      const currentStored = JSON.parse(localStorage.getItem(CANVAS_LINKS_KEY) || "{}")
      const toSave = subject
        ? { ...currentStored, [subject.trim()]: normalize(links[subject.trim()] ?? "") }
        : Object.fromEntries(
            Object.entries(links).map(([k, v]) => [k.trim(), normalize(v as string)])
          )
      localStorage.setItem(CANVAS_LINKS_KEY, JSON.stringify(toSave))
      // Notify other components in this window that links updated
      try { window.dispatchEvent(new CustomEvent('synchron:canvas-links-updated', { detail: { subject: subject ?? 'all' } })) } catch (e) {}
      setSaved(subject ?? "all")
      try {
        if (subject) {
          toast({ title: `Saved link for ${subject}`, description: toSave[subject] })
        } else {
          toast({ title: `Saved all Canvas links` })
        }
      } catch (e) {}
      setTimeout(() => setSaved(null), 2000)
    } catch (e) {}
  }

  function handleClear(subject: string) {
    try {
      const raw = JSON.parse(localStorage.getItem(CANVAS_LINKS_KEY) || "{}")
      delete raw[subject.trim()]
      localStorage.setItem(CANVAS_LINKS_KEY, JSON.stringify(raw))
      setLinks((prev) => {
        const copy = { ...prev }
        delete copy[subject.trim()]
        return copy
      })
      setSaved(subject)
      try { window.dispatchEvent(new CustomEvent('synchron:canvas-links-updated', { detail: { subject } })) } catch (e) {}
      try { toast({ title: `Cleared link for ${subject}` }) } catch (e) {}
      setTimeout(() => setSaved(null), 1500)
    } catch (e) {}
  }

  return (
    <div className="space-y-3">
      {subjects.length === 0 && (
        <p className="text-sm text-on-surface-variant">No subjects found in timetable yet.</p>
      )}

      {subjects.map((s) => (
        <div key={s} className="flex gap-3 items-start">
          <div className="flex-1">
            <label className="text-sm font-medium">{s}</label>
            <input
              className="w-full mt-1 p-2 rounded-md bg-surface-container-high border border-transparent focus:border-outline-variant"
              placeholder={`https://canvas.school.edu/courses/...`}
              value={links[s] ?? ""}
              onChange={(e) => handleChange(s, e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <button className="px-3 py-2 rounded-md bg-primary text-on-primary" onClick={() => handleSave(s)}>Save</button>
            <button className="px-3 py-2 rounded-md bg-surface text-on-surface" onClick={() => handleClear(s)}>Clear</button>
          </div>
        </div>
      ))}

      {subjects.length > 0 && (
        <div className="pt-2 flex items-center justify-between">
          <div className="text-sm text-on-surface-variant">Links saved locally to your browser.</div>
          <div className="flex items-center gap-2">
              <button
                className="px-4 py-2 rounded-full bg-surface text-on-surface"
                onClick={() => {
                  setLinks({});
                  localStorage.removeItem(CANVAS_LINKS_KEY);
                  try { window.dispatchEvent(new CustomEvent('synchron:canvas-links-updated', { detail: { subject: 'all' } })) } catch (e) {}
                  try { toast({ title: 'Cleared all Canvas links' }) } catch (e) {}
                }}
              >Clear All</button>
            <button className="px-4 py-2 rounded-full bg-primary text-on-primary" onClick={() => handleSave()}>Save All</button>
          </div>
        </div>
      )}

      {saved && (
        <div className="text-sm text-primary">Saved {saved === 'all' ? 'all links' : saved}</div>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"appearance" | "integrations" | "feedback">("appearance")
  const [appearanceTabClicks, setAppearanceTabClicks] = useState(0)
  const [showFontSelector, setShowFontSelector] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const router = useRouter()
  const { colorTheme, setColorTheme, fontTheme, setFontTheme } = useUserSettings()
  // Instead of calling `useTimetable` directly (which may throw if provider missing),
  // read/write localStorage and notify provider via custom event so the provider
  // can pick up changes when possible.
  const [aggressiveLocal, setAggressiveLocal] = useState<boolean>(() => {
    try { const raw = localStorage.getItem('synchron-aggressive-refresh'); return raw === 'false' ? false : true } catch (e) { return true }
  })

  useEffect(() => {
    try { localStorage.setItem('synchron-aggressive-refresh', aggressiveLocal ? 'true' : 'false') } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('synchron:aggressive-refresh-changed', { detail: { value: aggressiveLocal } })) } catch (e) {}
  }, [aggressiveLocal])

  // Navigation tabs are not user-configurable in this build.

  // Load saved preference on mount and reset font easter egg
  useEffect(() => {
    trackSectionUsage("settings")

    // Reset font easter egg on page load - don't persist it
    setShowFontSelector(false)
    setAppearanceTabClicks(0)
  }, [])

  // Detect small/mobile screens (Tailwind `sm` breakpoint = 640px)
  useEffect(() => {
    function check() {
      try {
        setIsMobile(typeof window !== 'undefined' ? window.innerWidth < 640 : false)
      } catch (e) {
        setIsMobile(false)
      }
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const handleColorThemeChange = (theme: ColorTheme) => {
    setColorTheme(theme)
    router.refresh()
  }

  const handleFontThemeChange = (theme: FontTheme) => {
    setFontTheme(theme)
  }

  // Feedback is submitted via the embedded Google Form; no client-side handler required.

  // Appearance tab easter egg handler
  const handleAppearanceTabClick = () => {
    // If we're already on appearance tab, count clicks
    if (activeTab === "appearance") {
      setAppearanceTabClicks((prev) => {
        const newCount = prev + 1
        if (newCount >= 7) {
          setShowFontSelector(true)
          return 0
        }
        return newCount
      })
    } else {
      setActiveTab("appearance")
    }
  }

  useEffect(() => {
    if (appearanceTabClicks > 0 && appearanceTabClicks < 7) {
      const timer = setTimeout(() => {
        setAppearanceTabClicks(0)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [appearanceTabClicks])

  const colorThemes = [
    { id: "blue" as ColorTheme, label: "Blue", color: "bg-blue-600" },
    { id: "purple" as ColorTheme, label: "Purple", color: "bg-purple-600" },
    { id: "green" as ColorTheme, label: "Green", color: "bg-green-600" },
    { id: "red" as ColorTheme, label: "Red", color: "bg-red-600" },
    { id: "orange" as ColorTheme, label: "Orange", color: "bg-orange-600" },
  ]

  const fontThemes = [
    { id: "default" as FontTheme, label: "Default", description: "Clean & Modern" },
    { id: "minecraft" as FontTheme, label: "VT323", description: "Retro Gaming Style", emoji: "🎮" },
    { id: "comic" as FontTheme, label: "Comic Sans", description: "Fun & Casual", emoji: "😄" },
    { id: "impact" as FontTheme, label: "Impact", description: "Bold & Strong", emoji: "💪" },
    { id: "papyrus" as FontTheme, label: "Papyrus", description: "Ancient & Mystical", emoji: "🏺" },
    { id: "courier" as FontTheme, label: "Courier", description: "Typewriter Style", emoji: "⌨️" },
    { id: "times" as FontTheme, label: "Times", description: "Classic & Elegant", emoji: "📰" },
  ]

  return (
    <PageTransition>
      <div className="container max-w-lg mx-auto px-4 py-6 pb-24">
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="hidden md:flex text-on-surface-variant hover:text-on-surface transition-colors">
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-2xl font-bold text-on-surface md:text-center md:flex-1">Settings</h1>
          <div className="w-6 hidden md:block"></div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6 bg-surface-container-high rounded-full p-1 h-auto">
              <TabsTrigger 
                value="appearance" 
                className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-on-primary py-2 relative"
                onClick={handleAppearanceTabClick}
              >
                Appearance
                {appearanceTabClicks > 0 && appearanceTabClicks < 7 && (
                  <span className="absolute -top-1 -right-1 text-xs animate-bounce">
                    {"🎨".repeat(Math.min(appearanceTabClicks, 3))}
                  </span>
                )}
              </TabsTrigger>
              {/* Hide Integrations tab on small/mobile screens */}
              {!isMobile && (
                <TabsTrigger 
                  value="integrations" 
                  className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-on-primary py-2"
                >
                  Integrations
                </TabsTrigger>
              )}
              <TabsTrigger 
                value="feedback" 
                className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-on-primary py-2"
              >
                Feedback
              </TabsTrigger>
            </TabsList>

          {/* General tab removed - navigation settings moved into Appearance tab */}

          <TabsContent value="appearance" className="space-y-6 mt-0">
            <Card className="bg-surface-container rounded-m3-xl border-none shadow-elevation-1">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-on-surface">Theme Mode</CardTitle>
                <CardDescription className="text-on-surface-variant">Switch between Light and Dark</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-on-surface-variant">Appearance</div>
                  <ThemeToggle />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-surface-container rounded-m3-xl border-none shadow-elevation-1">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-on-surface">Background Refresh</CardTitle>
                <CardDescription className="text-on-surface-variant">Control how aggressively the app polls for timetable updates. Aggressive is on by default.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-on-surface-variant">Aggressive background refresh</div>
                  <div className="flex items-center gap-3">
                    <Switch checked={Boolean(aggressiveLocal)} onCheckedChange={(v) => { try { setAggressiveLocal(Boolean(v)) } catch (e) {} }} />
                  </div>
                </div>
                <p className="mt-2 text-xs text-on-surface-variant">When enabled, the app will poll more frequently while visible and immediately refresh when you return to the tab. This may increase network usage.</p>
              </CardContent>
            </Card>

            {/* Navigation Tabs control removed - navigation is fixed in this build */}

            <Card className="bg-surface-container rounded-m3-xl border-none shadow-elevation-1">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-on-surface">Color Theme</CardTitle>
                <CardDescription className="text-on-surface-variant">
                  Choose the accent color for the app
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-3">
                  {colorThemes.map((theme) => (
                    <div
                      key={theme.id}
                      className={`flex flex-col items-center cursor-pointer group`}
                      onClick={() => handleColorThemeChange(theme.id)}
                    >
                      <div
                        className={`w-12 h-12 rounded-full ${theme.color} mb-2 flex items-center justify-center transition-all duration-200 ${
                          colorTheme === theme.id 
                            ? "ring-4 ring-surface ring-offset-2 ring-offset-primary scale-110" 
                            : "group-hover:scale-105 opacity-80 group-hover:opacity-100"
                        }`}
                      >
                        {colorTheme === theme.id && (
                          <div className="w-3 h-3 bg-white rounded-full" />
                        )}
                      </div>
                      <span className={`text-xs font-medium ${colorTheme === theme.id ? 'text-primary' : 'text-on-surface-variant'}`}>
                        {theme.label}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Font Theme Section - Hidden until easter egg is discovered */}
            {showFontSelector && (
              <Card className="bg-surface-container rounded-m3-xl border-none shadow-elevation-1 animate-in fade-in slide-in-from-bottom-4">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Type className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg font-semibold text-on-surface">Font Style</CardTitle>
                    <Badge variant="secondary" className="bg-tertiary-container text-on-tertiary-container hover:bg-tertiary-container">
                      Easter Egg!
                    </Badge>
                  </div>
                  <CardDescription className="text-on-surface-variant">
                    Choose your favorite font style
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {fontThemes.map((theme) => (
                    <div
                      key={theme.id}
                      className={`flex items-center p-3 rounded-xl cursor-pointer transition-all duration-200 border ${
                        fontTheme === theme.id
                          ? "bg-primary/10 border-primary/20"
                          : "bg-surface-container-high/50 border-transparent hover:bg-surface-container-highest"
                      }`}
                      onClick={() => handleFontThemeChange(theme.id)}
                    >
                      <div className="mr-4 text-2xl bg-surface-container-highest p-2 rounded-full w-12 h-12 flex items-center justify-center">
                        {theme.emoji || "Aa"}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className={`font-medium ${fontTheme === theme.id ? 'text-primary' : 'text-on-surface'}`}>
                            {theme.label}
                          </span>
                          {fontTheme === theme.id && (
                            <div className="w-2 h-2 rounded-full bg-primary" />
                          )}
                        </div>
                        <p className="text-sm text-on-surface-variant">{theme.description}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Easter egg progress indicator */}
            {appearanceTabClicks >= 3 && appearanceTabClicks < 7 && !showFontSelector && (
              <Card className="bg-surface-container rounded-m3-xl border-none shadow-elevation-1">
                <CardContent className="p-6 text-center">
                  <p className="text-sm text-primary animate-pulse mb-3 font-medium">
                    Keep clicking Appearance... {7 - appearanceTabClicks} more!
                  </p>
                  <div className="flex justify-center gap-1">
                    {Array.from({ length: 7 }, (_, i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${
                          i < appearanceTabClicks ? "bg-primary scale-110" : "bg-surface-container-highest"
                        }`}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          

          <TabsContent value="feedback" className="space-y-6 mt-0">
            <Card className="bg-surface-container rounded-m3-xl border-none shadow-elevation-1">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-on-surface">Send Feedback</CardTitle>
                <CardDescription className="text-on-surface-variant">
                  Please use the form below to submit feedback about the app.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="w-full h-[600px] max-h-[75vh]">
                  <iframe
                    title="Synchron Feedback Form"
                    src="https://docs.google.com/forms/d/e/1FAIpQLSfAS4FVqpjbWbzFDS5FShU6eKTrgXNARhZvz8r6PALqOQb6zQ/viewform?embedded=true"
                    className="w-full h-full border-0 rounded-xl"
                    frameBorder={0}
                    marginHeight={0}
                    marginWidth={0}
                    allowFullScreen
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Integrations content hidden on mobile */}
          {!isMobile && (
            <TabsContent value="integrations" className="space-y-4 mt-0">
            <Card className="bg-surface-container rounded-m3-xl border-none shadow-elevation-1">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-on-surface">Canvas Links</CardTitle>
                <CardDescription className="text-on-surface-variant">
                  Provide the Canvas (LMS) URL for each subject so the timetable links open the correct class page.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-on-surface-variant">Links are stored locally in your browser.</p>
                <CanvasLinksEditor />
              </CardContent>
            </Card>
            </TabsContent>
          )}
            {/* Install App action shown in Settings only */}
            <div>
              <InstallAppButton />
            </div>
        </Tabs>

        {/* Easter Egg Area - Link to new page */}
        <div className="mt-8 pt-6 border-t border-outline-variant">
          <div className="text-center">
              <Link
              href="/easter-egg"
              className="text-xs text-on-surface-variant/50 hover:text-primary transition-all duration-200 px-3 py-2 rounded-md hover:bg-surface-container-high focus:outline-none select-none"
            >
              Synchron v3.0.1
            </Link>
          </div>
        </div>
      </div>
    </PageTransition>
  )
}

