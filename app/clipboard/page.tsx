"use client"

import { useEffect, useState, useRef } from "react"
import { trackSectionUsage } from "@/utils/usage-tracker"
import { useAuth } from "@/lib/api/hooks"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LogIn } from "lucide-react"

const features = [
  {
    title: "Canvas Integration",
    description: "Click classes to access Canvas directly—all your course materials in one tap.",
    demo: "canvas"
  },
  {
    title: "Dynamic Links",
    description: "Smart links that adapt to your courses. Your portal connections, seamlessly integrated.",
    demo: "dynamic"
  },
  {
    title: "Clipboard Integration",
    description: "Organize your calendar and tasks without leaving Synchron. SBHS Portal at your fingertips.",
    demo: "clipboard"
  },
  {
    title: "Daily Notices",
    description: "Personalized notifications for your year group and activities. Never miss important updates.",
    demo: "notices"
  },
  {
    title: "Modern Timetable",
    description: "Beautiful, intuitive schedule that shows real teachers, rooms, and instant substitutions.",
    demo: "timetable"
  },
  {
    title: "Expressive Design",
    description: "Thoughtful interface that's delightful to use. Dark mode, smooth animations, and more.",
    demo: "design"
  },
  {
    title: "Built to Last",
    description: "Fast, reliable, and constantly improving. Your school timetable app evolved.",
    demo: "lasting"
  }
]

