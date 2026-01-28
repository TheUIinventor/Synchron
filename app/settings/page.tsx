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
import { getSubjectColorOverride, setSubjectColorOverride, resetSubjectColorOverride, resetAllSubjectColorOverrides, isPastelModeEnabled, loadPastelMode } from "@/utils/subject-color-override"
import { hexToInlineStyle } from "@/utils/color-utils"

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

function SubjectColorsEditor() {
  const timetableCtx = useTimetableSafe()
  const timetableData = timetableCtx?.timetableData || {}
  const { toast } = useToast()
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [pastelModes, setPastelModes] = useState<Record<string, boolean>>({})
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('synchron-subject-color-overrides')
      if (saved) setOverrides(JSON.parse(saved))
      const modes = loadPastelMode()
      setPastelModes(modes)
    } catch (e) {}
  }, [])

  useEffect(() => {
    const handler = () => {
      try {
        const saved = localStorage.getItem('synchron-subject-color-overrides')
        if (saved) setOverrides(JSON.parse(saved))
        const modes = loadPastelMode()
        setPastelModes(modes)
      } catch (e) {}
    }
    window.addEventListener('synchron:subject-colors-updated', handler)
    return () => window.removeEventListener('synchron:subject-colors-updated', handler)
  }, [])

  const subjects = Array.from(
    new Set(
      Object.values(timetableData || {})
        .flat()
        .map((p: any) => (p.subject ?? "").trim())
        .filter((s: string) => !!s && s.toLowerCase() !== "break")
    )
  ).sort()

  function handleColorChange(subject: string, hex: string) {
    const usePastel = pastelModes[subject] !== false // Default true
    setSubjectColorOverride(subject, hex, usePastel)
    setOverrides((prev) => ({ ...prev, [subject]: hex.replace(/^#/, '') }))
    try { toast({ title: `Colour updated for ${subject}` }) } catch (e) {}
  }

  function handlePastelModeChange(subject: string, usePastel: boolean) {
    setPastelModes((prev) => ({ ...prev, [subject]: usePastel }))
    const hex = overrides[subject]
    if (hex) {
      setSubjectColorOverride(subject, `#${hex}`, usePastel)
    }
    try { 
      const modeLabel = usePastel ? 'pastel' : 'raw'
      toast({ title: `${subject} set to ${modeLabel} mode` }) 
    } catch (e) {}
  }

  function handleReset(subject: string) {
    resetSubjectColorOverride(subject)
    setOverrides((prev) => {
      const copy = { ...prev }
      delete copy[subject]
      return copy
    })
    try { toast({ title: `Colour reset for ${subject}` }) } catch (e) {}
  }

  function handleResetAll() {
    resetAllSubjectColorOverrides()
    setOverrides({})
    try { toast({ title: 'All subject colours reset to defaults' }) } catch (e) {}
  }

  if (subjects.length === 0) {
    return <p className="text-sm text-on-surface-variant">No subjects found in timetable yet.</p>
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900 p-4 mb-4">
        <p className="text-sm text-blue-900 dark:text-blue-100">
          <strong>💡 Tip:</strong> Pastel mode softens colours for readability (default). Raw mode uses your exact colour choice.
        </p>
      </div>

      <div className="space-y-2">
        {subjects.map((subject) => {
          const override = overrides[subject]
          const hasOverride = !!override
          const displayColor = override ? `#${override}` : undefined
          const usePastel = pastelModes[subject] !== false // Default true

          // Get the raw colour for the bar
          const rawColour = override || undefined

          return (
            <div key={subject} className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-high group hover:bg-surface-container-highest transition-colors">
              {/* Exact timetable card layout preview */}
              <div className="flex-1 flex items-center gap-2 min-w-0">
                {/* Colour bar - shows raw colour */}
                {rawColour && (
                  <div 
                    className="w-1 min-w-[4px] rounded-lg h-12" 
                    style={{ backgroundColor: `#${rawColour}` }} 
                  />
                )}
                
                {/* Subject badge with squircle style */}
                <div
                  className="rounded-md px-3 py-1.5 text-sm font-semibold flex-shrink-0 text-center min-h-[40px] flex items-center justify-center"
                  style={displayColor ? hexToInlineStyle(displayColor, usePastel) : { backgroundColor: 'var(--md-sys-color-surface-variant)', color: 'var(--md-sys-color-on-surface-variant)' }}
                >
                  {subject}
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Colour picker input */}
                <input
                  type="color"
                  value={displayColor || '#ffffff'}
                  onChange={(e) => handleColorChange(subject, e.target.value)}
                  className="w-9 h-9 rounded-md cursor-pointer border border-outline"
                  title={`Pick colour for ${subject}`}
                />

                {/* Reset button - only show if override exists */}
                {hasOverride && (
                  <button
                    onClick={() => handleReset(subject)}
                    className="px-2 py-1 text-xs rounded-md bg-surface text-on-surface hover:bg-surface-variant transition-colors"
                    title={`Reset ${subject} to default colour`}
                  >
                    Reset
                  </button>
                )}

                {/* Pastel mode toggle - only show if override exists */}
                {hasOverride && (
                  <label className="flex items-center gap-1.5 cursor-pointer bg-surface/50 rounded-md px-2 py-1.5" title="Toggle pastel vs raw colour mode">
                    <input
                      type="checkbox"
                      checked={usePastel}
                      onChange={(e) => handlePastelModeChange(subject, e.target.checked)}
                      className="w-3 h-3 rounded border-outline cursor-pointer"
                    />
                    <span className="text-xs text-on-surface-variant">
                      {usePastel ? 'Pastel' : 'Raw'}
                    </span>
                  </label>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {Object.keys(overrides).length > 0 && (
        <div className="pt-3 flex justify-end">
          <button
            onClick={handleResetAll}
            className="px-4 py-2 rounded-full bg-surface text-on-surface hover:bg-surface-variant transition-colors"
          >
            Reset All Colours
          </button>
        </div>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"appearance" | "integrations" | "feedback" | "devtools">("appearance")
  const [appearanceTabClicks, setAppearanceTabClicks] = useState(0)
  const [showFontSelector, setShowFontSelector] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const router = useRouter()
  const { colorTheme, setColorTheme, fontTheme, setFontTheme } = useUserSettings()
  // Instead of calling `useTimetable` directly (which may throw if provider missing),
  // read/write localStorage and notify provider via custom event so the provider
  // can pick up changes when possible.
  const [aggressiveLocal, setAggressiveLocal] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem('synchron-aggressive-refresh')
      const devtoolsRaw = localStorage.getItem('synchron-devtools-enabled')
      // When Devtools are enabled and the user has not explicitly set a preference,
      // default aggressive refresh to OFF to avoid noisy polling during development.
      if (raw === null && devtoolsRaw === 'true') return false
      return raw === 'false' ? false : true
    } catch (e) { return true }
  })
  const [devtoolsEnabled, setDevtoolsEnabled] = useState<boolean>(() => {
    try { const raw = localStorage.getItem('synchron-devtools-enabled'); return raw === 'true' } catch (e) { return false }
  })

  useEffect(() => {
    try { localStorage.setItem('synchron-aggressive-refresh', aggressiveLocal ? 'true' : 'false') } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('synchron:aggressive-refresh-changed', { detail: { value: aggressiveLocal } })) } catch (e) {}
  }, [aggressiveLocal])

  useEffect(() => {
    try { localStorage.setItem('synchron-devtools-enabled', devtoolsEnabled ? 'true' : 'false') } catch (e) {}
  }, [devtoolsEnabled])

  // If Devtools are enabled *after* mount and the user has not explicitly
  // set a preference for aggressive refresh, default it to OFF to avoid
  // noisy background polling during development sessions.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('synchron-aggressive-refresh')
      if (devtoolsEnabled && raw === null) {
        setAggressiveLocal(false)
      }
    } catch (e) {}
  }, [devtoolsEnabled])

  // Navigation tabs are not user-configurable in this build.

  // Load saved preference on mount and reset font easter egg
  useEffect(() => {
    trackSectionUsage("settings")

    // Reset font easter egg on page load - don't persist it
    setShowFontSelector(false)
    setAppearanceTabClicks(0)
  }, [])

  // Detect small screens: hide Integrations on non-medium+ devices
  // Tailwind `md` breakpoint = 768px
  useEffect(() => {
    function check() {
      try {
        setIsMobile(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
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
      <div className="container max-w-2xl mx-auto px-4 py-6 pb-24">
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="hidden md:flex text-on-surface-variant hover:text-on-surface transition-colors">
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-2xl font-bold text-on-surface md:text-center md:flex-1">Settings</h1>
          <div className="w-6 hidden md:block"></div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6 bg-surface-container-high rounded-full p-1 h-auto">
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
              <TabsTrigger 
                value="devtools" 
                className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-on-primary py-2"
              >
                Devtools
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

            {/* Background Refresh moved to Devtools tab */}

            {/* Navigation Tabs control removed - navigation is fixed in this build */}

            <Card className="bg-surface-container rounded-m3-xl border-none shadow-elevation-1">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-on-surface">Colour Theme</CardTitle>
                <CardDescription className="text-on-surface-variant">
                  Choose the accent colour for the app
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

            <Card className="bg-surface-container rounded-m3-xl border-none shadow-elevation-1">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-on-surface">Subject Colours</CardTitle>
                <CardDescription className="text-on-surface-variant">
                  Customize colours for individual subjects. Overrides the default colour scheme.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <SubjectColorsEditor />
              </CardContent>
            </Card>
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

          <TabsContent value="devtools" className="space-y-6 mt-0">
            <Card className="bg-surface-container rounded-m3-xl border-none shadow-elevation-1">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-on-surface">Developer Tools</CardTitle>
                <CardDescription className="text-on-surface-variant">Enable or disable developer tools and debugging utilities</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-on-surface-variant">Enable Developer Tools</div>
                  <div className="flex items-center gap-3">
                    <Switch checked={devtoolsEnabled} onCheckedChange={(v) => { try { setDevtoolsEnabled(Boolean(v)) } catch (e) {} }} />
                  </div>
                </div>
                <p className="mt-2 text-xs text-on-surface-variant">When enabled, debugging tools and API exploration options will be available below.</p>
              </CardContent>
            </Card>

            {devtoolsEnabled ? (
              <>
                <Card className="bg-surface-container rounded-m3-xl border-none shadow-elevation-1">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-on-surface">Background Refresh</CardTitle>
                    <CardDescription className="text-on-surface-variant">Control how aggressively the app polls for timetable updates. When Devtools are enabled, aggressive refresh defaults to off.</CardDescription>
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

                <Card className="bg-surface-container rounded-m3-xl border-none shadow-elevation-1">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-on-surface">API Debug Tools</CardTitle>
                    <CardDescription className="text-on-surface-variant">Explore raw API responses from the calendar and timetable endpoints</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-on-surface-variant">Click any of these links to view raw API data and debug responses:</p>
                    <div className="grid grid-cols-1 gap-3">
                      <Link
                        href="/debug-timetable"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 rounded-md bg-primary text-on-primary hover:bg-primary/90 transition-colors text-sm font-medium text-center"
                      >
                        View Timetable API
                      </Link>
                      <Link
                        href="/debug-calendar"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 rounded-md bg-primary text-on-primary hover:bg-primary/90 transition-colors text-sm font-medium text-center"
                      >
                        View Calendar API
                      </Link>
                      <Link
                        href="/debug-subs"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 rounded-md bg-primary text-on-primary hover:bg-primary/90 transition-colors text-sm font-medium text-center"
                      >
                        View Substitutions API
                      </Link>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-surface-container rounded-m3-xl border-none shadow-elevation-1">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-on-surface">Variations Debug</CardTitle>
                    <CardDescription className="text-on-surface-variant">View stored timetable variations in localStorage</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-on-surface-variant">Inspect persisted class and room variations:</p>
                    <button
                      onClick={() => {
                        try {
                          const raw = localStorage.getItem('synchron-authoritative-variations')
                          const parsed = JSON.parse(raw || '{}')
                          const keys = Object.keys(parsed || {})
                          const sampleKey = keys[0]
                          const sample = sampleKey ? parsed[sampleKey] : null
                          alert(`Variations Debug\n\nDates with data: ${keys.length}\nSample date: ${sampleKey || 'None'}\n\n${JSON.stringify({ keys: keys.slice(0, 5), sampleKey, sample }, null, 2)}`)
                        } catch (e) {
                          alert(`Error: ${String(e)}`)
                        }
                      }}
                      className="w-full px-4 py-2 rounded-md border border-outline bg-surface-container-high text-on-surface hover:bg-surface-container-highest transition-colors text-sm font-medium"
                    >
                      View Stored Variations
                    </button>
                  </CardContent>
                </Card>

                <Card className="bg-red-50 dark:bg-red-950/20 rounded-m3-xl border border-red-200 dark:border-red-900 shadow-elevation-1">
                  <CardContent className="p-6">
                    <div className="flex gap-3">
                      <div className="text-2xl">⚠️</div>
                      <div>
                        <p className="font-semibold text-red-900 dark:text-red-100 mb-1">Warning</p>
                        <p className="text-sm text-red-800 dark:text-red-200">These tools are for debugging only. Modifying raw data may cause unexpected behaviour. Use at your own risk.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="py-12 text-center">
                <p className="text-on-surface-variant">Developer Tools are disabled. Enable them above to access debugging utilities.</p>
              </div>
            )}
          </TabsContent>
          
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

