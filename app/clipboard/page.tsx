"use client"

import { useEffect, useState, useRef } from "react"
import { trackSectionUsage } from "@/utils/usage-tracker"
import { useAuth } from "@/lib/api/hooks"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LogIn, Link as LinkIcon, Calendar, Bell, Palette, Zap, BookOpen } from "lucide-react"

const features = [
  {
    title: "Canvas Integration",
    icon: "canvas"
  },
  {
    title: "Dynamic Links",
    icon: "links"
  },
  {
    title: "Clipboard Integration",
    icon: "calendar"
  },
  {
    title: "Daily Notices",
    icon: "bell"
  },
  {
    title: "Modern Timetable",
    icon: "schedule"
  },
  {
    title: "Expressive Design",
    icon: "palette"
  },
  {
    title: "Built to Last",
    icon: "zap"
  }
]

// Feature Icon Component
const FeatureIcon = ({ type }: { type: string }) => {
  const iconSize = "h-16 w-16"
  const iconColor = "text-primary"

  if (type === "canvas") {
    return (
      <div className={`${iconSize} ${iconColor} flex items-center justify-center`}>
        <svg viewBox="0 0 512 512" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M256 67.5C154.9 67.5 67.5 154.9 67.5 256S154.9 444.5 256 444.5 444.5 357.1 444.5 256 357.1 67.5 256 67.5m0 334.2c-84.6 0-153.2-68.6-153.2-153.2S171.4 95.3 256 95.3s153.2 68.6 153.2 153.2-68.6 153.2-153.2 153.2"/>
        </svg>
      </div>
    )
  }

  if (type === "links") {
    return <LinkIcon className={`${iconSize} ${iconColor}`} strokeWidth={1.5} />
  }

  if (type === "calendar") {
    return <Calendar className={`${iconSize} ${iconColor}`} strokeWidth={1.5} />
  }

  if (type === "bell") {
    return <Bell className={`${iconSize} ${iconColor}`} strokeWidth={1.5} />
  }

  if (type === "schedule") {
    return <BookOpen className={`${iconSize} ${iconColor}`} strokeWidth={1.5} />
  }

  if (type === "palette") {
    return <Palette className={`${iconSize} ${iconColor}`} strokeWidth={1.5} />
  }

  if (type === "zap") {
    return <Zap className={`${iconSize} ${iconColor}`} strokeWidth={1.5} />
  }

  return null
}

export default function ClipboardPage() {
  const { isAuthenticated, loading } = useAuth()
  const [iframeKey, setIframeKey] = useState(0)
  const [currentFeatureIndex, setCurrentFeatureIndex] = useState(0)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  useEffect(() => {
    // Track clipboard usage
    trackSectionUsage("clipboard")
  }, [])

  // Cycle through features every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFeatureIndex((prev) => (prev + 1) % features.length)
    }, 4000)

    return () => clearInterval(interval)
  }, [])

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
        <Card className="w-full max-w-4xl bg-card border border-border rounded-m3-xl shadow-elevation-1 overflow-hidden">
          <div className="flex flex-col gap-8 p-12">
            {/* Header */}
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold text-on-surface">
                Sign in to Synchron to access your Clipboard
              </h1>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-6">
              {features.map((feature, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col items-center gap-2 transition-all duration-300 ${
                    idx === currentFeatureIndex ? 'opacity-100 scale-110' : 'opacity-50 scale-100'
                  }`}
                >
                  <div className="p-4 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors">
                    <FeatureIcon type={feature.icon} />
                  </div>
                  <p className="text-xs font-semibold text-on-surface text-center leading-tight">
                    {feature.title}
                  </p>
                </div>
              ))}
            </div>

            {/* Carousel Indicators */}
            <div className="flex gap-2 justify-center">
              {features.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    idx === currentFeatureIndex ? 'bg-primary w-6' : 'bg-primary/30 w-2'
                  }`}
                />
              ))}
            </div>

            {/* Login Button */}
            <div className="pt-4">
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
        </Card>
      </div>
    )
  }

  return (
    <div ref={iframeRef as any} />
  )
}
