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
      // Otherwise, we need to handle the login process.
      // We get the necessary environment variables for the URL.
      const clientId = process.env.NEXT_PUBLIC_SBHS_APP_ID
      const redirectUri = process.env.NODE_ENV === "development"
        ? process.env.NEXT_PUBLIC_SBHS_REDIRECT_URI_LOCAL
        : process.env.NEXT_PUBLIC_SBHS_REDIRECT_URI_VERCEL

      // We check if the required variables are set.
      // Instead of an alert, which can be disruptive, we log an error to the console.
      if (!clientId || !redirectUri) {
        console.error("Authentication configuration error: App ID or Redirect URI is not configured.")
        return
      }
      
      // We'll use URLSearchParams to build the URL's query string.
      // This is safer and more readable than manual string concatenation.
      const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: "all-ro"
      });

      // We construct the final authorization URL with the correct base and parameters.
      const authUrl = `https://auth.sbhs.net.au/authorize?${params.toString()}`;

      // This performs the redirect to the authorization server.
      window.location.href = authUrl;
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
