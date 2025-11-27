"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Send, Type, Home, ChevronLeft, Calendar, Bell, Clipboard, Award } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { useUserSettings, type ColorTheme, type FontTheme } from "@/components/theme-provider"
import { useTimetable } from "@/contexts/timetable-context"
import { useToast } from "@/hooks/use-toast"
import { Textarea } from "@/components/ui/textarea"
import type { NavItem } from "@/components/bottom-nav"
import { trackSectionUsage } from "@/utils/usage-tracker"
import PageTransition from "@/components/page-transition"

const CANVAS_LINKS_KEY = "synchron-canvas-links"

function CanvasLinksEditor() {
  const { timetableData } = useTimetable()
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
        .map((p: any) => p.subject)
        .filter((s: string) => !!s && s.toLowerCase() !== "break")
    )
  ).sort()

  function handleChange(subject: string, value: string) {
    setLinks((prev) => ({ ...prev, [subject]: value }))
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
        ? { ...currentStored, [subject]: normalize(links[subject] ?? "") }
        : Object.fromEntries(Object.entries(links).map(([k, v]) => [k, normalize(v as string)]))
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
      delete raw[subject]
      localStorage.setItem(CANVAS_LINKS_KEY, JSON.stringify(raw))
      setLinks((prev) => {
        const copy = { ...prev }
        delete copy[subject]
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
  const [activeTab, setActiveTab] = useState<"general" | "appearance" | "feedback" | "integrations">("general")
  const [feedbackText, setFeedbackText] = useState("")
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  const [appearanceTabClicks, setAppearanceTabClicks] = useState(0)
  const [showFontSelector, setShowFontSelector] = useState(false)
  const router = useRouter()
  const { navigationTabs, setNavigationTabs, colorTheme, setColorTheme, fontTheme, setFontTheme } = useUserSettings()

  // Available navigation tabs
  const availableTabs = [
    { id: "home" as NavItem, label: "Home", icon: <Home className="h-5 w-5" />, required: true },
    { id: "timetable" as NavItem, label: "My Synchron", icon: <Calendar className="h-5 w-5" /> },
    { id: "notices" as NavItem, label: "Daily Notices", icon: <Bell className="h-5 w-5" /> },
    { id: "clipboard" as NavItem, label: "Clipboard", icon: <Clipboard className="h-5 w-5" /> },
    { id: "awards" as NavItem, label: "Award Points", icon: <Award className="h-5 w-5" /> },
  ]

  const handleTabToggle = (tabId: NavItem) => {
    if (tabId === "home") return // Home is required

    const isCurrentlyVisible = navigationTabs.includes(tabId)
    if (isCurrentlyVisible) {
      // Remove tab (but keep at least 2 tabs including home)
      if (navigationTabs.length > 2) {
        setNavigationTabs(navigationTabs.filter((tab) => tab !== tabId))
      }
    } else {
      // Add tab (but keep max 5 tabs)
      if (navigationTabs.length < 5) {
        setNavigationTabs([...navigationTabs, tabId])
      }
    }
  }

  // Load saved preference on mount and reset font easter egg
  useEffect(() => {
    trackSectionUsage("settings" as NavItem)

    // Reset font easter egg on page load - don't persist it
    setShowFontSelector(false)
    setAppearanceTabClicks(0)
  }, [])

  const handleColorThemeChange = (theme: ColorTheme) => {
    setColorTheme(theme)
    router.refresh()
  }

  const handleFontThemeChange = (theme: FontTheme) => {
    setFontTheme(theme)
  }

  const handleFeedbackSubmit = () => {
    console.log("Feedback submitted:", feedbackText)
    setFeedbackSubmitted(true)
    setFeedbackText("")

    setTimeout(() => {
      setFeedbackSubmitted(false)
    }, 3000)
  }

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
          <TabsList className="grid w-full grid-cols-4 mb-6 bg-surface-container-high rounded-full p-1 h-auto">
            <TabsTrigger 
              value="general" 
              className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-on-primary py-2"
            >
              General
            </TabsTrigger>
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
            <TabsTrigger 
              value="feedback" 
              className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-on-primary py-2"
            >
              Feedback
            </TabsTrigger>
            <TabsTrigger 
              value="integrations" 
              className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-on-primary py-2"
            >
              Integrations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6 mt-0">
            <Card className="bg-surface-container rounded-m3-xl border-none shadow-elevation-1">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-on-surface">Navigation Tabs</CardTitle>
                <CardDescription className="text-on-surface-variant">
                  Customize which tabs appear in your bottom navigation (2-5 tabs)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {availableTabs.map((tab) => {
                  const isVisible = navigationTabs.includes(tab.id)
                  const isRequired = tab.required
                  const canRemove = navigationTabs.length > 2 && !isRequired
                  const canAdd = navigationTabs.length < 5

                  return (
                    <div
                      key={tab.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-surface-container-high/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${isVisible ? 'bg-primary/10 text-primary' : 'bg-surface-variant text-on-surface-variant'}`}>
                          {tab.icon}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-on-surface">{tab.label}</span>
                          {isRequired && (
                            <span className="text-xs text-primary font-medium">Required</span>
                          )}
                        </div>
                      </div>

                      <Switch
                        checked={isVisible}
                        onCheckedChange={() => handleTabToggle(tab.id)}
                        disabled={isRequired || (isVisible && !canRemove) || (!isVisible && !canAdd)}
                      />
                    </div>
                  )
                })}

                <div className="pt-2 text-xs text-center text-on-surface-variant">
                  {navigationTabs.length}/5 tabs selected • Home is always required
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-6 mt-0">
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
                  Let us know how we can improve the app
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Type your feedback here..."
                  className="min-h-[120px] bg-surface-container-high border-none focus-visible:ring-primary resize-none rounded-xl"
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                />

                <Button
                  className="w-full rounded-full"
                  onClick={handleFeedbackSubmit}
                  disabled={!feedbackText.trim() || feedbackSubmitted}
                >
                  {feedbackSubmitted ? (
                    "Thank you!"
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Feedback
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

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
        </Tabs>

        {/* Easter Egg Area - Link to new page */}
        <div className="mt-8 pt-6 border-t border-outline-variant">
          <div className="text-center">
            <Link
              href="/easter-egg"
              className="text-xs text-on-surface-variant/50 hover:text-primary transition-all duration-200 px-3 py-2 rounded-md hover:bg-surface-container-high focus:outline-none select-none"
            >
              Synchron v2.1.1
            </Link>
          </div>
        </div>
      </div>
    </PageTransition>
  )
}

