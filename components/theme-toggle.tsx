"use client"

import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Sun, Moon } from "lucide-react"

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Handle theme toggle with explicit theme values
  const toggleTheme = () => {
    if (resolvedTheme === "dark") {
      setTheme("light")
      localStorage.setItem("synchron-theme-preference", "light")
    } else {
      setTheme("dark")
      localStorage.setItem("synchron-theme-preference", "dark")
    }
  }

  if (!mounted) {
    return (
      <Button variant="outline" size="icon" className="rounded-full w-10 h-10 glass-button bg-transparent">
        <div className="w-5 h-5" />
      </Button>
    )
  }

  return (
    <Button
      variant="outline"
      size="icon"
      className="rounded-full w-10 h-10 glass-button border-0 hover:bg-white/30 dark:hover:bg-white/15 transition-all duration-200 bg-transparent"
      onClick={toggleTheme}
    >
      <div className="glass-icon-enhanced rounded-full p-1 transition-all duration-300">
        {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </div>
    </Button>
  )
}
