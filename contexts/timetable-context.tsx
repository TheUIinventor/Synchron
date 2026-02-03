"use client"

import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from "react"
import { useToast } from "@/hooks/use-toast"
import { getTimeUntilNextPeriod, isSchoolDayOver, getNextSchoolDay, getCurrentDay } from "@/utils/time-utils"

// Simplified Period type
export type Period = {
  id?: number
  period: string
  time: string
  subject: string
  title?: string
  teacher: string
  room: string
  weekType?: "A" | "B"
  isSubstitute?: boolean
  isRoomChange?: boolean
  displayTeacher?: string
  displayRoom?: string
  originalRoom?: string
  colour?: string
}

// Simplified Bell Time type
export type BellTime = {
  period: string
  time: string
}

// Simplified context type
type TimetableContextType = {
  currentWeek: "A" | "B" | null
  selectedDay: string
  selectedDateObject: Date
  setSelectedDay: (day: string) => void
  setSelectedDateObject: (d: Date) => void
  timetableData: Record<string, Period[]>
  currentMomentPeriodInfo: {
    nextPeriod: Period | null
    timeUntil: string
    isCurrentlyInClass: boolean
    currentPeriod: Period | null
  }
  bellTimes: Record<string, BellTime[]>
  isShowingNextDay: boolean
  timetableSource?: string | null
  isLoading: boolean
  error: string | null
  refreshExternal?: () => Promise<void>
  isAuthenticated?: boolean | null
}

const TimetableContext = createContext<TimetableContextType | undefined>(undefined)

// Simplified bell times data
const bellTimesData = {
  "Mon/Tues": [
    { period: "Period 1", time: "9:00 - 10:05" },
    { period: "Period 2", time: "10:05 - 11:05" },
    { period: "Recess", time: "11:05 - 11:25" },
    { period: "Period 3", time: "11:25 - 12:30" },
    { period: "Period 4", time: "12:30 - 1:30" },
    { period: "Lunch 1", time: "1:30 - 1:50" },
    { period: "Lunch 2", time: "1:50 - 2:10" },
    { period: "Period 5", time: "2:10 - 3:10" },
  ],
  "Wed/Thurs": [
    { period: "Period 1", time: "9:00 - 10:05" },
    { period: "Period 2", time: "10:05 - 11:05" },
    { period: "Recess", time: "11:05 - 11:25" },
    { period: "Period 3", time: "11:25 - 12:25" },
    { period: "Lunch 1", time: "12:25 - 12:45" },
    { period: "Lunch 2", time: "12:45 - 1:05" },
    { period: "Period 4", time: "1:05 - 2:10" },
    { period: "Period 5", time: "2:10 - 3:10" },
  ],
  "Fri": [
    { period: "Period 1", time: "9:25 - 10:20" },
    { period: "Period 2", time: "10:20 - 11:10" },
    { period: "Recess", time: "11:10 - 11:40" },
    { period: "Period 3", time: "11:40 - 12:35" },
    { period: "Lunch 1", time: "12:35 - 12:55" },
    { period: "Lunch 2", time: "12:55 - 1:15" },
    { period: "Period 4", time: "1:15 - 2:15" },
    { period: "Period 5", time: "2:15 - 3:10" },
  ]
}

