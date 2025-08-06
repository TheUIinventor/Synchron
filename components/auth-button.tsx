// components/auth-button.tsx
"use client"

import { LogIn, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/api/hooks"

export function AuthButton() {
  const { isAuthenticated, initiateLogin, logout } = useAuth()

  // This onClick handler contains the client-side logic
  const handleAuth = () => {
    if (isAuthenticated) {
      logout()
    } else {
      const clientId = process.env.NEXT_PUBLIC_SBHS_APP_ID
      const redirectUri = process.env.NODE_ENV === "development"
        ? process.env.NEXT_PUBLIC_SBHS_REDIRECT_URI_LOCAL
        : process.env.NEXT_PUBLIC_SBHS_REDIRECT_URI_VERCEL

      if (!clientId || !redirectUri) {
        alert("App ID or Redirect URI is not configured.")
        return
      }

      const authUrl = `https://studentportal.sydneyboys-h.schools.nsw.edu.au/oauth/authorize?` +
        `response_type=code&` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=all-ro`

      window.location.href = authUrl
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