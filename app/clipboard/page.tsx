"use client"

import { useEffect, useState, useRef } from "react"
import { trackSectionUsage } from "@/utils/usage-tracker"
import { useAuth } from "@/lib/api/hooks"
import { Card } from "@/components/ui/card"
import { Calendar, Bell, Clipboard as ClipboardIcon, Zap } from "lucide-react"
import SignInButton from "@/components/auth/sign-in-button"

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

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
        <Card className="w-full max-w-2xl bg-card border border-border rounded-m3-xl shadow-elevation-1 overflow-hidden">
          <div className="flex flex-col md:flex-row h-96">
            {/* Left Side - Animated Feature */}
            <div className="flex-1 bg-gradient-to-br from-primary/10 to-primary/5 flex flex-col items-center justify-center p-8 relative overflow-hidden">
              {/* Animated background circles */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="absolute w-32 h-32 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
              </div>
              
              {/* Feature Icon and Content */}
              <div className="relative z-10 text-center space-y-4">
                <div className="flex justify-center">
                  <div className="p-4 bg-primary/20 rounded-full animate-in fade-in duration-500">
                    <CurrentIcon className="h-12 w-12 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-on-surface">{currentFeature.title}</h3>
                </div>
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
                  <p className="text-on-surface-variant text-sm animate-in fade-in duration-500">
                    {currentFeature.description}
                  </p>
                </div>
              </div>

              {/* Sign In Button - Full Width at Bottom */}
              <div className="pt-6 border-t border-border">
                <SignInButton onSuccess={() => window.location.reload()} />
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
