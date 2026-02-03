"use client"

import TopRightActionIcons from "@/components/top-right-action-icons"
import LoginPopup from "@/components/login-popup"
import LoginPromptBanner from "@/components/login-prompt-banner"
import { initAuthBlocking } from './init-auth'
import { useEffect, useState, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'

import type { ReactNode } from "react"
import { BottomNav } from "@/components/bottom-nav"
import { AppSidebar } from "@/components/app-sidebar"
import { ThemeProvider, UserSettingsProvider } from "@/components/theme-provider"
import { TimetableProvider } from "@/contexts/timetable-context"
import { QueryClientProviderWrapper } from '@/lib/query-client'
import ErrorBoundary from "@/components/error-boundary"

export default function ClientLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { toast } = useToast()
  const [authInitialized, setAuthInitialized] = useState(false)

  // Simplified auth initialization - run once
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    let mounted = true
    
    // Disable excessive logging in production
    try {
      const devLogs = localStorage.getItem('synchron:dev-logs') === 'true'
      if (!devLogs) {
        const noop = () => {}
        console.log = noop
        console.debug = noop
        console.info = noop
      }
    } catch (e) {}

    // Initialize auth once
    initAuthBlocking()
      .then(() => {
        if (mounted) {
          setAuthInitialized(true)
        }
      })
      .catch((e) => {
        console.error('Auth initialization failed:', e)
        if (mounted) {
          setAuthInitialized(true)
        }
      })

    return () => {
      mounted = false
    }
  }, [])

  // Simple background refresh - only when user is authenticated and tab is visible
  useEffect(() => {
    if (!authInitialized) return
    if (typeof window === 'undefined') return

    let refreshInterval: NodeJS.Timeout | null = null

    const startRefresh = () => {
      if (refreshInterval) clearInterval(refreshInterval)
      
      refreshInterval = setInterval(() => {
        try {
          const loggedIn = sessionStorage.getItem('synchron:user-logged-in') === 'true'
          if (loggedIn && document.visibilityState === 'visible') {
            window.dispatchEvent(new CustomEvent('synchron:background-refresh'))
          }
        } catch (e) {}
      }, 5 * 60 * 1000) // Every 5 minutes
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        startRefresh()
      } else if (refreshInterval) {
        clearInterval(refreshInterval)
        refreshInterval = null
      }
    }

    // Start if visible
    if (document.visibilityState === 'visible') {
      startRefresh()
    }

    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      if (refreshInterval) clearInterval(refreshInterval)
    }
  }, [authInitialized])

  // Clean URL params from OAuth redirects  
  useEffect(() => {
    try {
      if (pathname === '/' && window.location.search.includes('code=')) {
        window.history.replaceState({}, document.title, window.location.pathname)
      }
    } catch (e) {}
  }, [pathname])

  // Handle logout confirmation
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const params = new URLSearchParams(window.location.search)
      const loggedOut = params.get('logged_out') === 'true'
      if (loggedOut) {
        toast({ 
          title: 'Signed out', 
          description: 'You have been logged out.' 
        })
        window.history.replaceState({}, document.title, window.location.pathname)
      }
    } catch (e) {}
  }, [toast])

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange={false}
      storageKey="synchron-theme-preference"
    >
      <UserSettingsProvider>
        <ErrorBoundary>
          <QueryClientProviderWrapper>
            <TimetableProvider>
              <ConditionalTopRightIcons />
              {pathname !== '/' && <LoginPromptBanner />}
              <LoginPopup />
              <AppSidebar />
              <div className="px-2 sm:px-3 md:pl-20 lg:pl-28 pb-8 md:pb-10">
                {children}
              </div>
              <BottomNav />
            </TimetableProvider>
          </QueryClientProviderWrapper>
        </ErrorBoundary>
      </UserSettingsProvider>
    </ThemeProvider>
  )
}

function ConditionalTopRightIcons() {
  const pathname = usePathname()
  if (!pathname) return null
  return pathname === "/" ? <TopRightActionIcons /> : null
}