// Simplified sample timetable
const sampleTimetable = {
  Monday: [
    { period: "1", time: "9:00 - 10:05", subject: "English", teacher: "Ms. Smith", room: "301" },
    { period: "2", time: "10:05 - 11:05", subject: "Mathematics", teacher: "Mr. Johnson", room: "304" },
    { period: "Recess", time: "11:05 - 11:25", subject: "Break", teacher: "", room: "" },
    { period: "3", time: "11:25 - 12:30", subject: "Science", teacher: "Dr. Williams", room: "402" },
    { period: "4", time: "12:30 - 1:30", subject: "History", teacher: "Mr. Brown", room: "205" },
    { period: "Lunch 1", time: "1:30 - 1:50", subject: "Break", teacher: "", room: "" },
    { period: "Lunch 2", time: "1:50 - 2:10", subject: "Break", teacher: "", room: "" },
    { period: "5", time: "2:10 - 3:10", subject: "Geography", teacher: "Ms. Taylor", room: "207" },
  ],
  Tuesday: [
    { period: "1", time: "9:00 - 10:05", subject: "Mathematics", teacher: "Mr. Johnson", room: "304" },
    { period: "2", time: "10:05 - 11:05", subject: "English", teacher: "Ms. Smith", room: "301" },
    { period: "Recess", time: "11:05 - 11:25", subject: "Break", teacher: "", room: "" },
    { period: "3", time: "11:25 - 12:30", subject: "History", teacher: "Mr. Brown", room: "205" },
    { period: "4", time: "12:30 - 1:30", subject: "Science", teacher: "Dr. Williams", room: "402" },
    { period: "Lunch 1", time: "1:30 - 1:50", subject: "Break", teacher: "", room: "" },
    { period: "Lunch 2", time: "1:50 - 2:10", subject: "Break", teacher: "", room: "" },
    { period: "5", time: "2:10 - 3:10", subject: "Computing", teacher: "Ms. Lee", room: "405" },
  ],
  Wednesday: [
    { period: "1", time: "9:00 - 10:05", subject: "Science", teacher: "Dr. Williams", room: "Lab 2" },
    { period: "2", time: "10:05 - 11:05", subject: "Mathematics", teacher: "Mr. Johnson", room: "304" },
    { period: "Recess", time: "11:05 - 11:25", subject: "Break", teacher: "", room: "" },
    { period: "3", time: "11:25 - 12:25", subject: "English", teacher: "Ms. Smith", room: "301" },
    { period: "Lunch 1", time: "12:25 - 12:45", subject: "Break", teacher: "", room: "" },
    { period: "Lunch 2", time: "12:45 - 1:05", subject: "Break", teacher: "", room: "" },
    { period: "4", time: "1:05 - 2:10", subject: "Geography", teacher: "Ms. Taylor", room: "207" },
    { period: "5", time: "2:10 - 3:10", subject: "Computing", teacher: "Ms. Lee", room: "405" },
  ],
  Thursday: [
    { period: "1", time: "9:00 - 10:05", subject: "English", teacher: "Ms. Smith", room: "301" },
    { period: "2", time: "10:05 - 11:05", subject: "Geography", teacher: "Ms. Taylor", room: "207" },
    { period: "Recess", time: "11:05 - 11:25", subject: "Break", teacher: "", room: "" },
    { period: "3", time: "11:25 - 12:25", subject: "History", teacher: "Mr. Brown", room: "205" },
    { period: "Lunch 1", time: "12:25 - 12:45", subject: "Break", teacher: "", room: "" },
    { period: "Lunch 2", time: "12:45 - 1:05", subject: "Break", teacher: "", room: "" },
    { period: "4", time: "1:05 - 2:10", subject: "Computing", teacher: "Ms. Lee", room: "405" },
    { period: "5", time: "2:10 - 3:10", subject: "Science", teacher: "Dr. Williams", room: "402" },
  ],
  Friday: [
    { period: "1", time: "9:25 - 10:20", subject: "Mathematics", teacher: "Mr. Johnson", room: "304" },
    { period: "2", time: "10:20 - 11:10", subject: "History", teacher: "Mr. Brown", room: "205" },
    { period: "Recess", time: "11:10 - 11:40", subject: "Break", teacher: "", room: "" },
    { period: "3", time: "11:40 - 12:35", subject: "Science", teacher: "Dr. Williams", room: "Lab 2" },
    { period: "Lunch 1", time: "12:35 - 12:55", subject: "Break", teacher: "", room: "" },
    { period: "Lunch 2", time: "12:55 - 1:15", subject: "Break", teacher: "", room: "" },
    { period: "4", time: "1:15 - 2:15", subject: "Music", teacher: "Mr. Anderson", room: "501" },
    { period: "5", time: "2:15 - 3:10", subject: "Geography", teacher: "Ms. Taylor", room: "207" },
  ],
}

