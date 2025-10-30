"use client"

import { LogIn, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/api/hooks"

export function AuthButton() {
  // We're using the hook to get the authentication state and functions
  const { isAuthenticated, logout } = useAuth()

  // This is the client-side logic to handle both login and logout
  const handleAuth = () => {
    // If the user is authenticated, we call the logout function from the hook
    if (isAuthenticated) {
      logout()
    } else {
      // Delegate to server route that builds the correct authorize URL and manages state cookie
      window.location.href = '/api/auth/login'
    }
  }

  return (
    <Button
      variant="outline"
      size="icon"
      className="rounded-full w-10 h-10 glass-button border-0 hover:bg-white/30 dark:hover:bg-white/15 transition-all duration-200 bg-transparent"
      onClick={handleAuth}
    >
      {isAuthenticated ? <LogOut className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
    </Button>
  )
}
