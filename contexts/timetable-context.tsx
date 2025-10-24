"use client"

import { createContext, useContext, useState, useEffect, useMemo, useCallback, type ReactNode } from "react"
import { getTimeUntilNextPeriod, isSchoolDayOver, getNextSchoolDay, getCurrentDay } from "@/utils/time-utils"

// Define the period type
export type Period = {
  id?: number
  period: string
  time: string
  subject: string
  teacher: string
  room: string
  isSubstitute?: boolean // New: Indicates a substitute teacher
  isRoomChange?: boolean // New: Indicates a room change
}

// Define the bell time type
export type BellTime = {
  period: string
  time: string
}

// Define the timetable context type
type TimetableContextType = {
  currentWeek: "A" | "B"
  setCurrentWeek: (week: "A" | "B") => void
  selectedDay: string // Day for the main timetable display (e.g., "Monday")
  selectedDateObject: Date // The actual Date object for the selectedDay
  setSelectedDay: (day: string) => void
  timetableData: Record<string, Period[]>
  currentMomentPeriodInfo: {
    // Renamed from nextPeriodInfo to be clearer
    nextPeriod: Period | null
    timeUntil: string
    isCurrentlyInClass: boolean
    currentPeriod: Period | null
  }
  // Backwards-compatible alias name used across older components
  nextPeriodInfo?: {
    nextPeriod: Period | null
    timeUntil: string
    isCurrentlyInClass: boolean
    currentPeriod: Period | null
  }
  bellTimes: Record<string, BellTime[]>
  isShowingNextDay: boolean // Indicates if the main timetable is showing next day
  timetableSource?: string | null // indicates where timetable data came from (e.g. 'fallback-sample' or external url)
}

// Create the context
const TimetableContext = createContext<TimetableContextType | undefined>(undefined)

// Updated bell times for different day groups
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
    { period: "End of Day", time: "3:10" },
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
    { period: "End of Day", time: "3:10" },
  ],
  Fri: [
    { period: "Period 1", time: "9:25 - 10:20" },
    { period: "Period 2", time: "10:20 - 11:10" },
    { period: "Recess", time: "11:10 - 11:40" },
    { period: "Period 3", time: "11:40 - 12:35" },
    { period: "Lunch 1", time: "12:35 - 12:55" },
    { period: "Lunch 2", time: "12:55 - 1:15" },
    { period: "Period 4", time: "1:15 - 2:15" },
    { period: "Period 5", time: "2:15 - 3:10" },
    { period: "End of Day", time: "3:10" },
  ],
}

