"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { X, Sparkles } from "lucide-react"

interface WelcomePopupProps {
  isAuthenticated: boolean
}

export default function WelcomePopup({ isAuthenticated }: WelcomePopupProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Only show for unauthenticated users
    if (!isAuthenticated) {
      const hasSeenWelcome = localStorage.getItem("synchron-welcome-seen")
      if (!hasSeenWelcome) {
        // Small delay for better UX
        const timer = setTimeout(() => {
          setIsVisible(true)
        }, 2000)
        return () => clearTimeout(timer)
      }
    }
  }, [isAuthenticated])

  const handleDismiss = () => {
    setIsVisible(false)
    localStorage.setItem("synchron-welcome-seen", "true")
  }

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm">
        <Card className="rounded-[1.5rem] bg-white dark:bg-gray-900 shadow-2xl border border-gray-100 dark:border-gray-800">
          <CardContent className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="font-bold">Welcome to Synchron</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Your SBHS companion</p>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Demo Mode</h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  You're viewing sample data. Connect your SBHS portal account to see your real timetable and data.
                </p>
              </div>

              <div className="space-y-2">
                <Button onClick={handleDismiss} className="w-full bg-blue-600 hover:bg-blue-700">
                  Explore Demo
                </Button>
                <Button variant="outline" onClick={handleDismiss} className="w-full bg-transparent">
                  Skip Tour
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
