"use client"

import { useEffect, useState } from "react"
import { LogIn } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/api/hooks"
import { useTimetable } from "@/contexts/timetable-context"

export default function LoginPopup() {
  const { initiateLogin } = useAuth()
  const { timetableData, reauthRequired } = useTimetable()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Don't render until mounted
  if (!mounted) {
    return null
  }

  // Show popup if:
  // 1. User is marked as needing to re-authenticate, OR
  // 2. Timetable indicates no timetable data (noTimetable flag is true)
  const shouldShowPopup = reauthRequired || timetableData?.noTimetable
  
  console.log('[LoginPopup] FULL DEBUG:', {
    reauthRequired,
    'timetableData?.noTimetable': timetableData?.noTimetable,
    'timetableData?.timetable': timetableData?.timetable,
    'timetableData?.error': timetableData?.error,
    'timetableData?.source': timetableData?.source,
    'timetableData keys': timetableData ? Object.keys(timetableData).join(',') : 'null',
    shouldShowPopup
  })

  if (!shouldShowPopup) {
    return null
  }

  const handleSignIn = async () => {
    await initiateLogin()
  }

  return (
    <>
      {/* Blurred background overlay */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-40 pointer-events-auto" />

      {/* Centered popup card */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-md bg-surface border-outline shadow-elevation-3 rounded-3xl">
          <div className="p-6 sm:p-8 flex flex-col items-center text-center space-y-6">
            {/* Icon */}
            <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center">
              <LogIn className="h-8 w-8 text-primary" />
            </div>

            {/* Heading */}
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-on-surface">Sign In Required</h2>
              <p className="text-sm text-on-surface-variant">
                Please log in to access your timetable and school information.
              </p>
            </div>

            {/* Divider */}
            <div className="w-full h-px bg-outline-variant" />

            {/* Call to action */}
            <div className="space-y-3 w-full">
              <Button 
                onClick={handleSignIn}
                className="w-full rounded-full h-12 text-base font-semibold shadow-elevation-1 hover:shadow-elevation-2 transition-shadow"
              >
                <LogIn className="mr-2 h-5 w-5" />
                Sign In
              </Button>
              <p className="text-xs text-on-surface-variant px-2">
                Use your SBHS portal credentials to sign in.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </>
  )
}
