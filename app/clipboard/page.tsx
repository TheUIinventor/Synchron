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
        <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 z-10">
          <Link href="/" className="text-gray-500 dark:text-gray-400">
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-xl font-bold">Clipboard</h1>
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