// Mock data for the timetable - memoized
const timetableWeekA = {
  Monday: [
    { id: 1, period: "1", time: "9:00 - 10:05", subject: "English", teacher: "Ms. Smith", room: "301" },
    { id: 2, period: "2", time: "10:05 - 11:05", subject: "Mathematics", teacher: "Mr. Johnson", room: "304" },
    { id: 3, period: "Recess", time: "11:05 - 11:25", subject: "Break", teacher: "", room: "" },
    { id: 4, period: "3", time: "11:25 - 12:30", subject: "Science", teacher: "Dr. Williams", room: "402" },
    {
      id: 5,
      period: "4",
      time: "12:30 - 1:30",
      subject: "History",
      teacher: "Mr. Brown",
      room: "205",
      isSubstitute: true,
    }, // Demo substitute
    { id: 6, period: "Lunch 1", time: "1:30 - 1:50", subject: "Break", teacher: "", room: "" },
    { id: 7, period: "Lunch 2", time: "1:50 - 2:10", subject: "Break", teacher: "", room: "" },
    { id: 8, period: "5", time: "2:10 - 3:10", subject: "PE", teacher: "Mr. Davis", room: "101", isRoomChange: true }, // Demo room change
  ],
  Tuesday: [
    { id: 1, period: "1", time: "9:00 - 10:05", subject: "Mathematics", teacher: "Mr. Johnson", room: "304" },
    { id: 2, period: "2", time: "10:05 - 11:05", subject: "Science", teacher: "Dr. Williams", room: "402" },
    { id: 3, period: "Recess", time: "11:05 - 11:25", subject: "Break", teacher: "", room: "" },
    { id: 4, period: "3", time: "11:25 - 12:30", subject: "English", teacher: "Ms. Smith", room: "301" },
    { id: 5, period: "4", time: "12:30 - 1:30", subject: "Geography", teacher: "Ms. Taylor", room: "207" },
    { id: 6, period: "Lunch 1", time: "1:30 - 1:50", subject: "Break", teacher: "", room: "" },
    { id: 7, period: "Lunch 2", time: "1:50 - 2:10", subject: "Break", teacher: "", room: "" },
    { id: 8, period: "5", time: "2:10 - 3:10", subject: "Music", teacher: "Mr. Anderson", room: "501" },
  ],
  Wednesday: [
    { id: 1, period: "1", time: "9:00 - 10:05", subject: "History", teacher: "Mr. Brown", room: "205" },
    { id: 2, period: "2", time: "10:05 - 11:05", subject: "English", teacher: "Ms. Smith", room: "301" },
    { id: 3, period: "Recess", time: "11:05 - 11:25", subject: "Break", teacher: "", room: "" },
    { id: 4, period: "3", time: "11:25 - 12:25", subject: "Mathematics", teacher: "Mr. Johnson", room: "304" },
    { id: 5, period: "Lunch 1", time: "12:25 - 12:45", subject: "Break", teacher: "", room: "" },
    { id: 6, period: "Lunch 2", time: "12:45 - 1:05", subject: "Break", teacher: "", room: "" },
    { id: 7, period: "4", time: "1:05 - 2:10", subject: "Science", teacher: "Dr. Williams", room: "402" },
    { id: 8, period: "5", time: "2:10 - 3:10", subject: "Geography", teacher: "Ms. Taylor", room: "207" },
  ],
  Thursday: [
    { id: 1, period: "1", time: "9:00 - 10:05", subject: "Science", teacher: "Dr. Williams", room: "Lab 2" },
    { id: 2, period: "2", time: "10:05 - 11:05", subject: "History", teacher: "Mr. Brown", room: "205" },
    { id: 3, period: "Recess", time: "11:05 - 11:25", subject: "Break", teacher: "", room: "" },
    { id: 4, period: "3", time: "11:25 - 12:25", subject: "Geography", teacher: "Ms. Taylor", room: "207" },
    { id: 5, period: "Lunch 1", time: "12:25 - 12:45", subject: "Break", teacher: "", room: "" },
    { id: 6, period: "Lunch 2", time: "12:45 - 1:05", subject: "Break", teacher: "", room: "" },
    { id: 7, period: "4", time: "1:05 - 2:10", subject: "English", teacher: "Ms. Smith", room: "301" },
    { id: 8, period: "5", time: "2:10 - 3:10", subject: "Computing", teacher: "Ms. Lee", room: "405" },
  ],
  Friday: [
    { id: 1, period: "1", time: "9:25 - 10:20", subject: "PE", teacher: "Mr. Davis", room: "101" },
    { id: 2, period: "2", time: "10:20 - 11:10", subject: "Computing", teacher: "Ms. Lee", room: "Computer Lab" },
    { id: 3, period: "Recess", time: "11:10 - 11:40", subject: "Break", teacher: "", room: "" },
    { id: 4, period: "3", time: "11:40 - 12:35", subject: "Music", teacher: "Mr. Anderson", room: "501" },
    { id: 5, period: "Lunch 1", time: "12:35 - 12:55", subject: "Break", teacher: "", room: "" },
    { id: 6, period: "Lunch 2", time: "12:55 - 1:15", subject: "Break", teacher: "", room: "" },
    { id: 7, period: "4", time: "1:15 - 2:15", subject: "Mathematics", teacher: "Mr. Johnson", room: "304" },
    { id: 8, period: "5", time: "2:15 - 3:10", subject: "Art", teacher: "Ms. Wilson", room: "505" },
  ],
}

