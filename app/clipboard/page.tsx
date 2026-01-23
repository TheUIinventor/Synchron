"use client"

import { useEffect, useState, useRef } from "react"
import { trackSectionUsage } from "@/utils/usage-tracker"
import { useToast } from "@/hooks/use-toast"
import { ToastAction } from "@/components/ui/toast"

export const dynamic = "force-dynamic"

export default function ClipboardPage() {
  const [iframeKey, setIframeKey] = useState(0)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    // Track clipboard usage
    trackSectionUsage("clipboard")
    
    // Get access count from localStorage
    const storedCount = localStorage.getItem("synchron-clipboard-access-count")
    let accessCount = storedCount ? parseInt(storedCount, 10) : 0
    accessCount += 1
    localStorage.setItem("synchron-clipboard-access-count", String(accessCount))
    
    // Show toast on every access for first 5 times, then every 20 times
    const shouldShowToast = accessCount <= 5 || (accessCount % 20 === 0)
    
    if (shouldShowToast) {
      toast({
        title: "Clipboard Access",
        description: "Are you experiencing difficulty accessing Clipboard from Synchron?",
        action: (
          <div className="flex gap-2">
            <ToastAction
              altText="No"
              onClick={() => {
                // Dismiss the toast
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              No
            </ToastAction>
            <ToastAction
              altText="Yes"
              onClick={() => {
                // Show the help toast
                toast({
                  title: "Note",
                  description: "Clipboard integration does not work unless you are signed into Synchron. After signing in, try to access Clipboard at least 3 times, reloading each time if it still doesn't work.",
                })
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes
            </ToastAction>
          </div>
        ),
      })
    }
  }, [toast])

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

  return (
    <>
    </>
  )
}
