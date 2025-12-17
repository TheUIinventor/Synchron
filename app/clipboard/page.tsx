"use client"

import { useEffect, useState, useRef } from "react"
import { ExternalLink, RefreshCw, X, LogIn } from "lucide-react"
import { trackSectionUsage } from "@/utils/usage-tracker"
import { Button } from "@/components/ui/button"

export default function ClipboardPage() {
  const [showAuthHelper, setShowAuthHelper] = useState(false)
  const [iframeKey, setIframeKey] = useState(0)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const popupRef = useRef<Window | null>(null)
  const popupCheckInterval = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Track clipboard usage
    trackSectionUsage("clipboard")
  }, [])

  // Check if user might need to authenticate (show helper after a delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowAuthHelper(true)
    }, 5000)
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
    iframeRef.current = iframe

    document.body.appendChild(iframe)

    return () => {
      try { iframe.remove() } catch (e) {}
      try { style.remove() } catch (e) {}
      iframeRef.current = null
    }
  }, [iframeKey])

  // Cleanup popup check interval on unmount
  useEffect(() => {
    return () => {
      if (popupCheckInterval.current) {
        clearInterval(popupCheckInterval.current)
      }
    }
  }, [])

  // Open login in a popup window (popups don't have X-Frame-Options restrictions)
  const handlePopupLogin = () => {
    setIsAuthenticating(true)
    
    // Calculate popup position (center of screen)
    const width = 500
    const height = 700
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2
    
    // Open popup for authentication
    popupRef.current = window.open(
      "https://portal.clipboard.app/sbhs/calendar",
      "clipboard_auth",
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=yes,status=no`
    )

    // Check when popup is closed
    if (popupRef.current) {
      popupCheckInterval.current = setInterval(() => {
        if (popupRef.current?.closed) {
          clearInterval(popupCheckInterval.current!)
          popupCheckInterval.current = null
          setIsAuthenticating(false)
          // Refresh iframe after popup closes (user hopefully authenticated)
          handleRefresh()
        }
      }, 500)
    } else {
      setIsAuthenticating(false)
    }
  }

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
            {isAuthenticating 
              ? "Sign in to Clipboard in the popup window, then close it when done."
              : "Having trouble signing in? Try the popup login."
            }
          </p>
          <div className="flex gap-2 justify-center flex-wrap">
            <Button
              variant="default"
              size="sm"
              onClick={handlePopupLogin}
              className="gap-1.5"
              disabled={isAuthenticating}
            >
              <LogIn className="h-4 w-4" />
              {isAuthenticating ? "Authenticating..." : "Popup Login"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenInNewTab}
              className="gap-1.5"
            >
              <ExternalLink className="h-4 w-4" />
              New Tab
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
        </div>
      )}
    </>
  )
}