const timetableWeekB = {
  Monday: [
    { id: 1, period: "1", time: "9:00 - 10:05", subject: "Geography", teacher: "Ms. Taylor", room: "207" },
    { id: 2, period: "2", time: "10:05 - 11:05", subject: "Art", teacher: "Ms. Wilson", room: "Art Studio" },
    { id: 3, period: "Recess", time: "11:05 - 11:25", subject: "Break", teacher: "", room: "" },
    { id: 4, period: "3", time: "11:25 - 12:30", subject: "Computing", teacher: "Ms. Lee", room: "Computer Lab" },
    { id: 5, period: "4", time: "12:30 - 1:30", subject: "PE", teacher: "Mr. Davis", room: "101" },
    { id: 6, period: "Lunch 1", time: "1:30 - 1:50", subject: "Break", teacher: "", room: "" },
    { id: 7, period: "Lunch 2", time: "1:50 - 2:10", subject: "Break", teacher: "", room: "" },
    { id: 8, period: "5", time: "2:10 - 3:10", subject: "Mathematics", teacher: "Mr. Johnson", room: "304" },
  ],
  Tuesday: [
    { id: 1, period: "1", time: "9:00 - 10:05", subject: "Music", teacher: "Mr. Anderson", room: "501" },
    { id: 2, period: "2", time: "10:05 - 11:05", subject: "PE", teacher: "Mr. Davis", room: "101" },
    { id: 3, period: "Recess", time: "11:05 - 11:25", subject: "Break", teacher: "", room: "" },
    { id: 4, period: "3", time: "11:25 - 12:30", subject: "Art", teacher: "Ms. Wilson", room: "505" },
    { id: 5, period: "4", time: "12:30 - 1:30", subject: "Science", teacher: "Dr. Williams", room: "Lab 2" },
    { id: 6, period: "Lunch 1", time: "1:30 - 1:50", subject: "Break", teacher: "", room: "" },
    { id: 7, period: "Lunch 2", time: "1:50 - 2:10", subject: "Break", teacher: "", room: "" },
    { id: 8, period: "5", time: "2:10 - 3:10", subject: "History", teacher: "Mr. Brown", room: "205" },
  ],
  Wednesday: [
    { id: 1, period: "1", time: "9:00 - 10:05", subject: "Computing", teacher: "Ms. Lee", room: "405" },
    { id: 2, period: "2", time: "10:05 - 11:05", subject: "Music", teacher: "Mr. Anderson", room: "501" },
    { id: 3, period: "Recess", time: "11:05 - 11:25", subject: "Break", teacher: "", room: "" },
    { id: 4, period: "3", time: "11:25 - 12:25", subject: "PE", teacher: "Mr. Davis", room: "101" },
    { id: 5, period: "Lunch 1", time: "12:25 - 12:45", subject: "Break", teacher: "", room: "" },
    { id: 6, period: "Lunch 2", time: "12:45 - 1:05", subject: "Break", teacher: "", room: "" },
    { id: 7, period: "4", time: "1:05 - 2:10", subject: "Art", teacher: "Ms. Wilson", room: "505" },
    { id: 8, period: "5", time: "2:10 - 3:10", subject: "English", teacher: "Ms. Smith", room: "301" },
  ],
  Thursday: [
    { id: 1, period: "1", time: "9:00 - 10:05", subject: "English", teacher: "Ms. Smith", room: "301" },
    { id: 2, period: "2", time: "10:05 - 11:05", subject: "Geography", teacher: "Ms. Taylor", room: "207" },
    { id: 3, period: "Recess", time: "11:05 - 11:25", subject: "Break", teacher: "", room: "" },
    { id: 4, period: "3", time: "11:25 - 12:25", subject: "History", teacher: "Mr. Brown", room: "205" },
    { id: 5, period: "Lunch 1", time: "12:25 - 12:45", subject: "Break", teacher: "", room: "" },
    { id: 6, period: "Lunch 2", time: "12:45 - 1:05", subject: "Break", teacher: "", room: "" },
    { id: 7, period: "4", time: "1:05 - 2:10", subject: "Computing", teacher: "Ms. Lee", room: "405" },
    { id: 8, period: "5", time: "2:10 - 3:10", subject: "Science", teacher: "Dr. Williams", room: "402" },
  ],
  Friday: [
    { id: 1, period: "1", time: "9:25 - 10:20", subject: "Mathematics", teacher: "Mr. Johnson", room: "304" },
    { id: 2, period: "2", time: "10:20 - 11:10", subject: "History", teacher: "Mr. Brown", room: "205" },
    { id: 3, period: "Recess", time: "11:10 - 11:40", subject: "Break", teacher: "", room: "" },
    { id: 4, period: "3", time: "11:40 - 12:35", subject: "Science", teacher: "Dr. Williams", room: "Lab 2" },
    { id: 5, period: "Lunch 1", time: "12:35 - 12:55", subject: "Break", teacher: "", room: "" },
    { id: 6, period: "Lunch 2", time: "12:55 - 1:15", subject: "Break", teacher: "", room: "" },
    { id: 7, period: "4", time: "1:15 - 2:15", subject: "Music", teacher: "Mr. Anderson", room: "501" },
    { id: 8, period: "5", time: "2:15 - 3:10", subject: "Geography", teacher: "Ms. Taylor", room: "207" },
  ],
}

