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

  return (
    <PageTransition>
      <div className="h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 md:p-4 bg-surface border-b border-outline-variant z-10">
          <Link href="/" className="hidden md:flex text-on-surface-variant hover:text-on-surface transition-colors">
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-lg font-bold text-on-surface text-left md:text-center md:flex-1">Clipboard</h1>
          <div className="w-6"></div> {/* Empty div for spacing */}
        </div>

        {/* Full-width iframe */}
        <div className="flex-1 w-full">
          <iframe
            src="https://portal.clipboard.app/sbhs/calendar"
            className="w-full h-full border-0"
            title="Clipboard Calendar"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
      </div>
    </PageTransition>
  )
}
