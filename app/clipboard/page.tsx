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
    // Remove the root transform while this page is active so fixed positioning
    // behaves relative to the viewport (prevents the iframe being clipped by
    // the `#__next { transform: scale(...) }` rule used elsewhere).
    const root = document.getElementById("__next")
    if (!root) return
    const prev = root.style.transform
    root.style.transform = "none"
    return () => {
      root.style.transform = prev
    }
  }, [])

  return (
    <iframe
      src="https://portal.clipboard.app/sbhs/calendar"
      title="Clipboard Calendar"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      className="fixed top-0 bottom-0 left-0 right-0 md:left-20 lg:left-24 m-0 p-0 border-0 z-0"
      style={{ margin: 0, padding: 0, border: 0 }}
    />
  )
}