export function TimetableProvider({ children }: { children: ReactNode }) {
  // Simplified state management
  const [currentWeek, setCurrentWeek] = useState<"A" | "B" | null>("A")
  const [selectedDay, setSelectedDay] = useState<string>("")
  const [selectedDateObject, setSelectedDateObject] = useState<Date>(() => new Date())
  const [isShowingNextDay, setIsShowingNextDay] = useState(false)
  const [externalTimetable, setExternalTimetable] = useState<Record<string, Period[]> | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const { toast } = useToast()
  
  // Refs for managing intervals without memory leaks
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const timeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Load cached timetable on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem('synchron-last-timetable')
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed?.timetable) {
          setExternalTimetable(parsed.timetable)
        }
      }
    } catch (e) {
      console.warn('Failed to load cached timetable:', e)
    }
  }, [])

  // Simple timetable data computation
  const timetableData: Record<string, Period[]> = useMemo(() => {
    if (externalTimetable) {
      return externalTimetable
    }
    return sampleTimetable
  }, [externalTimetable])

  // Simplified current period info
  const [currentMomentPeriodInfo, setCurrentMomentPeriodInfo] = useState(() => ({
    nextPeriod: null as Period | null,
    timeUntil: "",
    isCurrentlyInClass: false,
    currentPeriod: null as Period | null,
  }))

  // Update current period info
  const updateCurrentPeriodInfo = useCallback(() => {
    try {
      const today = getCurrentDay()
      const todayPeriods = timetableData[today] || []
      const info = getTimeUntilNextPeriod(todayPeriods as any)
      setCurrentMomentPeriodInfo(info as any)
    } catch (e) {
      console.warn('Failed to update period info:', e)
    }
  }, [timetableData])

  // Set up time updates with proper cleanup
  useEffect(() => {
    updateCurrentPeriodInfo()
    
    if (timeUpdateIntervalRef.current) {
      clearInterval(timeUpdateIntervalRef.current)
    }
    
    timeUpdateIntervalRef.current = setInterval(updateCurrentPeriodInfo, 30000) // Update every 30s
    
    return () => {
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current)
        timeUpdateIntervalRef.current = null
      }
    }
  }, [updateCurrentPeriodInfo])

  // Simplified refresh function
  const refreshExternal = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    setError(null)
    
    try {
      const dateStr = selectedDateObject.toISOString().slice(0, 10)
      const response = await fetch(`/api/timetable?date=${dateStr}`, {
        credentials: 'include'
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch timetable: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data?.timetable) {
        setExternalTimetable(data.timetable)
        
        // Cache the result
        const cacheData = {
          timetable: data.timetable,
          source: 'external',
          savedAt: new Date().toISOString(),
        }
        localStorage.setItem('synchron-last-timetable', JSON.stringify(cacheData))
      }
      
      if (data?.weekType) {
        setCurrentWeek(data.weekType)
      }
      
    } catch (err) {
      console.error('Failed to refresh timetable:', err)
      setError(err instanceof Error ? err.message : 'Failed to refresh timetable')
      toast({
        title: "Error",
        description: "Failed to refresh timetable",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [selectedDateObject, toast])

  // Set up background refresh with proper cleanup
  useEffect(() => {
    // Initial load
    if (!externalTimetable) {
      refreshExternal()
    }
    
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current)
    }
    
    // Refresh every 5 minutes when tab is visible
    refreshIntervalRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshExternal()
      }
    }, 5 * 60 * 1000)
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
        refreshIntervalRef.current = null
      }
    }
  }, [refreshExternal, externalTimetable])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current)
      }
    }
  }, [])

  const value: TimetableContextType = {
    currentWeek,
    selectedDay,
    selectedDateObject,
    setSelectedDay,
    setSelectedDateObject,
    timetableData,
    currentMomentPeriodInfo,
    bellTimes: bellTimesData,
    isShowingNextDay,
    timetableSource: externalTimetable ? 'external' : 'sample',
    isLoading,
    error,
    refreshExternal,
    isAuthenticated,
  }

  return (
    <TimetableContext.Provider value={value}>
      {children}
    </TimetableContext.Provider>
  )
}

export function useTimetable() {
  const context = useContext(TimetableContext)
  if (context === undefined) {
    throw new Error('useTimetable must be used within a TimetableProvider')
  }
  return context
}

// Safe version that returns null if not in provider (used by settings page)
export function useTimetableSafe() {
  const context = useContext(TimetableContext)
  return context || null
}