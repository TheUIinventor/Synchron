"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronLeft, ExternalLink, RefreshCw, X } from "lucide-react"
import { trackSectionUsage } from "@/utils/usage-tracker"
import PageTransition from "@/components/page-transition"
import { Button } from "@/components/ui/button"

export default function ClipboardPage() {
  const [showAuthHelper, setShowAuthHelper] = useState(false)
  const [iframeKey, setIframeKey] = useState(0)

  useEffect(() => {
    // Track clipboard usage
    trackSectionUsage("clipboard")
  }, [])

  // Check if user might need to authenticate (show helper after a delay)
  useEffect(() => {
    // Show auth helper after 3 seconds - gives iframe time to load or fail
    const timer = setTimeout(() => {
      setShowAuthHelper(true)
    }, 3000)
    return () => clearTimeout(timer)
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

    document.body.appendChild(iframe)

    return () => {
      try { iframe.remove() } catch (e) {}
      try { style.remove() } catch (e) {}
    }
  }, [iframeKey])

  const handleOpenInNewTab = () => {
    window.open("https://portal.clipboard.app/sbhs/calendar", "_blank")
  }

  const handleRefresh = () => {
    setShowAuthHelper(false)
    setIframeKey((k) => k + 1)
  }

  return (
    <>
      {showAuthHelper && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 md:left-[calc(5rem+50%)] md:-translate-x-1/2 lg:left-[calc(6rem+50%)] z-50 bg-card border border-border rounded-lg shadow-lg p-4 max-w-sm text-center relative">
          <button
            onClick={() => setShowAuthHelper(false)}
            className="absolute top-2 right-2 p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="text-sm text-muted-foreground mb-3 pr-4">
            Having trouble signing in? Microsoft login doesn&apos;t work inside embedded frames.
          </p>
          <div className="flex gap-2 justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenInNewTab}
              className="gap-1.5"
            >
              <ExternalLink className="h-4 w-4" />
              Open in New Tab
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              className="gap-1.5"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Sign in there, then come back and refresh.
          </p>
        </div>
      )}
    </>
  )
}
