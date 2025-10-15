
"use client";
import TopRightActionIcons from "@/components/top-right-action-icons";

import type { ReactNode } from "react"
import BottomNav from "@/components/bottom-nav"
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
          <TopRightActionIcons />
          <div className="pb-20 md:pb-0 md:pl-24">{children}</div>
          <BottomNav />
        </TimetableProvider>
      </UserSettingsProvider>
    </ThemeProvider>
  )
}
