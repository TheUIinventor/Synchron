
"use client";
import TopRightActionIcons from "@/components/top-right-action-icons";
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

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
