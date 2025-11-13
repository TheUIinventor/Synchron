"use client"

import { LogIn, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/api/hooks"
import { cn } from "@/lib/utils"

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
      size={isAuthenticated ? "default" : "icon"}
      className={cn(
        "glass-button border-0 hover:bg-white/30 dark:hover:bg-white/15 transition-all duration-200 bg-transparent",
        isAuthenticated ? "rounded-full px-3 h-10" : "rounded-full w-10 h-10"
      )}
      onClick={handleAuth}
    >
      {isAuthenticated ? (
        <div className="flex items-center gap-2">
          <LogOut className="h-4 w-4" />
          <span className="whitespace-nowrap">Log out</span>
        </div>
      ) : (
        <LogIn className="h-4 w-4" />
      )}
    </Button>
  )
}
