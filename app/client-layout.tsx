
"use client";
import TopRightActionIcons from "@/components/top-right-action-icons";
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

import type { ReactNode } from "react"
import { BottomNav } from "@/components/bottom-nav"
import { AppSidebar } from "@/components/app-sidebar"
import { ThemeProvider, UserSettingsProvider } from "@/components/theme-provider"
import { TimetableProvider } from "@/contexts/timetable-context"

export default function ClientLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Attempt a silent server-side refresh on initial load to restore session if possible
    fetch('/api/auth/refresh', { method: 'GET', credentials: 'include' })
      .then(res => res.json())
      .then(data => { if (!data.success) console.debug('auth refresh failed', data) })
      .catch(err => console.debug('auth refresh error', err))
  }, [])

  // Dynamic scaler: adjust root UI scale slightly when vertical space is constrained
  useEffect(() => {
    let raf = 0
    function adjustScale() {
      if (typeof window === 'undefined') return
      const doc = document.documentElement
      const body = document.body
      const vw = window.innerWidth
      // Only apply on large/wide viewports to avoid affecting mobile
      if (vw < 1200) {
        doc.style.setProperty('--ui-scale', '1')
        return
      }

      const clientH = window.innerHeight
      const contentH = Math.max(doc.scrollHeight, body.scrollHeight)

      if (contentH <= clientH) {
        doc.style.setProperty('--ui-scale', '1')
        return
      }

      // Compute needed scale but clamp between 0.85 and 1
      const needed = clientH / contentH
      const scale = Math.max(0.85, Math.min(1, needed))
      doc.style.setProperty('--ui-scale', String(scale))
    }

    function onResize() {
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(adjustScale)
    }

    adjustScale()
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)

    // Also observe DOM mutations that might change height (e.g., fonts load)
    const mo = new MutationObserver(() => onResize())
    mo.observe(document.body, { childList: true, subtree: true })

    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
      mo.disconnect()
      if (raf) cancelAnimationFrame(raf)
      document.documentElement.style.setProperty('--ui-scale', '1')
    }
  }, [])
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange={false}
      storageKey="chronicl-theme-preference"
    >
      <UserSettingsProvider>
        <TimetableProvider>
          {/* Add padding-left for desktop nav, keep padding-bottom for mobile nav */}
          {/* Only show the fixed top-right action icons on the home page to avoid duplication */}
          <ConditionalTopRightIcons />
          <AppSidebar />
          <div className="pl-20 sm:pl-24 lg:pl-28 pb-8 md:pb-10">{children}</div>
          <BottomNav />
        </TimetableProvider>
      </UserSettingsProvider>
    </ThemeProvider>
  )
}

function ConditionalTopRightIcons() {
  // usePathname is client-only and returns the current pathname. Only show the
  // global fixed icons on the home page ("/") per user request.
  const pathname = usePathname();
  if (!pathname) return null;
  return pathname === "/" ? <TopRightActionIcons /> : null;
}
