"use client"

import { Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export default function SettingsMenu() {
  const router = useRouter()

  return (
    <Button
      variant="outline"
      size="icon"
      className="rounded-full w-10 h-10 glass-button border-0 hover:bg-white/30 dark:hover:bg-white/15 transition-all duration-200 bg-transparent"
      onClick={(e) => {
        // Prevent parent handlers or default behaviors interfering with navigation
        try { e.preventDefault?.() } catch {}
        try { e.stopPropagation?.() } catch {}

        // Persist easter-egg flag before navigating so it isn't lost
        try { localStorage.setItem("chronicl-easter-egg-discovered", "true") } catch {}

        // Prefer SPA navigation using Next router
        try {
          router.push("/settings")
          return
        } catch (err) {
          /* fall through to hard navigation */
        }

        try { window.location.assign("https://synchron.work/settings") } catch (_) {}
      }}
    >
      <div className="glass-icon-enhanced rounded-full p-1">
        <Settings className="h-4 w-4" />
      </div>
    </Button>
  )
}
