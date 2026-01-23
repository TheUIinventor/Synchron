"use client"

import { useEffect, useState, useRef } from "react"
import { trackSectionUsage } from "@/utils/usage-tracker"
import { useAuth } from "@/lib/api/hooks"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, Bell, Clipboard as ClipboardIcon, Zap, LogIn } from "lucide-react"

const features = [
  {
    icon: Calendar,
    title: "Smart Timetable",
    description: "See your real classes, teachers, and rooms in one beautiful view."
  },
  {
    icon: Bell,
    title: "Instant Notifications",
    description: "Get notices relevant to your year group and activities as they happen."
  },
  {
    icon: ClipboardIcon,
    title: "Organize with Clipboard",
    description: "Seamlessly access your calendar and tasks from the SBHS Portal."
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Optimized for speed so you always know what's next."
  }
]

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
    const CurrentIcon = currentFeature.icon
    const nextFeature = features[(currentFeatureIndex + 1) % features.length]
    const NextIcon = nextFeature.icon

    // Ease animation progress for smooth transitions
    const easeProgress = animationProgress < 0.5 
      ? 2 * animationProgress * animationProgress 
      : 1 - Math.pow(-2 * animationProgress + 2, 2) / 2

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
        <Card className="w-full max-w-2xl bg-card border border-border rounded-m3-xl shadow-elevation-1 overflow-hidden">
          <div className="flex flex-col md:flex-row h-96">
            {/* Left Side - Animated Carousel */}
            <div className="flex-1 bg-gradient-to-br from-primary/10 to-primary/5 flex flex-col items-center justify-center p-8 relative overflow-hidden">
              {/* Animated background circles */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="absolute w-48 h-48 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
              </div>
              
              {/* Current Feature Card - Scaling out and moving up */}
              <div 
                className="absolute text-center space-y-3"
                style={{
                  transform: `scale(${1 - easeProgress * 0.4}) translateY(${easeProgress * -30}px)`,
                  opacity: Math.max(0, 1 - easeProgress * 1.2),
                  transition: 'none'
                }}
              >
                <div className="flex justify-center">
                  <div className="p-4 bg-primary/20 rounded-full">
                    <CurrentIcon className="h-12 w-12 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-on-surface">{currentFeature.title}</h3>
                </div>
              </div>

              {/* Next Feature Card - Scaling in from below */}
              <div 
                className="absolute text-center space-y-3"
                style={{
                  transform: `scale(${easeProgress * 0.7 + 0.3}) translateY(${(1 - easeProgress) * 40}px)`,
                  opacity: Math.min(1, easeProgress * 1.5),
                  transition: 'none'
                }}
              >
                <div className="flex justify-center">
                  <div className="p-4 bg-primary/20 rounded-full">
                    <NextIcon className="h-12 w-12 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-on-surface">{nextFeature.title}</h3>
                </div>
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
    <>
    </>
  )
}
