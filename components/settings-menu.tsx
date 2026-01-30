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
      onClick={() => {
        try {
          window.location.href = "https://synchron.work/settings"
        } catch (e) {
          try { router.push("/settings") } catch (_) {}
        }
        localStorage.setItem("chronicl-easter-egg-discovered", "true")
      }}
    >
      <div className="glass-icon-enhanced rounded-full p-1">
        <Settings className="h-4 w-4" />
      </div>
    </Button>
  )
}
