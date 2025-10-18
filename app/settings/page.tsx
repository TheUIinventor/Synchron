"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Send, Type, Home, ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Calendar, Bell, Clipboard, Award } from "lucide-react"
import { useRouter } from "next/navigation"
import { useUserSettings, type ColorTheme, type FontTheme } from "@/components/theme-provider"
import { Textarea } from "@/components/ui/textarea"
import type { NavItem } from "@/components/bottom-nav"
import { trackSectionUsage } from "@/utils/usage-tracker"
import PageTransition from "@/components/page-transition"

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"general" | "appearance" | "feedback">("general")
  const [feedbackText, setFeedbackText] = useState("")
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  const [appearanceTabClicks, setAppearanceTabClicks] = useState(0)
  const [showFontSelector, setShowFontSelector] = useState(false)
  const router = useRouter()
  const { navigationTabs, setNavigationTabs, colorTheme, setColorTheme, fontTheme, setFontTheme } = useUserSettings()

  // Available navigation tabs
  const availableTabs = [
    { id: "home" as NavItem, label: "Home", icon: <Home className="h-4 w-4" />, required: true },
    { id: "timetable" as NavItem, label: "My Synchron", icon: <Calendar className="h-4 w-4" /> },
    { id: "notices" as NavItem, label: "Daily Notices", icon: <Bell className="h-4 w-4" /> },
    { id: "clipboard" as NavItem, label: "Clipboard", icon: <Clipboard className="h-4 w-4" /> },
    { id: "awards" as NavItem, label: "Award Points", icon: <Award className="h-4 w-4" /> },
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
    setActiveTab("appearance")
    setAppearanceTabClicks((prev) => {
      const newCount = prev + 1
      if (newCount >= 7) {
        setShowFontSelector(true)
        return 0
      }
      return newCount
    })
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
      <div className="container max-w-lg mx-auto px-4 py-6">
  <div className="flex items-center justify-between mb-4 md:mb-6 px-4 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 w-full">
          <Link href="/" className="hidden md:flex text-gray-500 dark:text-gray-400">
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-lg font-bold text-left md:text-center md:flex-1">Settings</h1>
          <div className="w-6"></div>
        </div>

        {/* Tab Navigation */}
        <div className="flex mb-6 glass-card p-1 rounded-full">
          <button
            className={`flex-1 py-2 text-sm rounded-full transition-all ${
              activeTab === "general" ? "glass-button liquid-gradient text-white shadow-lg" : ""
            }`}
            onClick={() => setActiveTab("general")}
          >
            General
          </button>
          <button
            className={`flex-1 py-2 text-sm rounded-full transition-all relative ${
              activeTab === "appearance" ? "glass-button liquid-gradient text-white shadow-lg" : ""
            }`}
            onClick={handleAppearanceTabClick}
          >
            Appearance
            {appearanceTabClicks > 0 && appearanceTabClicks < 7 && (
              <span className="absolute -top-1 -right-1 text-xs">{"🎨".repeat(Math.min(appearanceTabClicks, 3))}</span>
            )}
          </button>
          <button
            className={`flex-1 py-2 text-sm rounded-full transition-all ${
              activeTab === "feedback" ? "glass-button liquid-gradient text-white shadow-lg" : ""
            }`}
            onClick={() => setActiveTab("feedback")}
          >
            Feedback
          </button>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === "general" && (
            <Card className="card-optimized-main">
              <CardContent className="p-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Navigation Tabs</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Customize which tabs appear in your bottom navigation (2-5 tabs)
                  </p>

                  <div className="space-y-3">
                    {availableTabs.map((tab) => {
                      const isVisible = navigationTabs.includes(tab.id)
                      const isRequired = tab.required
                      const canRemove = navigationTabs.length > 2 && !isRequired
                      const canAdd = navigationTabs.length < 5

                      return (
                        <div
                          key={tab.id}
                          className={`flex items-center justify-between p-4 rounded-xl transition-all duration-200 glass-card ${
                            isVisible
                              ? "liquid-gradient text-white shadow-lg"
                              : "hover:bg-white/10 dark:hover:bg-white/5"
                          }`}
                        >
                          <div className="flex items-center">
                            <div className="mr-3 glass-icon-enhanced rounded-full p-2">{tab.icon}</div>
                            <div>
                              <span className="font-medium">{tab.label}</span>
                              {isRequired && (
                                <span className="ml-2 text-xs bg-white/20 px-2 py-0.5 rounded-full">Required</span>
                              )}
                            </div>
                          </div>

                          <button
                            onClick={() => handleTabToggle(tab.id)}
                            disabled={isRequired || (isVisible && !canRemove) || (!isVisible && !canAdd)}
                            className={`w-12 h-6 rounded-full transition-all duration-200 ${
                              isVisible ? "bg-white/30 shadow-inner" : "bg-gray-300 dark:bg-gray-600"
                            } ${
                              isRequired || (isVisible && !canRemove) || (!isVisible && !canAdd)
                                ? "opacity-50 cursor-not-allowed"
                                : "cursor-pointer hover:opacity-80"
                            }`}
                          >
                            <div
                              className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                                isVisible ? "translate-x-7" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </div>
                      )
                    })}
                  </div>

                  <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 text-center">
                    {navigationTabs.length}/5 tabs selected • Home is always required
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "appearance" && (
            <div className="space-y-6">
              <Card className="card-optimized-main">
                <CardContent className="p-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Color Theme</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Choose the accent color for the app</p>

                    <div className="grid grid-cols-5 gap-3">
                      {colorThemes.map((theme) => (
                        <div
                          key={theme.id}
                          className={`flex flex-col items-center cursor-pointer p-3 rounded-lg glass-card hover-scale ${
                            colorTheme === theme.id ? "liquid-gradient shadow-lg" : ""
                          }`}
                          onClick={() => handleColorThemeChange(theme.id)}
                        >
                          <div
                            className={`w-10 h-10 rounded-full ${theme.color} mb-2 glass-icon-enhanced ${
                              colorTheme === theme.id ? "ring-2 ring-white ring-offset-2" : ""
                            }`}
                          ></div>
                          <span className="text-sm font-medium">{theme.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Font Theme Section - Hidden until easter egg is discovered */}
              {showFontSelector && (
                <Card className="card-optimized-main">
                  <CardContent className="p-6">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Type className="h-5 w-5 text-theme-primary" />
                        <h3 className="text-lg font-semibold">Font Style</h3>
                        <span className="text-xs bg-theme-secondary text-theme-primary px-2 py-0.5 rounded-full">
                          Easter Egg!
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Choose your favorite font style</p>

                      <div className="space-y-3">
                        {fontThemes.map((theme) => (
                          <div
                            key={theme.id}
                            className={`flex items-center p-4 rounded-xl cursor-pointer transition-all duration-200 glass-card hover-scale ${
                              fontTheme === theme.id
                                ? "liquid-gradient text-white shadow-lg"
                                : "hover:bg-white/10 dark:hover:bg-white/5"
                            }`}
                            onClick={() => handleFontThemeChange(theme.id)}
                          >
                            <div className="mr-3 glass-icon-enhanced rounded-full p-2 text-lg">
                              {theme.emoji || "Aa"}
                            </div>
                            <div className="flex-1">
                              <span className="font-medium">{theme.label}</span>
                              <p className="text-sm opacity-75">{theme.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Easter egg progress indicator */}
              {appearanceTabClicks >= 3 && appearanceTabClicks < 7 && !showFontSelector && (
                <Card className="card-optimized-main">
                  <CardContent className="p-6 text-center">
                    <p className="text-sm text-theme-primary animate-pulse mb-3">
                      Keep clicking Appearance... {7 - appearanceTabClicks} more!
                    </p>
                    <div className="flex justify-center gap-1">
                      {Array.from({ length: 7 }, (_, i) => (
                        <div
                          key={i}
                          className={`w-2 h-2 rounded-full ${
                            i < appearanceTabClicks ? "bg-theme-primary" : "bg-gray-300 dark:bg-gray-600"
                          }`}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {activeTab === "feedback" && (
            <Card className="card-optimized-main">
              <CardContent className="p-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Send Feedback</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Let us know how we can improve the app
                  </p>

                  <Textarea
                    placeholder="Type your feedback here..."
                    className="min-h-[120px] mb-4 glass-card border-0"
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                  />

                  <Button
                    className="w-full one-ui-button"
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
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Easter Egg Area - Link to new page */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <Link
              href="/easter-egg"
              className="text-xs text-gray-400 dark:text-gray-500 transition-all duration-200 px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-400 focus:outline-none select-none"
            >
              Synchron v2.1.1
            </Link>
          </div>
        </div>
      </div>
    </PageTransition>
  )
}
