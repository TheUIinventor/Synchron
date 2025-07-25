"use client"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/api/hooks"

export default function AuthButton() {
  const { isAuthenticated, logout, initiateLogin, loading } = useAuth()

  const handleAuthClick = async () => {
    if (isAuthenticated) {
      await logout()
    } else {
      await initiateLogin()
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="rounded-full h-10 px-4 text-sm glass-button border-0 hover:bg-white/30 dark:hover:bg-white/15 transition-all duration-200 bg-transparent"
      onClick={handleAuthClick}
      disabled={loading}
    >
      {loading ? (
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
      ) : isAuthenticated ? (
        "Logout"
      ) : (
        "Login"
      )}
    </Button>
  )
}
