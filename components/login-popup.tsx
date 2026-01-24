"use client"

import { useEffect, useState } from "react"
import { LogIn } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/api/hooks"

// Check if there's a valid access token in cookies RIGHT NOW
const hasValidAccessToken = (): boolean => {
  if (typeof document === 'undefined') return false
  try {
    const match = document.cookie.match(/(?:^|; )sbhs_access_token=([^;]*)/)
    const token = match ? decodeURIComponent(match[1]) : null
    // Check token exists AND is not empty
    const isValid = token && token.length > 0 && token !== 'undefined'
    console.log('[LoginPopup] cookie check - token:', token, 'isValid:', isValid)
    return isValid
  } catch (e) {
    console.log('[LoginPopup] cookie check error:', e)
    return false
  }
}

export default function LoginPopup() {
  const { initiateLogin } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [hasToken, setHasToken] = useState(true)

  useEffect(() => {
    // Only run on client
    if (typeof document === 'undefined') return
    
    setMounted(true)
    // Check immediately on mount
    const token = hasValidAccessToken()
    console.log('[LoginPopup] checking token on mount:', token)
    setHasToken(token)
    console.log('[LoginPopup] full cookies:', document.cookie)
    
    // Also set up an interval to check frequently
    const interval = setInterval(() => {
      const token = hasValidAccessToken()
      setHasToken(token)
    }, 100)
    
    return () => clearInterval(interval)
  }, [])

  // Don't render anything until mounted on client
  if (!mounted || hasToken) {
    return null
  }

  const handleSignIn = async () => {
    await initiateLogin()
  }

  console.log('[LoginPopup] render check - showing login popup')

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
