"use client"

import React from "react"
import { useEffect, useState } from "react"

// Hook to determine whether the login prompt should be shown.
export function useLoginPromptVisible() {
  const [visible, setVisible] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = localStorage.getItem('synchron-last-timetable')
      if (!raw) {
        setChecked(true)
        return
      }
    } catch (e) {
      setChecked(true)
      return
    }

    // Prefer quick session cache if init-auth already ran
    try {
      const ready = sessionStorage.getItem('synchron:userinfo-ready')
      const loggedIn = sessionStorage.getItem('synchron:user-logged-in')
      if (ready === 'true' && loggedIn === 'false') {
        setVisible(true)
        setChecked(true)
        return
      }
    } catch (e) {}

    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/portal/userinfo', { credentials: 'include' })
        const ctype = res.headers.get('content-type') || ''
        if (!mounted) return
        if (!res.ok) {
          // If 401 and exact missing-token message, show banner
          try {
            if (ctype.includes('application/json')) {
              const j = await res.json()
              if (j && j.success === false && typeof j.error === 'string' && j.error.includes('Missing SBHS access token')) {
                setVisible(true)
              }
            }
          } catch (e) {
            // ignore parse errors
          }
        }
      } catch (e) {
        // network errors -> don't show banner
      } finally {
        setChecked(true)
      }
    })()

    return () => { mounted = false }
  }, [])

  return { visible, checked }
}

// Default component: fixed top-right banner variant
export default function LoginPromptBanner() {
  const { visible } = useLoginPromptVisible()
  if (!visible) return null
  return (
    <div className="fixed top-4 right-4 z-50">
      <a
        href="/api/auth/login"
        className="inline-flex items-center gap-2 bg-destructive text-destructive-foreground px-3 py-1.5 rounded-md text-sm font-medium shadow-md hover:brightness-95 transition"
        aria-label="Log in to see latest data"
        title="Log in to see latest data"
      >
        Log in to see latest data
      </a>
    </div>
  )
}