// Create the provider component
export function TimetableProvider({ children }: { children: ReactNode }) {
  const [currentWeek, setCurrentWeek] = useState<"A" | "B">("A")
  const [selectedDay, setSelectedDay] = useState<string>("") // Day for main timetable
  const [selectedDateObject, setSelectedDateObject] = useState<Date>(new Date()) // Date object for selectedDay
  const [isShowingNextDay, setIsShowingNextDay] = useState(false) // For main timetable
  const [currentMomentPeriodInfo, setCurrentMomentPeriodInfo] = useState({
    // For header status
    nextPeriod: null as Period | null,
    timeUntil: "",
    isCurrentlyInClass: false,
    currentPeriod: null as Period | null,
  })

  // Memoize the current timetable based on selected week
  const [externalTimetable, setExternalTimetable] = useState<Record<string, Period[]> | null>(null)
  const [timetableSource, setTimetableSource] = useState<string | null>(null)

  const timetableData: Record<string, Period[]> = useMemo(() => {
    if (externalTimetable) return externalTimetable
    return currentWeek === "A" ? timetableWeekA : timetableWeekB
  }, [currentWeek, externalTimetable])

  // Try to fetch external timetable on mount
  useEffect(() => {
    let cancelled = false
    // Helper: attempt to parse timetable HTML into per-day map
    function parseTimetableHtml(html: string): Record<string, Period[]> {
      const byDay: Record<string, Period[]> = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] }
      try {
        const parser = new DOMParser()
        const doc = parser.parseFromString(html, 'text/html')

        // 1) Look for sections with day headings followed by a table
        const headings = Array.from(doc.querySelectorAll('h2, h3, h4'))
        const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
        for (const h of headings) {
          const text = (h.textContent || '').trim()
          const matched = dayNames.find((d) => text.toLowerCase().includes(d.toLowerCase()))
          if (matched) {
            // try to find next table sibling
            let next: Element | null = h.nextElementSibling
            while (next && next.tagName.toLowerCase() !== 'table') next = next.nextElementSibling
            if (next && next.tagName.toLowerCase() === 'table') {
              const rows = Array.from(next.querySelectorAll('tr'))
              for (let i = 0; i < rows.length; i++) {
                const cols = Array.from(rows[i].querySelectorAll('td, th')).map((c) => (c.textContent || '').trim())
                if (cols.length >= 3) {
                  byDay[matched].push({ period: cols[0] || '', time: cols[1] || '', subject: cols[2] || '', teacher: cols[3] || '' , room: cols[4] || '' })
                }
              }
            }
          }
        }

        // 2) If no per-day tables found, look for a table with class 'timetable' or first table and attempt to parse rows
        const anyHasData = Object.values(byDay).some((arr) => arr.length > 0)
        if (!anyHasData) {
          const table = doc.querySelector('table.timetable, table[class*=timetable], .timetable table, table')
          if (table) {
            const rows = Array.from(table.querySelectorAll('tr'))
            // Try to detect a day column in the table header
            const headerCols = Array.from(table.querySelectorAll('tr:first-child th, tr:first-child td')).map((h) => (h.textContent || '').toLowerCase())
            const hasDayCol = headerCols.some((h) => /day|weekday|date/.test(h))
            for (let i = 1; i < rows.length; i++) {
              const cols = Array.from(rows[i].querySelectorAll('td, th')).map((c) => (c.textContent || '').trim())
              if (cols.length >= 3) {
                let day = 'Monday'
                if (hasDayCol) {
                  const dayCell = cols[0]
                  const matched = dayNames.find((d) => dayCell.toLowerCase().includes(d.toLowerCase()))
                  if (matched) day = matched
                } else {
                  // Best-effort: assign to current day
                  day = getCurrentDay()
                }
                byDay[day].push({ period: cols[0] || '', time: cols[1] || '', subject: cols[2] || '', teacher: cols[3] || '' , room: cols[4] || '' })
              }
            }
          }
        }
      } catch (e) {
        // parsing failed; return empty map
      }
      return byDay
    }

    async function loadExternal() {
      try {
        const maxAttempts = 3
        let attempt = 0
        const wait = (ms: number) => new Promise((res) => setTimeout(res, ms))

        while (attempt < maxAttempts && !cancelled) {
          // Probe userinfo to check if session is authenticated
          let userinfoOk = false
          try {
            const ui = await fetch('/api/portal/userinfo', { credentials: 'include' })
            const ctype = ui.headers.get('content-type') || ''
            if (ui.ok && ctype.includes('application/json')) {
              userinfoOk = true
            }
          } catch (e) {
            // ignore and proceed to handshake
          }

          // Try to fetch timetable if userinfo looked good
          if (userinfoOk) {
            try {
              const r = await fetch('/api/timetable', { credentials: 'include' })
              const rctype = r.headers.get('content-type') || ''

              // If timetable endpoint returned JSON, use it
              if (r.ok && rctype.includes('application/json')) {
                const j = await r.json()
                if (j == null) return
                // If j.timetable is an object keyed by day, use it directly
                if (j.timetable && typeof j.timetable === 'object' && !Array.isArray(j.timetable)) {
                  if (!cancelled) {
                    setExternalTimetable(j.timetable)
                    setTimetableSource(j.source ?? 'external')
                  }
                  return
                }
                // If j.timetable is an array, convert into per-day buckets
                if (Array.isArray(j.timetable)) {
                  const byDay: Record<string, Period[]> = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] }
                  for (const p of j.timetable) {
                    const day = p.day || p.weekday || 'Monday'
                    if (!byDay[day]) byDay[day] = []
                    byDay[day].push(p)
                  }
                  if (!cancelled) {
                    setExternalTimetable(byDay)
                    setTimetableSource(j.source ?? 'external')
                  }
                  return
                }
              }

              // If response is HTML (login page or scraped timetable), try to parse it client-side
              if (r.ok && rctype.includes('text/html')) {
                const text = await r.text()
                const parsed = parseTimetableHtml(text)
                const hasData = Object.values(parsed).some((arr) => arr.length > 0)
                if (hasData && !cancelled) {
                  setExternalTimetable(parsed)
                  setTimetableSource('external-scraped')
                  return
                }
              }
            } catch (e) {
              // fallthrough to handshake below
            }
          }

          // If we reach here, either userinfo wasn't authenticated or timetable returned non-json (likely HTML login)
          // Run server-side handshake to try to set cookies for this browser session, then wait and retry
          try {
            // POST initiates a handshake which attempts to set cookies on the response
            await fetch('/api/portal/handshake', { method: 'POST', credentials: 'include' })
          } catch (e) {
            // ignore handshake errors
          }

          attempt += 1
          // Wait briefly for cookies to be persisted by browser, then retry
          await wait(1200)
        }

        // After attempts exhausted, fall back to bundled sample data
        if (!cancelled) {
          setExternalTimetable(null)
          setTimetableSource('fallback-sample')
        }
      } catch (e) {
        // Ensure we still fall back if something unexpected happens
        if (!cancelled) {
          setExternalTimetable(null)
          setTimetableSource('fallback-sample')
        }
      }
    }
    loadExternal()
    return () => { cancelled = true }
  }, [])

  // Function to update all relevant time-based states
  const updateAllTimeStates = useCallback(() => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    const now = new Date()

    // 1. Determine day for main timetable display
    let dayForMainTimetable = now
    let showingNextDayFlag = false
    if (isSchoolDayOver()) {
      dayForMainTimetable = getNextSchoolDay(now)
      showingNextDayFlag = true
    }
    const mainTimetableDayName = days[dayForMainTimetable.getDay()]
    setSelectedDay(
      mainTimetableDayName === "Sunday" || mainTimetableDayName === "Saturday" ? "Monday" : mainTimetableDayName,
    )
    setSelectedDateObject(dayForMainTimetable) // Set the actual Date object
    setIsShowingNextDay(showingNextDayFlag)

    // 2. Calculate current moment's period info (always based on actual current day)
    const actualCurrentDayName = getCurrentDay() // Use getCurrentDay for the actual day
    if (actualCurrentDayName !== "Sunday" && actualCurrentDayName !== "Saturday") {
      const actualTodayTimetable = timetableData[actualCurrentDayName]
      const info = getTimeUntilNextPeriod(actualTodayTimetable)
      setCurrentMomentPeriodInfo(info)
    } else {
      setCurrentMomentPeriodInfo({
        nextPeriod: null,
        timeUntil: "No classes",
        isCurrentlyInClass: false,
        currentPeriod: null,
      })
    }
  }, [timetableData]) // timetableData is a dependency because it's used to get actualTodayTimetable

  // Initial update and 1-second interval for all time-based states
  useEffect(() => {
    updateAllTimeStates()
    const interval = setInterval(updateAllTimeStates, 1000)
    return () => clearInterval(interval)
  }, [updateAllTimeStates])

  return (
    <TimetableContext.Provider
      value={{
        currentWeek,
        setCurrentWeek,
        selectedDay,
        selectedDateObject, // Provide the new state
        setSelectedDay,
        timetableData,
        currentMomentPeriodInfo, // Provide the new state
        // Backwards-compatible alias for older components
        nextPeriodInfo: currentMomentPeriodInfo,
        bellTimes: bellTimesData,
        isShowingNextDay,
        timetableSource,
      }}
    >
      {children}
    </TimetableContext.Provider>
  )
}

// Create a hook to use the timetable context
export function useTimetable() {
  const context = useContext(TimetableContext)
  if (context === undefined) {
    throw new Error("useTimetable must be used within a TimetableProvider")
  }
  return context
}

