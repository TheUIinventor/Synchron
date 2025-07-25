"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/api/hooks"
import { School, ExternalLink, Wifi, WifiOff, ArrowLeft, Calendar, Bell, Award } from "lucide-react"
import Link from "next/link"

interface SignInButtonProps {
  onSuccess?: () => void
}

export default function SignInButton({ onSuccess }: SignInButtonProps) {
  const { initiateLogin, loading } = useAuth()
  const [portalStatus, setPortalStatus] = useState<"checking" | "online" | "offline">("checking")

  useEffect(() => {
    // Check if SBHS portal is reachable
    const checkPortalStatus = async () => {
      try {
        const response = await fetch("https://student.sbhs.net.au", {
          method: "HEAD",
          mode: "no-cors",
          cache: "no-cache",
          headers: {
            "User-Agent": "Chronicl-App/1.0",
          },
        })
        setPortalStatus("online")
      } catch (error) {
        setPortalStatus("offline")
      }
    }

    checkPortalStatus()
  }, [])

  const handleSignIn = async () => {
    await initiateLogin()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <Card className="w-full max-w-md rounded-[1.5rem] shadow-lg">
        <CardContent className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <Link href="/" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h2 className="text-xl font-bold theme-gradient mb-2">Connect Your Account</h2>
            <div className="w-5"></div>
          </div>

          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-theme-secondary rounded-full flex items-center justify-center mb-4">
              <School className="h-8 w-8 text-theme-primary" />
            </div>
            <h1 className="text-2xl font-bold theme-gradient mb-2">Personalize Your Experience</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Connect with your SBHS Student Portal to see your real data
            </p>
          </div>

          {/* Benefits */}
          <div className="space-y-4 mb-6">
            <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <div className="rounded-full p-1 bg-blue-100 dark:bg-blue-900/30">
                <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-medium text-blue-900 dark:text-blue-100 text-sm">Your Real Timetable</h3>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  See your actual classes, teachers, and room numbers
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
              <div className="rounded-full p-1 bg-green-100 dark:bg-green-900/30">
                <Bell className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-medium text-green-900 dark:text-green-100 text-sm">Personal Notices</h3>
                <p className="text-xs text-green-700 dark:text-green-300">
                  Get notices relevant to your year group and activities
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
              <div className="rounded-full p-1 bg-purple-100 dark:bg-purple-900/30">
                <Award className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-medium text-purple-900 dark:text-purple-100 text-sm">Award Points</h3>
                <p className="text-xs text-purple-700 dark:text-purple-300">
                  Track your actual recognition points and nominations
                </p>
              </div>
            </div>
          </div>

          {/* Portal Status Indicator */}
          <div className="mb-6">
            <div
              className={`flex items-center gap-2 text-sm px-3 py-2 rounded-full ${
                portalStatus === "online"
                  ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                  : portalStatus === "offline"
                    ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
                    : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
              }`}
            >
              {portalStatus === "checking" && (
                <div className="animate-spin rounded-full h-3 w-3 border border-gray-400 border-t-transparent" />
              )}
              {portalStatus === "online" && <Wifi className="h-3 w-3" />}
              {portalStatus === "offline" && <WifiOff className="h-3 w-3" />}
              <span>
                {portalStatus === "checking" && "Checking portal connection..."}
                {portalStatus === "online" && "SBHS Portal is online"}
                {portalStatus === "offline" && "Portal may be offline"}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-full p-1 bg-blue-100 dark:bg-blue-900/30">
                  <ExternalLink className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-1">Secure Authentication</h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Connect securely with your SBHS Student Portal credentials to access your personalized timetable,
                    notices, and award points.
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={handleSignIn}
              className="w-full rounded-xl bg-theme-primary hover:opacity-90 h-12 text-base font-medium"
              disabled={loading || portalStatus === "offline"}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Redirecting...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <ExternalLink className="h-5 w-5" />
                  Connect SBHS Portal
                </div>
              )}
            </Button>

            {portalStatus === "offline" && (
              <div className="text-center">
                <p className="text-sm text-red-600 dark:text-red-400">
                  The SBHS portal appears to be offline. Please try again later.
                </p>
              </div>
            )}

            <div className="text-center">
              <Link
                href="/"
                className="inline-flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Continue exploring
              </Link>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            <div className="text-center">
              <a
                href="https://student.sbhs.net.au"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-sm text-theme-primary hover:opacity-80 transition-opacity"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Visit SBHS Student Portal
              </a>
            </div>

            <div className="text-center pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                By connecting, you agree to use your SBHS credentials responsibly and in accordance with school
                policies.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
