"use client"

import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from "react"
import { applySubstitutionsToTimetable } from "@/lib/api/data-adapters"
import { getTimeUntilNextPeriod, isSchoolDayOver, getNextSchoolDay, getCurrentDay } from "@/utils/time-utils"

// Define the period type
export type Period = {
  id?: number
  period: string
  time: string
  subject: string
  teacher: string
  room: string
  weekType?: "A" | "B"
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
  isLoading: boolean
  error: string | null
  // Trigger an in-place retry (handshake + fetch) to attempt to load live timetable again
  refreshExternal?: () => Promise<void>
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
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const timetableData: Record<string, Period[]> = useMemo(() => {
    if (externalTimetable) {
      const filtered: Record<string, Period[]> = {}
      for (const [day, periods] of Object.entries(externalTimetable)) {
        const list = Array.isArray(periods) ? periods : []
        filtered[day] = list.filter((p) => !p.weekType || p.weekType === currentWeek)
      }
      // Ensure break periods (Recess, Lunch 1, Lunch 2) exist using bellTimesData
      const getBellForDay = (dayName: string) => {
        if (dayName === 'Friday') return bellTimesData.Fri
        if (dayName === 'Wednesday' || dayName === 'Thursday') return bellTimesData['Wed/Thurs']
        return bellTimesData['Mon/Tues']
      }

      const parseStartMinutes = (timeStr: string) => {
        try {
          const part = (timeStr || '').split('-')[0].trim()
          const [h, m] = part.split(':').map((s) => parseInt(s, 10))
          if (Number.isFinite(h) && Number.isFinite(m)) return h * 60 + m
        } catch (e) {}
        return 0
      }

      for (const day of Object.keys(filtered)) {
        const bells = getBellForDay(day) || []
        const dayPeriods = filtered[day]

        // For each bell entry that represents a break (contains 'Recess' or 'Lunch'), ensure a period exists
        for (const b of bells) {
          const label = b.period // e.g., 'Recess' or 'Lunch 1'
          if (!/recess|lunch/i.test(label)) continue
          const exists = dayPeriods.some((p) => p.subject === 'Break' && (p.period || '').toLowerCase() === label.toLowerCase())
          if (!exists) {
            // Insert as a Break period with the bell time
            dayPeriods.push({ period: label, time: b.time, subject: 'Break', teacher: '', room: '' })
          }
        }

        // Sort periods by start time to keep ordering
        dayPeriods.sort((a, z) => parseStartMinutes(a.time) - parseStartMinutes(z.time))
        filtered[day] = dayPeriods
      }

      return filtered
    }
    return currentWeek === "A" ? timetableWeekA : timetableWeekB
  }, [currentWeek, externalTimetable])

  // Track whether substitutions have been applied to the current external timetable
  const subsAppliedRef = useRef<number | null>(null)

  // When an external timetable is loaded, attempt to fetch live substitutions and apply them once.
  useEffect(() => {
    if (!externalTimetable) return
    if (!timetableSource) return
    if (timetableSource === 'fallback-sample') return
    if (subsAppliedRef.current) return

    let cancelled = false

    ;(async () => {
      try {
        const res = await fetch('/api/portal/substitutions', { credentials: 'include' })
        const ctype = res.headers.get('content-type') || ''
            if (res.ok && ctype.includes('application/json')) {
          const j = await res.json()
          const subs = j.substitutions || []
          if (!cancelled && subs.length > 0) {
            try {
              const applied = applySubstitutionsToTimetable(externalTimetable, subs, { debug: true })
              setExternalTimetable(applied)
              subsAppliedRef.current = Date.now()
            } catch (e) {
              // ignore apply errors
            }
          } else {
            subsAppliedRef.current = Date.now()
          }
        }
      } catch (e) {
        // ignore network errors
      }
    })()

    return () => { cancelled = true }
  }, [externalTimetable, timetableSource])

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
      setIsLoading(true)
      setError(null)
      try {
        const maxAttempts = 3
        let attempt = 0
        const wait = (ms: number) => new Promise((res) => setTimeout(res, ms))

        while (attempt < maxAttempts && !cancelled) {
          try {
            // Try the portal homepage server-scraped endpoint first for most reliable HTML parsing
            try {
              const ht = await fetch('/api/portal/home-timetable', { credentials: 'include' })
              const htctype = ht.headers.get('content-type') || ''
              if (ht.ok && htctype.includes('application/json')) {
                const jht = await ht.json()
                if (jht && jht.timetable && typeof jht.timetable === 'object' && !Array.isArray(jht.timetable)) {
                  if (!cancelled) {
                    // apply substitutions if available
                    try {
                      const subsRes = await fetch('/api/portal/substitutions', { credentials: 'include' })
                      const subsCtype = subsRes.headers.get('content-type') || ''
                      if (subsRes.ok && subsCtype.includes('application/json')) {
                        const subsJson = await subsRes.json()
                        const applied = applySubstitutionsToTimetable(jht.timetable, subsJson.substitutions || [], { debug: true })
                        setExternalTimetable(applied)
                      } else {
                        setExternalTimetable(jht.timetable)
                      }
                      setTimetableSource(jht.source ?? 'external-homepage')
                    } catch (e) {
                      setExternalTimetable(jht.timetable)
                      setTimetableSource(jht.source ?? 'external-homepage')
                    }
                  }
                  return
                }
              } else if (htctype.includes('text/html')) {
                const html = await ht.text()
                const parsedHt = parseTimetableHtml(html)
                const hasHt = Object.values(parsedHt).some((arr) => arr.length > 0)
                  if (hasHt && !cancelled) {
                    try {
                      const subsRes = await fetch('/api/portal/substitutions', { credentials: 'include' })
                      const subsCtype = subsRes.headers.get('content-type') || ''
                      if (subsRes.ok && subsCtype.includes('application/json')) {
                        const subsJson = await subsRes.json()
                        const applied = applySubstitutionsToTimetable(parsedHt, subsJson.substitutions || [], { debug: true })
                        setExternalTimetable(applied)
                      } else {
                        setExternalTimetable(parsedHt)
                      }
                      setTimetableSource('external-homepage')
                    } catch (e) {
                      setExternalTimetable(parsedHt)
                      setTimetableSource('external-homepage')
                    }
                    return
                  }
              }
            } catch (e) {
              // ignore home-timetable fetch errors and fall back to homepage or /api/timetable below
            }

            // Try the raw portal homepage as a secondary HTML source
            try {
              const hp = await fetch('/api/portal/homepage', { credentials: 'include' })
              const hctype = hp.headers.get('content-type') || ''
              if (hp.ok && hctype.includes('text/html')) {
                const html = await hp.text()
                const parsedHp = parseTimetableHtml(html)
                const hasHp = Object.values(parsedHp).some((arr) => arr.length > 0)
                  if (hasHp && !cancelled) {
                    try {
                      const subsRes = await fetch('/api/portal/substitutions', { credentials: 'include' })
                      const subsCtype = subsRes.headers.get('content-type') || ''
                      if (subsRes.ok && subsCtype.includes('application/json')) {
                        const subsJson = await subsRes.json()
                        const applied = applySubstitutionsToTimetable(parsedHp, subsJson.substitutions || [], { debug: true })
                        setExternalTimetable(applied)
                      } else {
                        setExternalTimetable(parsedHp)
                      }
                      setTimetableSource('external-homepage')
                    } catch (e) {
                      setExternalTimetable(parsedHp)
                      setTimetableSource('external-homepage')
                    }
                    return
                  }
              } else if (hctype.includes('application/json') && hp.ok) {
                try {
                  const jhp = await hp.json()
                  if (jhp && jhp.timetable) {
                    if (typeof jhp.timetable === 'object' && !Array.isArray(jhp.timetable)) {
                      if (!cancelled) {
                        setExternalTimetable(jhp.timetable)
                        setTimetableSource(jhp.source ?? 'external-homepage')
                      }
                      return
                    }
                  }
                } catch (e) {
                  // ignore JSON parse errors
                }
              }
            } catch (e) {
              // ignore homepage fetch errors and fall back to /api/timetable below
            }

            const r = await fetch('/api/timetable', { credentials: 'include' })
            if (r.status === 401) {
              try {
                await fetch('/api/auth/refresh', { credentials: 'include' })
              } catch (e) {
                // ignore refresh errors and continue to handshake fallback
              }
              attempt += 1
              await wait(800)
              continue
            }
            const rctype = r.headers.get('content-type') || ''

            // If timetable endpoint returned JSON, use it
            if (rctype.includes('application/json')) {
              const j = await r.json()
              if (j == null) return
              if (j.timetable && typeof j.timetable === 'object' && !Array.isArray(j.timetable)) {
                if (!cancelled) {
                  setExternalTimetable(j.timetable)
                  setTimetableSource(j.source ?? 'external')
                  if (j.weekType === 'A' || j.weekType === 'B') setCurrentWeek(j.weekType)
                }
                return
              }
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
                  if (j.weekType === 'A' || j.weekType === 'B') setCurrentWeek(j.weekType)
                }
                return
              }
            }

            // If response is HTML (login page or HTML timetable), try to parse it client-side — even if status is not OK
            if (rctype.includes('text/html')) {
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
            // ignore fetch errors and proceed to handshake
          }

          // Attempt a handshake to establish session cookies, then retry
          try {
            await fetch('/api/portal/handshake', { method: 'POST', credentials: 'include' })
          } catch (e) {
            // ignore handshake errors
          }
          attempt += 1
          await wait(1200)
        }

        // After attempts exhausted, fall back to bundled sample data
        if (!cancelled) {
          setExternalTimetable(null)
          setTimetableSource('fallback-sample')
          setError("Could not connect to school portal. Showing sample data.")
        }
      } catch (e) {
        if (!cancelled) {
          setExternalTimetable(null)
          setTimetableSource('fallback-sample')
          setError("An error occurred while fetching timetable.")
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    loadExternal()
    return () => { cancelled = true }
  }, [])

  // Expose a refresh function so UI can trigger a retry without reloading the page
  async function refreshExternal(attemptedRefresh = false): Promise<void> {
    setIsLoading(true)
    setError(null)
    // First try the server-scraped homepage endpoint
    try {
      const ht = await fetch('/api/portal/home-timetable', { credentials: 'include' })
      const htctype = ht.headers.get('content-type') || ''
      if (ht.ok && htctype.includes('application/json')) {
        const jht = await ht.json()
        if (jht && jht.timetable && typeof jht.timetable === 'object' && !Array.isArray(jht.timetable)) {
          setExternalTimetable(jht.timetable)
          setTimetableSource(jht.source ?? 'external-homepage')
          if (jht.weekType === 'A' || jht.weekType === 'B') setCurrentWeek(jht.weekType)
          return
        }
      } else if (htctype.includes('text/html')) {
        const html = await ht.text()
        const parsedHt = parseTimetableHtmlLocal(html)
        const hasHt = Object.values(parsedHt).some((arr) => arr.length > 0)
        if (hasHt) {
          setExternalTimetable(parsedHt)
          setTimetableSource('external-homepage')
          return
        }
      }
    } catch (e) {
      // ignore and continue to next strategies
    }

    // Reuse the parsing logic from above by creating a DOMParser here as well
    function parseTimetableHtmlLocal(html: string): Record<string, Period[]> {
      const byDay: Record<string, Period[]> = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] }
      try {
        const parser = new DOMParser()
        const doc = parser.parseFromString(html, 'text/html')

        const headings = Array.from(doc.querySelectorAll('h2, h3, h4'))
        const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
        for (const h of headings) {
          const text = (h.textContent || '').trim()
          const matched = dayNames.find((d) => text.toLowerCase().includes(d.toLowerCase()))
          if (matched) {
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

        const anyHasData = Object.values(byDay).some((arr) => arr.length > 0)
        if (!anyHasData) {
          const table = doc.querySelector('table.timetable, table[class*=timetable], .timetable table, table')
          if (table) {
            const rows = Array.from(table.querySelectorAll('tr'))
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
                  day = getCurrentDay()
                }
                byDay[day].push({ period: cols[0] || '', time: cols[1] || '', subject: cols[2] || '', teacher: cols[3] || '' , room: cols[4] || '' })
              }
            }
          }
        }
      } catch (e) {
        // ignore
      }
      return byDay
    }

    try {
      // Try a quick probe to determine if userinfo is authenticated
      let userinfoOk = false
      try {
        const ui = await fetch('/api/portal/userinfo', { credentials: 'include' })
        const ctype = ui.headers.get('content-type') || ''
        if (ui.ok && ctype.includes('application/json')) userinfoOk = true
      } catch (e) {
        // ignore
      }

      // Always try timetable first regardless of userinfo; the API route will forward HTML if login is required
      try {
        const r = await fetch('/api/timetable', { credentials: 'include' })
        if (r.status === 401) {
          if (!attemptedRefresh) {
            try {
              await fetch('/api/auth/refresh', { credentials: 'include' })
            } catch (e) {
              // ignore
            }
              return refreshExternal(true)
          }
        }
        const rctype = r.headers.get('content-type') || ''
        if (rctype.includes('application/json')) {
          const j = await r.json()
          if (j && j.timetable) {
            if (typeof j.timetable === 'object' && !Array.isArray(j.timetable)) {
              setExternalTimetable(j.timetable)
              setTimetableSource(j.source ?? 'external')
              if (j.weekType === 'A' || j.weekType === 'B') setCurrentWeek(j.weekType)
              return
            }
            if (Array.isArray(j.timetable)) {
              const byDay: Record<string, Period[]> = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] }
              for (const p of j.timetable) {
                const day = p.day || p.weekday || 'Monday'
                if (!byDay[day]) byDay[day] = []
                byDay[day].push(p)
              }
              setExternalTimetable(byDay)
              setTimetableSource(j.source ?? 'external')
              if (j.weekType === 'A' || j.weekType === 'B') setCurrentWeek(j.weekType)
              return
            }
          }
        }
        if (rctype.includes('text/html')) {
          const text = await r.text()
          const parsed = parseTimetableHtmlLocal(text)
          const hasData = Object.values(parsed).some((arr) => arr.length > 0)
          if (hasData) {
            setExternalTimetable(parsed)
            setTimetableSource('external-scraped')
            return
          }
        }
      } catch (e) {
        // fallthrough to handshake
      }

      // If not authenticated or no usable timetable, try handshake then refetch once
      try {
        await fetch('/api/portal/handshake', { method: 'POST', credentials: 'include' })
      } catch (e) {
        // ignore
      }
      // wait briefly
      await new Promise((res) => setTimeout(res, 900))

      try {
        const r2 = await fetch('/api/timetable', { credentials: 'include' })
        if (r2.status === 401) {
          if (!attemptedRefresh) {
            try {
              await fetch('/api/auth/refresh', { credentials: 'include' })
            } catch (e) {
              // ignore
            }
              return refreshExternal(true)
          }
        }
        const rctype2 = r2.headers.get('content-type') || ''
        if (rctype2.includes('application/json')) {
          const j = await r2.json()
          if (j && j.timetable) {
            if (typeof j.timetable === 'object' && !Array.isArray(j.timetable)) {
              setExternalTimetable(j.timetable)
              setTimetableSource(j.source ?? 'external')
              if (j.weekType === 'A' || j.weekType === 'B') setCurrentWeek(j.weekType)
              return
            }
            if (Array.isArray(j.timetable)) {
              const byDay: Record<string, Period[]> = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] }
              for (const p of j.timetable) {
                const day = p.day || p.weekday || 'Monday'
                if (!byDay[day]) byDay[day] = []
                byDay[day].push(p)
              }
              setExternalTimetable(byDay)
              setTimetableSource(j.source ?? 'external')
              if (j.weekType === 'A' || j.weekType === 'B') setCurrentWeek(j.weekType)
              return
            }
          }
        }
        if (rctype2.includes('text/html')) {
          const text = await r2.text()
          const parsed = parseTimetableHtmlLocal(text)
          const hasData = Object.values(parsed).some((arr) => arr.length > 0)
          if (hasData) {
            setExternalTimetable(parsed)
            setTimetableSource('external-scraped')
            return
          }
        }
      } catch (e) {
        // ignore
      }

      // If we still don't have live data, fall back to sample
      setExternalTimetable(null)
      setTimetableSource('fallback-sample')
      setError("Could not refresh timetable. Showing sample data.")
    } catch (e) {
      setExternalTimetable(null)
      setTimetableSource('fallback-sample')
      setError("An error occurred while refreshing timetable.")
    } finally {
      setIsLoading(false)
    }
  }

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
        isLoading,
        error,
        refreshExternal,
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

