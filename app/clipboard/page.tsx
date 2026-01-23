"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { trackSectionUsage } from "@/utils/usage-tracker"
import { useAuth } from "@/lib/api/hooks"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LogIn } from "lucide-react"

export default function ClipboardPage() {
  const router = useRouter()
  const { isAuthenticated, loading } = useAuth()
  const [iframeKey, setIframeKey] = useState(0)
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  useEffect(() => {
    trackSectionUsage("clipboard")
  }, [])

  // Check if user just signed in by polling the auth status
  useEffect(() => {
    if (!loading && isAuthenticated && hasCheckedAuth) {
      // User has authenticated, refresh the page to show content
      router.refresh()
    }
  }, [isAuthenticated, loading, hasCheckedAuth, router])

  // Mark that we've done initial check
  useEffect(() => {
    if (!loading) {
      setHasCheckedAuth(true)
    }
  }, [loading])

  // Create iframe when authenticated
  useEffect(() => {
    if (!isAuthenticated) return

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
  }, [iframeKey, isAuthenticated])

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <Card className="p-8 max-w-sm w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </Card>
      </div>
    )
  }

  // Show sign-in popup if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
        <Card className="max-w-sm w-full">
          <div className="p-8 space-y-6">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-on-surface">
                Sign into Synchron
              </h1>
              <p className="text-on-surface-variant text-sm">
                to access your Clipboard
              </p>
            </div>

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
        </Card>
      </div>
    )
  }

  // If authenticated, just render an empty div (iframe is added to body)
  return (
    <div ref={iframeRef as any} />
  )
}
