"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { LogIn, LogOut, School, ExternalLink, Wifi, WifiOff, ArrowLeft, Calendar, Bell, Award } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/api/hooks"

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
    <div className="min-h-screen flex items-center justify-center bg-surface px-4 py-12">
      <Card className="w-full max-w-md rounded-m3-xl shadow-elevation-2 bg-surface-container border-none">
        <CardContent className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <Link href="/" className="text-on-surface-variant hover:text-on-surface transition-colors">
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <div className="w-6"></div>
          </div>

          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <School className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-on-surface mb-2">Connect Your Account</h1>
            <p className="text-sm text-on-surface-variant">
              Connect with your SBHS Student Portal to see your real data
            </p>
          </div>

          {/* Benefits */}
          <div className="space-y-3 mb-6">
            <div className="flex items-start gap-3 p-3 bg-surface-container-high rounded-xl">
              <div className="rounded-full p-2 bg-primary/10 text-primary">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-medium text-on-surface text-sm">Your Real Timetable</h3>
                <p className="text-xs text-on-surface-variant">
                  See your actual classes, teachers, and room numbers
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-surface-container-high rounded-xl">
              <div className="rounded-full p-2 bg-primary/10 text-primary">
                <Bell className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-medium text-on-surface text-sm">Personal Notices</h3>
                <p className="text-xs text-on-surface-variant">
                  Get notices relevant to your year group and activities
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-surface-container-high rounded-xl">
              <div className="rounded-full p-2 bg-primary/10 text-primary">
                <Award className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-medium text-on-surface text-sm">Award Points</h3>
                <p className="text-xs text-on-surface-variant">
                  Track your actual recognition points and nominations
                </p>
              </div>
            </div>
          </div>

          {/* Portal Status Indicator */}
          <div className="mb-6 flex justify-center">
            <Badge 
              variant="outline" 
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-none ${
                portalStatus === "online"
                  ? "bg-green-500/10 text-green-600 dark:text-green-400"
                  : portalStatus === "offline"
                    ? "bg-red-500/10 text-red-600 dark:text-red-400"
                    : "bg-surface-container-highest text-on-surface-variant"
              }`}
            >
              {portalStatus === "checking" && (
                <div className="animate-spin rounded-full h-3 w-3 border-2 border-current border-t-transparent" />
              )}
              {portalStatus === "online" && <Wifi className="h-3 w-3" />}
              {portalStatus === "offline" && <WifiOff className="h-3 w-3" />}
              <span>
                {portalStatus === "checking" && "Checking portal connection..."}
                {portalStatus === "online" && "SBHS Portal is online"}
                {portalStatus === "offline" && "Portal may be offline"}
              </span>
            </Badge>
          </div>

          <div className="space-y-4">
            <div className="bg-primary/5 border border-primary/10 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-full p-1 bg-primary/10">
                  <ExternalLink className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-on-surface mb-1 text-sm">Secure Authentication</h3>
                  <p className="text-xs text-on-surface-variant">
                    Connect securely with your SBHS Student Portal credentials to access your personalized timetable,
                    notices, and award points.
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={handleSignIn}
              className="w-full rounded-full h-12 text-base font-medium"
              disabled={loading || portalStatus === "offline"}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-on-primary"></div>
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
                <p className="text-sm text-error">
                  The SBHS portal appears to be offline. Please try again later.
                </p>
              </div>
            )}
          </div>

          <div className="mt-8 space-y-4">
            <div className="text-center">
              <a
                href="https://student.sbhs.net.au"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-sm text-primary hover:underline transition-all"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Visit SBHS Student Portal
              </a>
            </div>

            <div className="text-center pt-4 border-t border-outline-variant">
              <p className="text-xs text-on-surface-variant/70">
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
