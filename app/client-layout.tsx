"use client"

import type { ReactNode } from "react"
import BottomNav from "@/components/bottom-nav"
import FloatingActionIcons from "@/components/floating-action-icons"
import { ThemeProvider, UserSettingsProvider } from "@/components/theme-provider"
import { TimetableProvider } from "@/contexts/timetable-context"

export default function ClientLayout({ children }: { children: ReactNode }) {
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
          <div className="pb-20 md:pb-0 md:pl-24">{children}</div>
          <FloatingActionIcons />
          <BottomNav />
        </TimetableProvider>
      </UserSettingsProvider>
    </ThemeProvider>
  )
}
