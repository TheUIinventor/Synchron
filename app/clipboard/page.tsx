"use client"

import { useEffect, useState, useRef } from "react"
import { ExternalLink, RefreshCw, X, LogIn } from "lucide-react"
import { trackSectionUsage } from "@/utils/usage-tracker"
import { Button } from "@/components/ui/button"

export const dynamic = 'force-dynamic';

export default function ClipboardPage() {
  const [showAuthHelper, setShowAuthHelper] = useState(false)
  const [iframeKey, setIframeKey] = useState(0)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [cookieText, setCookieText] = useState("")
  const [isLoadingProxy, setIsLoadingProxy] = useState(false)
  const [proxyError, setProxyError] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const popupRef = useRef<Window | null>(null)
  const popupCheckInterval = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Track clipboard usage
    trackSectionUsage("clipboard")
  }, [])

  // Show helper immediately (user requested instant visibility)
  useEffect(() => {
    setShowAuthHelper(true)
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

  // Aggressive experiment: POST the user-supplied cookie to the proxy and load HTML via srcdoc
  const handleLoadWithCookie = async () => {
    setProxyError(null)
    if (!cookieText || cookieText.trim().length < 10) {
      setProxyError('Please paste a valid session cookie string from portal.clipboard.app')
      return
    }
    if (!confirm('This will send the provided cookie string to the local Synchron server to fetch Clipboard HTML. Do not paste secrets you do not trust. Proceed?')) return
    setIsLoadingProxy(true)
    try {
      const res = await fetch('/api/clipboard/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie: cookieText.trim() })
      })
      const j = await res.json()
      if (!j || !j.ok) {
        setProxyError(j?.error || 'Proxy fetch failed')
        setIsLoadingProxy(false)
        return
      }

      // Load returned HTML into iframe via srcdoc
      if (iframeRef.current) {
        // Some browsers restrict srcdoc + allow-same-origin; this is experimental
        iframeRef.current.srcdoc = j.html
        // Clear any previous data-key so next reload path isn't stale
        iframeRef.current.removeAttribute('data-key')
      }
    } catch (e: any) {
      setProxyError(String(e))
    } finally {
      setIsLoadingProxy(false)
    }
  }

  return (
    <>
      {showAuthHelper && (
        <div className="fixed bottom-4 left-4 md:left-20 lg:left-24 z-50 bg-card border border-border rounded-lg shadow-lg p-4 max-w-sm text-center relative">
          <button
            onClick={() => setShowAuthHelper(false)}
            className="absolute top-2 right-2 p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="text-sm text-muted-foreground mb-3 pr-4">
            {isAuthenticating
              ? "Complete SSO in the popup, then close it."
              : "Quick verification flow: use the popup, then finish sign-in inside the embedded page."
            }
          </p>
          <div className="text-left text-xs text-muted-foreground mb-3 pr-2">
            <ol className="list-decimal list-inside">
              <li>Click <strong>Popup Login</strong> and complete the Microsoft SSO in the popup.</li>
              <li>Close the popup when SSO finishes.</li>
              <li>In the embedded Clipboard frame, click the page's <em>Sign in with SSO</em> button (it may ask for your student ID). This final confirmation binds the session to the embed.</li>
            </ol>
            <p className="mt-2">This typically completes a one-time verification for the browser/profile — after that the embed should load without repeating the full SSO flow.</p>
          </div>
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

          <div className="mt-4 text-left">
            <p className="text-xs text-rose-600 mb-2">Experimental: manual cookie proxy (insecure)</p>
            <p className="text-xs text-muted-foreground mb-2">If you know how you signed in previously, paste the clipboard.app session cookie here and click "Load via proxy". This sends the cookie to your local Synchron server to fetch the page on your behalf. Do not paste passwords or tokens you do not trust.</p>
            <textarea
              value={cookieText}
              onChange={(e) => setCookieText(e.target.value)}
              placeholder="Paste Cookie header value (e.g. 'session=...; path=/;')"
              className="w-full rounded-md border p-2 text-xs"
              rows={3}
            />
            <div className="flex gap-2 justify-end mt-2">
              <Button variant="secondary" size="sm" onClick={() => { setCookieText('') }}>Clear</Button>
              <Button variant="destructive" size="sm" onClick={() => { setCookieText('') }}>Cancel</Button>
              <Button variant="default" size="sm" onClick={handleLoadWithCookie} disabled={isLoadingProxy}>
                {isLoadingProxy ? 'Loading...' : 'Load via proxy'}
              </Button>
            </div>
            {proxyError && <p className="text-xs text-rose-600 mt-2">{proxyError}</p>}
          </div>
        </div>
      )}
    </>
  )
}
