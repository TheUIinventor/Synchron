"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { X, Sparkles, Calendar, Bell, Award } from "lucide-react"
import { useAuth } from "@/lib/api/hooks"

interface WelcomePopupProps {
  isAuthenticated: boolean
}

export default function WelcomePopup({ isAuthenticated }: WelcomePopupProps) {
  const [isVisible, setIsVisible] = useState(false)
  const { initiateLogin } = useAuth()

  useEffect(() => {
    if (!isAuthenticated) {
      const hasSeenWelcome = localStorage.getItem("synchron-welcome-seen")
      if (!hasSeenWelcome) {
        const timer = setTimeout(() => setIsVisible(true), 1200)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* blurred backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleDismiss} />

      {/* animated promo card */}
      <div className="relative w-full max-w-3xl">
        <Card className="relative overflow-hidden rounded-[1.5rem] shadow-2xl border border-transparent">
          {/* decorative animated gradient bg */}
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 opacity-90" style={{ filter: "saturate(1.05)" }} />

          <CardContent className="p-8 bg-white/80 dark:bg-black/60 backdrop-blur-md">
            <div className="flex flex-col md:flex-row gap-6 items-center">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-white/60 flex items-center justify-center shadow-md">
                    <Sparkles className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Welcome to Synchron</h2>
                    <p className="text-sm text-gray-700 dark:text-gray-300">Connect your SBHS account to see real timetables, notices and award points.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                  <div className="p-3 rounded-xl bg-white/80 flex items-start gap-3">
                    <div className="p-2 rounded-md bg-purple-100">
                      <Calendar className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">Real Timetable</div>
                      <div className="text-xs text-gray-600">Classes, teachers and rooms</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/80 flex items-start gap-3">
                    <div className="p-2 rounded-md bg-green-100">
                      <Bell className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">Personal Notices</div>
                      <div className="text-xs text-gray-600">Important messages for your year</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/80 flex items-start gap-3">
                    <div className="p-2 rounded-md bg-yellow-100">
                      <Award className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">Award Points</div>
                      <div className="text-xs text-gray-600">Track recognitions and nominations</div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button onClick={() => initiateLogin()} className="bg-theme-primary hover:opacity-95 px-4 h-11">
                    Sign in
                  </Button>
                  <Button variant="outline" onClick={handleDismiss} className="px-4 h-11">
                    Continue as demo
                  </Button>
                </div>
              </div>

              {/* animated visual column */}
              <div className="w-full md:w-56 h-40 rounded-lg relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-40 h-32 rounded-lg bg-white/60 shadow-lg transform animate-bounce-slow" />
                </div>
                <div className="relative z-10 text-sm text-gray-700">Preview</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
