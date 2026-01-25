"use client"

import { useEffect, useRef } from "react"
import { LogIn, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/api/hooks"
import { cn } from "@/lib/utils"
import { useTimetable } from "@/contexts/timetable-context"
import { useToast } from "@/hooks/use-toast"
import { ToastAction } from "@/components/ui/toast"

export function AuthButton() {
  // We're using the hook to get the authentication state and functions
  const { isAuthenticated, logout, initiateLogin } = useAuth()
  const { reauthRequired } = useTimetable() as any
  const { toast } = useToast()
  const hasShownToastRef = useRef(false)

  // Show reauth button when reauthRequired is true, regardless of isAuthenticated
  // (we may still have expired tokens in storage, making isAuthenticated true)
  const showReauth = Boolean(reauthRequired)

  // Show a toast when reauth is required
  useEffect(() => {
    if (showReauth && !hasShownToastRef.current) {
      hasShownToastRef.current = true
      toast({
        variant: "destructive",
        title: "Something went wrong, try logging in and out if the issue persists.",
        description: "Unable to obtain OAuth2 tokens, a full reauth may be needed",
      })
    }
    // Reset when reauth is no longer required (user logged in)
    if (!showReauth) {
      hasShownToastRef.current = false
    }
  }, [showReauth, toast])

  // This is the client-side logic to handle both login and logout
  const handleAuth = () => {
    // If the user is authenticated, we call the logout function from the hook
    if (isAuthenticated) {
      // Ask for confirmation via toast with action buttons
      let promptToast: any

      const handleConfirm = async () => {
        try {
          // Dismiss the prompt toast first (we'll do a navigation next)
          promptToast?.dismiss()
        } catch (e) {}
        try {
          await logout()
        } catch (e) {}
        try {
          window.location.href = '/api/auth/logout'
        } catch {
          window.location.assign('/api/auth/logout')
        }
      }

      // Show confirmation toast; create then update to include scoped handlers
      promptToast = toast({
        title: 'Log out?'
        , description: 'Are you sure you want to sign out of Synchron?'
      })

      promptToast.update({
        action: (
          <div className="flex items-center gap-2">
            <ToastAction onClick={() => { try { promptToast.dismiss() } catch {} }}>
              Cancel
            </ToastAction>
            <ToastAction onClick={() => { try { handleConfirm() } catch {} }}>
              Yes
            </ToastAction>
          </div>
        ),
      })
    } else {
      // Delegate to server route that builds the correct authorize URL and manages state cookie
      if (typeof initiateLogin === 'function') {
        initiateLogin()
      } else {
        window.location.href = '/api/auth/login'
      }
    }
  }

  return (
    <Button
      variant={showReauth ? "default" : "outline"}
      size={(isAuthenticated || showReauth) ? "default" : "icon"}
      className={cn(
        "glass-button border-0 transition-all duration-200",
        showReauth
          ? "rounded-full px-4 h-10 bg-[#e26222] text-white shadow-md hover:opacity-95"
          : "bg-transparent hover:bg-white/30 dark:hover:bg-white/15",
        (isAuthenticated || showReauth) ? "rounded-full px-3 h-10" : "rounded-full w-10 h-10"
      )}
      onClick={handleAuth}
    >
      {isAuthenticated ? (
        <div className="flex items-center gap-2">
          <LogOut className="h-4 w-4" />
          <span className="whitespace-nowrap">Log out</span>
        </div>
      ) : showReauth ? (
        <div className="flex items-center gap-2">
          <LogIn className="h-4 w-4" />
          <span className="whitespace-nowrap">Log in for the latest info</span>
        </div>
      ) : (
        <LogIn className="h-4 w-4" />
      )}
    </Button>
  )
}
