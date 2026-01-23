"use client"

import { useEffect, useState, useRef } from "react"
import { trackSectionUsage } from "@/utils/usage-tracker"
import { useAuth } from "@/lib/api/hooks"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import SignInButton from "@/components/auth/sign-in-button"

export default function ClipboardPage() {
  const { isAuthenticated, loading } = useAuth()
  const [iframeKey, setIframeKey] = useState(0)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  useEffect(() => {
    // Track clipboard usage
    trackSectionUsage("clipboard")
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
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <Card className="w-full max-w-md mx-4 bg-card border border-border rounded-m3-xl shadow-elevation-1 p-8">
          <div className="text-center space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-on-surface mb-2">Sign in required</h1>
              <p className="text-on-surface-variant">You need to be signed into Synchron to access the Clipboard.</p>
            </div>
            <div className="pt-4">
              <SignInButton onSuccess={() => window.location.reload()} />
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
