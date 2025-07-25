"use client"

import { useState, useEffect, useCallback } from "react"
import { sbhsPortal, type ApiResponse } from "./client"

// Generic hook for portal data fetching
function usePortalData<T>(dataFetcher: () => Promise<ApiResponse<T>>, dependencies: any[] = [], immediate = true) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(immediate)
  const [error, setError] = useState<string | null>(null)

  const execute = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await dataFetcher()
      if (response.success && response.data) {
        setData(response.data)
      } else {
        setError(response.error || "Failed to fetch data")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error")
    } finally {
      setLoading(false)
    }
  }, dependencies)

  useEffect(() => {
    if (immediate && sbhsPortal.isAuthenticated()) {
      execute()
    }
  }, [execute, immediate])

  return { data, loading, error, refetch: execute }
}

// Student Profile Hook
export function useStudentProfile() {
  return usePortalData(() => sbhsPortal.getStudentProfile())
}

// Timetable Hook
export function useTimetable(week?: "A" | "B") {
  return usePortalData(() => sbhsPortal.getTimetable(week), [week])
}

// Daily Notices Hook
export function useDailyNotices(date?: string) {
  return usePortalData(() => sbhsPortal.getDailyNotices(date), [date])
}

// Bell Times Hook
export function useBellTimes() {
  return usePortalData(() => sbhsPortal.getBellTimes())
}

// Award Points Hook
export function useAwardPoints() {
  return usePortalData(() => sbhsPortal.getAwardPoints())
}

// Calendar Events Hook
export function useCalendarEvents(startDate?: string, endDate?: string) {
  return usePortalData(() => sbhsPortal.getCalendarEvents(startDate, endDate), [startDate, endDate])
}

// Authentication Hook
export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setIsAuthenticated(sbhsPortal.isAuthenticated())
    setLoading(false)
  }, [])

  const initiateLogin = async () => {
    const loginUrl = await sbhsPortal.initiateLogin()
    window.location.href = loginUrl
  }

  const handleCallback = async (code: string, state: string) => {
    setLoading(true)
    const response = await sbhsPortal.handleAuthCallback(code, state)
    if (response.success) {
      setIsAuthenticated(true)
    }
    setLoading(false)
    return response
  }

  const logout = async () => {
    await sbhsPortal.logout()
    setIsAuthenticated(false)
  }

  return {
    isAuthenticated,
    loading,
    initiateLogin,
    handleCallback,
    logout,
  }
}
