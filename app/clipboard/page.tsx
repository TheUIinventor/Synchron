"use client"

import { useEffect } from "react"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { trackSectionUsage } from "@/utils/usage-tracker"
import PageTransition from "@/components/page-transition"

export default function ClipboardPage() {
  useEffect(() => {
    // Track clipboard usage
    trackSectionUsage("clipboard")
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

    document.body.appendChild(iframe)

    return () => {
      try { iframe.remove() } catch (e) {}
      try { style.remove() } catch (e) {}
    }
  }, [])

  return null
}
