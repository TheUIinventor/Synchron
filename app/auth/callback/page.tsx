"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/api/hooks"
import { Card, CardContent } from "@/components/ui/card"
import { School, CheckCircle, XCircle } from "lucide-react"
import PageTransition from "@/components/page-transition"

export default function AuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { handleCallback } = useAuth()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [error, setError] = useState<string>("")

  useEffect(() => {
    const code = searchParams.get("code")
    const state = searchParams.get("state")
    const errorParam = searchParams.get("error")

    if (errorParam) {
      setStatus("error")
      setError("Authentication was cancelled or failed")
      return
    }

    if (!code || !state) {
      setStatus("error")
      setError("Invalid authentication response")
      return
    }

    const processCallback = async () => {
      try {
        const response = await handleCallback(code, state)
        if (response.success) {
          setStatus("success")
          // Redirect to home after a brief success message
          setTimeout(() => {
            router.push("/")
          }, 2000)
        } else {
          setStatus("error")
          setError(response.error || "Authentication failed")
        }
      } catch (err) {
        setStatus("error")
        setError("An unexpected error occurred")
      }
    }

    processCallback()
  }, [searchParams, handleCallback, router])

  return (
    <PageTransition>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <Card className="w-full max-w-md rounded-[1.5rem] shadow-lg">
          <CardContent className="p-8">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-theme-secondary rounded-full flex items-center justify-center mb-4">
                <School className="h-8 w-8 text-theme-primary" />
              </div>
              <h1 className="text-2xl font-bold theme-gradient mb-6">Synchron</h1>

              {status === "loading" && (
                <div className="space-y-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-theme-primary mx-auto"></div>
                  <p className="text-gray-600 dark:text-gray-400">Completing sign in...</p>
                </div>
              )}

              {status === "success" && (
                <div className="space-y-4">
                  <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
                      Sign in successful!
                    </h2>
                    <p className="text-sm text-green-700 dark:text-green-300">Redirecting you to the app...</p>
                  </div>
                </div>
              )}

              {status === "error" && (
                <div className="space-y-4">
                  <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                    <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">Sign in failed</h2>
                    <p className="text-sm text-red-700 dark:text-red-300 mb-4">{error}</p>
                    <button
                      onClick={() => router.push("/auth")}
                      className="text-sm text-theme-primary hover:opacity-80 transition-opacity"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  )
}
