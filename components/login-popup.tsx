"use client"

import { useEffect, useState } from "react"
import { LogIn } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/api/hooks"

export default function LoginPopup() {
  const { initiateLogin } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)

  useEffect(() => {
    setMounted(true)
    
    // Check if cached value exists from client-layout's early fetch
    const checkAuth = () => {
      if (typeof window === 'undefined') return
      
      const cachedStatus = sessionStorage.getItem('synchron:user-logged-in')
      console.log('[LoginPopup] Cache value:', cachedStatus, 'Type:', typeof cachedStatus)
      
      if (cachedStatus !== null) {
        // Use cached value immediately
        const isLoggedInValue = cachedStatus === 'true'
        console.log('[LoginPopup] Setting isLoggedIn to:', isLoggedInValue, 'from cache:', cachedStatus)
        setIsLoggedIn(isLoggedInValue)
      } else {
        // Fallback: if cache not ready yet, fetch it
        // But this should rarely happen since client-layout fetches it first
        console.log('[LoginPopup] No cache found, fetching /api/portal/userinfo')
        fetch('/api/portal/userinfo', { credentials: 'include' })
          .then(res => res.json())
          .then(data => {
            const loggedIn = data?.success === true
            console.log('[LoginPopup] API response:', JSON.stringify(data), 'loggedIn:', loggedIn)
            setIsLoggedIn(loggedIn)
            sessionStorage.setItem('synchron:user-logged-in', loggedIn ? 'true' : 'false')
          })
          .catch(() => {
            console.error('[LoginPopup] Fetch error')
            setIsLoggedIn(false)
          })
      }
    }
    
    checkAuth()
    
    // Listen for storage changes (when client-layout updates the cache)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'synchron:user-logged-in' && e.newValue) {
        console.log('[LoginPopup] Storage event detected, new value:', e.newValue)
        setIsLoggedIn(e.newValue === 'true')
      }
    }
    window.addEventListener('storage', handleStorageChange)
    
    // Also check every 5 seconds initially, then 30 seconds after 1 minute
    let checkCount = 0
    const interval = setInterval(() => {
      checkCount++
      // Check every 5 seconds for the first 12 checks (60 seconds), then every 30 seconds
      if (checkCount <= 12 || checkCount % 6 === 0) {
        checkAuth()
      }
    }, 5000)
    
    return () => {
      clearInterval(interval)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  // Don't render until mounted and auth status determined
  if (!mounted || isLoggedIn === null) {
    return null
  }

  // Show popup only if NOT logged in
  if (isLoggedIn === true) {
    console.log('[LoginPopup] NOT rendering - user is logged in')
    return null
  }

  console.log('[LoginPopup] RENDERING - user is NOT logged in')

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