// Mini Device Demo Component
const DeviceDemo = ({ type, progress }: { type: string; progress: number }) => {
  const animatedProgress = progress < 0.5 
    ? 2 * progress * progress 
    : 1 - Math.pow(-2 * progress + 2, 2) / 2

  if (type === "canvas") {
    return (
      <div className="relative w-full h-32 flex items-center justify-center">
        {/* Phone Frame */}
        <div className="relative w-20 h-32 bg-black rounded-2xl border-4 border-gray-800 shadow-lg overflow-hidden flex flex-col items-center justify-center p-1.5">
          <div className="w-full h-full bg-gradient-to-b from-primary/20 to-primary/5 flex flex-col items-center justify-center text-center gap-1">
            <div className="text-xs font-bold text-on-surface">Canvas</div>
            <div style={{ opacity: Math.max(0, 1 - animatedProgress) }} className="transition-opacity">
              <div className="text-[8px] text-on-surface-variant">ENG 101</div>
            </div>
            <div style={{ opacity: animatedProgress }} className="transition-opacity">
              <div className="text-[8px] text-primary font-bold">Opening...</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (type === "dynamic") {
    return (
      <div className="relative w-full h-32 flex items-center justify-center">
        {/* Tablet Frame */}
        <div className="relative w-24 h-28 bg-black rounded-xl border-2 border-gray-700 shadow-lg overflow-hidden flex flex-col p-2">
          <div className="w-full h-full bg-gradient-to-b from-blue-100 to-blue-50 flex flex-col gap-1">
            <div className="text-[9px] font-bold text-on-surface px-1">Links</div>
            <div className="flex gap-1 flex-wrap px-1">
              {["Canvas", "Portal", "Email"].map((link, i) => (
                <div
                  key={i}
                  className="text-[7px] px-1 py-0.5 rounded bg-primary/30 text-primary"
                  style={{
                    transform: `scaleX(${animatedProgress > i * 0.33 ? 1 : 0})`,
                    opacity: animatedProgress > i * 0.33 ? 1 : 0,
                    transition: "all 0.3s ease"
                  }}
                >
                  {link}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (type === "clipboard") {
    return (
      <div className="relative w-full h-32 flex items-center justify-center">
        {/* Phone Frame */}
        <div className="relative w-20 h-32 bg-black rounded-2xl border-4 border-gray-800 shadow-lg overflow-hidden flex flex-col p-1.5">
          <div className="w-full h-full bg-gradient-to-b from-purple-100 to-purple-50 flex flex-col items-center justify-center gap-1.5">
            <div className="text-[8px] font-bold text-on-surface">Clipboard</div>
            <div
              className="w-10 h-6 bg-white rounded border border-purple-200"
              style={{
                transform: `translateY(${animatedProgress * 20}px)`,
                opacity: 1 - animatedProgress * 0.3
              }}
            />
            <div className="text-[7px] text-on-surface-variant">Calendar</div>
          </div>
        </div>
      </div>
    )
  }

  if (type === "notices") {
    return (
      <div className="relative w-full h-32 flex items-center justify-center">
        {/* Phone Frame */}
        <div className="relative w-20 h-32 bg-black rounded-2xl border-4 border-gray-800 shadow-lg overflow-hidden flex flex-col p-1.5">
          <div className="w-full h-full bg-gradient-to-b from-yellow-100 to-yellow-50 flex flex-col items-center justify-center gap-1">
            <div className="text-[8px] font-bold text-on-surface">Notices</div>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-14 h-2 bg-yellow-200 rounded text-[7px]"
                style={{
                  opacity: animatedProgress > i * 0.33 ? 1 : 0.3,
                  transform: `scaleY(${animatedProgress > i * 0.33 ? 1 : 0.5})`,
                  transition: "all 0.3s ease"
                }}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (type === "timetable") {
    return (
      <div className="relative w-full h-32 flex items-center justify-center">
        {/* Laptop Frame */}
        <div className="relative">
          <div className="w-32 h-20 bg-black rounded-t-lg border-2 border-gray-800 overflow-hidden flex flex-col p-2 shadow-lg">
            <div className="w-full h-full bg-gradient-to-r from-teal-100 to-cyan-100 flex flex-col gap-1.5">
              <div className="text-[9px] font-bold text-on-surface">Schedule</div>
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="flex gap-1 items-center"
                  style={{
                    opacity: animatedProgress > i * 0.5 ? 1 : 0.4,
                    transform: `translateX(${animatedProgress > i * 0.5 ? 0 : -10}px)`,
                    transition: "all 0.4s ease"
                  }}
                >
                  <div className="w-1 h-3 bg-primary rounded-full" />
                  <div className="text-[7px] text-on-surface-variant flex-1">Class {i + 1}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="w-32 h-2 bg-gray-900 rounded-b-lg border-2 border-t-0 border-gray-800" />
        </div>
      </div>
    )
  }

  if (type === "design") {
    return (
      <div className="relative w-full h-32 flex items-center justify-center">
        {/* Phone Frame with theme animation */}
        <div className="relative w-20 h-32 bg-black rounded-2xl border-4 border-gray-800 shadow-lg overflow-hidden flex flex-col p-1.5">
          <div
            className="w-full h-full bg-gradient-to-b from-orange-100 to-orange-50 flex flex-col items-center justify-center gap-2 transition-all duration-700"
            style={{
              background: animatedProgress > 0.5 
                ? "linear-gradient(to bottom, rgb(17, 24, 39), rgb(31, 41, 55))" 
                : "linear-gradient(to bottom, rgb(254, 243, 224), rgb(254, 237, 213))"
            }}
          >
            <div className="text-[8px] font-bold" style={{ color: animatedProgress > 0.5 ? "#fff" : "#000" }}>
              Theme
            </div>
            <div className="w-3 h-3 rounded-full bg-primary" />
            <div className="text-[7px]" style={{ color: animatedProgress > 0.5 ? "#ccc" : "#666" }}>
              {animatedProgress > 0.5 ? "Dark" : "Light"}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (type === "lasting") {
    return (
      <div className="relative w-full h-32 flex items-center justify-center">
        {/* All devices together */}
        <div className="flex gap-2 items-end">
          {/* Phone */}
          <div className="relative w-12 h-20 bg-black rounded-xl border-2 border-gray-800 shadow-lg overflow-hidden">
            <div className="w-full h-full bg-gradient-to-b from-green-100 to-green-50" />
          </div>
          {/* Tablet */}
          <div className="relative w-16 h-20 bg-black rounded-lg border-2 border-gray-800 shadow-lg overflow-hidden">
            <div className="w-full h-full bg-gradient-to-b from-green-100 to-green-50" />
          </div>
          {/* Laptop */}
          <div className="relative">
            <div className="w-20 h-12 bg-black rounded-t-lg border-2 border-gray-800 overflow-hidden shadow-lg">
              <div className="w-full h-full bg-gradient-to-b from-green-100 to-green-50" />
            </div>
            <div className="w-20 h-1.5 bg-gray-900 rounded-b-lg border-2 border-t-0 border-gray-800" />
          </div>
        </div>
      </div>
    )
  }

  return null
}

export default function ClipboardPage() {
  const { isAuthenticated, loading } = useAuth()
  const [iframeKey, setIframeKey] = useState(0)
  const [currentFeatureIndex, setCurrentFeatureIndex] = useState(0)
  const [animationProgress, setAnimationProgress] = useState(0)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  useEffect(() => {
    // Track clipboard usage
    trackSectionUsage("clipboard")
  }, [])

  // Cycle through features every 4 seconds with smooth animation
  useEffect(() => {
    let animationFrame: number
    let startTime = Date.now()
    const cycleDuration = 4000 // 4 seconds per feature

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = (elapsed % cycleDuration) / cycleDuration

      setAnimationProgress(progress)

      // Switch feature when progress completes
      if (elapsed % cycleDuration < 16) { // Only update index once per cycle
        setCurrentFeatureIndex(Math.floor(elapsed / cycleDuration) % features.length)
      }

      animationFrame = requestAnimationFrame(animate)
    }

    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [])

  // Show helper immediately (user requested instant visibility)
  useEffect(() => {
    // Removed - popup no longer shown
  }, [iframeKey])

  useEffect(() => {
    // Create a style tag with responsive left offsets to match the sidebar widths
    const style = document.createElement("style")
    style.textContent = `
      .synchron-clipboard-iframe { position: fixed; top: 0; left: 0; margin: 0; padding: 0; border: 0; z-index: 0; width: 100vw; height: 100vh; }
      @media (min-width: 768px) { .synchron-clipboard-iframe { left: 5rem; width: calc(100vw - 5rem); } }
      @media (min-width: 1024px) { .synchron-clipboard-iframe { left: 6rem; width: calc(100vw - 6rem); } }
    `
    document.head.appendChild(style)

    const iframe = document.createElement("iframe")
    iframe.className = "synchron-clipboard-iframe"
    iframe.src = "https://portal.clipboard.app/sbhs/calendar"
    iframe.title = "Clipboard Calendar"
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    iframe.setAttribute("allowfullscreen", "")
    iframe.style.background = "transparent"
    iframe.setAttribute("data-key", String(iframeKey))
    iframeRef.current = iframe

    document.body.appendChild(iframe)

    return () => {
      try { iframe.remove() } catch (e) {}
      try { style.remove() } catch (e) {}
      iframeRef.current = null
    }
  }, [iframeKey])

  const handleRefresh = () => {
    setIframeKey((k) => k + 1)
  }

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Block access if not authenticated
  if (!isAuthenticated) {
    const currentFeature = features[currentFeatureIndex]

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
        <Card className="w-full max-w-2xl bg-card border border-border rounded-m3-xl shadow-elevation-1 overflow-hidden">
          <div className="flex flex-col md:flex-row h-96">
            {/* Left Side - Animated Device Demo */}
            <div className="flex-1 bg-gradient-to-br from-primary/10 to-primary/5 flex flex-col items-center justify-center p-8 relative overflow-hidden">
              {/* Animated background circles */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="absolute w-48 h-48 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
              </div>
              
              {/* Device Demo Animation */}
              <div className="relative z-10 flex items-center justify-center">
                <DeviceDemo type={currentFeature.demo} progress={animationProgress} />
              </div>

              {/* Carousel Indicators */}
              <div className="absolute bottom-4 flex gap-2 z-10">
                {features.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      idx === currentFeatureIndex ? 'bg-primary w-6' : 'bg-primary/30 w-2'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Right Side - Sign In Form */}
            <div className="flex-1 flex flex-col p-8 justify-between">
              <div className="space-y-4 flex-1 flex flex-col justify-center">
                <h1 className="text-2xl font-bold text-on-surface leading-tight">
                  Sign in to Synchron to access your Clipboard
                </h1>
                
                {/* Feature Description that changes with animation */}
                <div className="min-h-16 pt-2">
                  <p className="text-on-surface-variant text-sm">
                    {currentFeature.description}
                  </p>
                </div>
              </div>

              {/* Login Button - Full Width at Bottom */}
              <div className="pt-6 border-t border-border">
                <Button 
                  onClick={() => {
                    try { window.location.href = '/api/auth/login' } catch { window.location.assign('/api/auth/login') }
                  }}
                  className="w-full rounded-m3-lg h-11 text-base font-medium"
                >
                  <LogIn className="mr-2 h-5 w-5" />
                  Sign in to SBHS Portal
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div ref={iframeRef as any} />
  )
}
