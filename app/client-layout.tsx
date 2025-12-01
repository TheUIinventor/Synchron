
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
  const pathname = usePathname();
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
      // Apply a small page-specific multiplier on the home page to trim
      // vertical space (5% reduction) — this only affects the home route.
      const isHome = typeof window !== 'undefined' && (pathname === '/' || pathname === '')
      const pageMultiplier = isHome ? 0.90 : 1
      const scale = Math.max(0.85, Math.min(1, needed * pageMultiplier))
      // Only update the property when it actually changes to avoid layout thrash
      const prev = doc.style.getPropertyValue('--ui-scale') || ''
      if (prev !== String(scale)) doc.style.setProperty('--ui-scale', String(scale))
    }

    function onResize() {
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(adjustScale)
    }

    // Run initial adjustment immediately, then re-run after short delays to
    // accommodate late-loading fonts/images and small DOM mutations that can
    // change layout height. This reduces flicker where a single early measurement
    // flips the scale then resets on subsequent layout passes.
    adjustScale()
    const t1 = setTimeout(adjustScale, 200)
    const t2 = setTimeout(adjustScale, 800)
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
      clearTimeout(t1)
      clearTimeout(t2)
      // Reset the scale when unmounting to avoid leaking into other pages
      document.documentElement.style.setProperty('--ui-scale', '1')
    }
  }, [pathname])
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange={false}
      storageKey="synchron-theme-preference"
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
