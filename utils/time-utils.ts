// Get current time in 12-hour format (HH:MM:SS AM/PM)
export const getCurrentTime = (): string => {
  const now = new Date()
  return formatTo12HourWithSeconds(now)
}

// Format time to 12-hour format with seconds
export const formatTo12HourWithSeconds = (date: Date): string => {
  let hours = date.getHours()
  const minutes = date.getMinutes().toString().padStart(2, "0")
  const seconds = date.getSeconds().toString().padStart(2, "0")
  const ampm = hours >= 12 ? "PM" : "AM"
  hours = hours % 12
  hours = hours ? hours : 12 // the hour '0' should be '12'
  return `${hours}:${minutes}:${seconds} ${ampm}`
}

// Format time to 12-hour format (without seconds)
export const formatTo12Hour = (date: Date): string => {
  let hours = date.getHours()
  const minutes = date.getMinutes().toString().padStart(2, "0")
  const ampm = hours >= 12 ? "PM" : "AM"
  hours = hours % 12
  hours = hours ? hours : 12 // the hour '0' should be '12'
  return `${hours}:${minutes} ${ampm}`
}

// Parse time string (e.g., "8:45 - 9:45") to get start and end times
export const parseTimeRange = (timeRange: string): { start: Date; end: Date } => {
  // Defensive: handle missing or malformed input. Instead of returning a
  // far-future sentinel for simple single-time values (e.g. "3:10 PM"),
  // attempt to parse single timestamps as start times.
  if (!timeRange || typeof timeRange !== 'string') {
    const far = new Date(8640000000000000)
    return { start: far, end: far }
  }

  const parsePart = (part: string): { hour: number; minute: number } | null => {
    try {
      const raw = String(part || '').trim()
      // match like "9:00", "9:00 AM", "09:00 pm"
      const m = raw.match(/^(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?/) 
      if (!m) return null
      let h = Number.parseInt(m[1], 10)
      const min = Number.parseInt(m[2], 10)
      const ampm = m[3]
      if (ampm) {
        const a = String(ampm).toLowerCase()
        if (a === 'pm' && h < 12) h += 12
        if (a === 'am' && h === 12) h = 0
      }
      return { hour: h, minute: min }
    } catch (e) { return null }
  }

  const parts = timeRange.split(' - ')
  const now = new Date()
  if (parts.length === 1) {
    // single time like "3:10 PM" or "09:00" - use it as both start and end
    const p = parsePart(parts[0])
    if (!p) {
      const far = new Date(8640000000000000)
      return { start: far, end: far }
    }
    const s = new Date(now)
    s.setHours(p.hour, p.minute, 0, 0)
    const e = new Date(s)
    e.setMinutes(e.getMinutes())
    return { start: s, end: e }
  }

  const startParsed = parsePart(parts[0])
  const endParsed = parsePart(parts[1])
  if (!startParsed || !endParsed) {
    const far = new Date(8640000000000000)
    return { start: far, end: far }
  }

  const startDate = new Date(now)
  startDate.setHours(startParsed.hour, startParsed.minute, 0, 0)
  const endDate = new Date(now)
  endDate.setHours(endParsed.hour, endParsed.minute, 0, 0)
  return { start: startDate, end: endDate }
}

// Calculate time until next period with seconds precision
export const getTimeUntilNextPeriod = (
  currentPeriods: Array<{ period: string; time: string; subject: string; teacher: string; room: string }>,
): {
  nextPeriod: { period: string; time: string; subject: string; teacher: string; room: string } | null
  nextPeriodStart?: Date | null
  timeUntil: string
  isCurrentlyInClass: boolean
  currentPeriod: { period: string; time: string; subject: string; teacher: string; room: string } | null
} => {
  const now = new Date()

  // Find current period
  let currentPeriod: { period: string; time: string; subject: string; teacher: string; room: string } | null = null
  for (const period of currentPeriods) {
    const { start, end } = parseTimeRange(period.time)
    if (now >= start && now <= end) {
      currentPeriod = period
      break
    }
  }

  // Find next period
  let nextPeriod = null
  let timeUntil = ""
  let isCurrentlyInClass = false

  if (currentPeriod) {
    // Currently in a period
    isCurrentlyInClass = true
    const { end } = parseTimeRange(currentPeriod.time)
    const diffMs = end.getTime() - now.getTime()

    // Find the next period after current
  const currentIndex = currentPeriods.findIndex((p) => p.period === currentPeriod?.period)
    if (currentIndex < currentPeriods.length - 1) {
      nextPeriod = currentPeriods[currentIndex + 1]
      // include start date for the next period (anchored to today)
      try {
        const { start } = parseTimeRange((nextPeriod as any).time)
        ;(nextPeriod as any).__start = start
      } catch (e) {}
    }

    // Format time remaining in current period with seconds
    const totalSeconds = Math.floor(diffMs / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    if (hours > 0) {
      timeUntil = `${hours}h ${minutes}m ${seconds}s until end`
    } else if (minutes > 0) {
      timeUntil = `${minutes}m ${seconds}s until end`
    } else {
      timeUntil = `${seconds}s until end`
    }
  } else {
    // Not currently in a period, find the next one
    for (const period of currentPeriods) {
      const { start } = parseTimeRange(period.time)
      if (now < start) {
        nextPeriod = period

        // attach start Date so callers can determine the exact day/time
        ;(nextPeriod as any).__start = start

        const diffMs = start.getTime() - now.getTime()
        const totalSeconds = Math.floor(diffMs / 1000)
        const hours = Math.floor(totalSeconds / 3600)
        const minutes = Math.floor((totalSeconds % 3600) / 60)
        const seconds = totalSeconds % 60

        if (hours > 0) {
          timeUntil = `${hours}h ${minutes}m ${seconds}s until start`
        } else if (minutes > 0) {
          timeUntil = `${minutes}m ${seconds}s until start`
        } else {
          timeUntil = `${seconds}s until start`
        }

        break
      }
    }
  }

  // If no next period found (end of day)
  if (!nextPeriod && !isCurrentlyInClass) {
    timeUntil = "No more classes today"
  }

  // Expose canonical nextPeriodStart if available
  const nextPeriodStart = (nextPeriod && (nextPeriod as any).__start) ? (nextPeriod as any).__start : null

  return { nextPeriod, nextPeriodStart, timeUntil, isCurrentlyInClass, currentPeriod }
}

// Parse a time range but anchored to a specific date. Returns start/end Date on that date.
export const parseTimeRangeOnDate = (timeRange: string, baseDate: Date): { start: Date; end: Date } => {
  if (!timeRange || typeof timeRange !== 'string') {
    const far = new Date(8640000000000000)
    return { start: far, end: far }
  }

  const parsePart = (part: string): { hour: number; minute: number } | null => {
    try {
      const raw = String(part || '').trim()
      const m = raw.match(/^(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?/)
      if (!m) return null
      let h = Number.parseInt(m[1], 10)
      const min = Number.parseInt(m[2], 10)
      const ampm = m[3]
      if (ampm) {
        const a = String(ampm).toLowerCase()
        if (a === 'pm' && h < 12) h += 12
        if (a === 'am' && h === 12) h = 0
      }
      return { hour: h, minute: min }
    } catch (e) { return null }
  }

  const parts = timeRange.split(' - ')
  const startInfo = parsePart(parts[0] || '')
  const endInfo = parts[1] ? parsePart(parts[1]) : null
  if (!startInfo) {
    const far = new Date(8640000000000000)
    return { start: far, end: far }
  }

  const startDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate())
  startDate.setHours(startInfo.hour, startInfo.minute, 0, 0)
  let endDate: Date
  if (endInfo) {
    endDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate())
    endDate.setHours(endInfo.hour, endInfo.minute, 0, 0)
  } else {
    endDate = new Date(startDate)
  }

  return { start: startDate, end: endDate }
}

// Given a list of periods for a day and a base date, find the first non-break
// period and return its start Date and the period object. Returns null if none.
export const findFirstNonBreakPeriodOnDate = (
  periods: Array<{ period: string; time: string; subject: string; teacher?: string; room?: string }> | undefined,
  baseDate: Date,
): { period: any; start: Date } | null => {
  try {
    if (!periods || !Array.isArray(periods)) return null
    for (const p of periods) {
      const subj = String(p.subject || p.period || '')
      if (/(recess|lunch|break|end of day)/i.test(subj)) continue
      const parsed = parseTimeRangeOnDate(String(p.time || ''), baseDate)
      if (parsed && parsed.start && parsed.start.getTime() < 8640000000000000) {
        return { period: p, start: parsed.start }
      }
    }
  } catch (e) {}
  return null
}

// Format a duration (ms) into "Xh Ym Zs" style (hours/mins/secs), used for countdowns
export const formatDurationShort = (ms: number): string => {
  if (!Number.isFinite(ms) || ms <= 0) return '0s'
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

// Get day of week
export const getCurrentDay = (date: Date = new Date()): string => {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  return days[date.getDay()]
}

// Format date as "Month Day, Year"
export const formatDate = (date: Date = new Date()): string => {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}

// Check if current time is within school hours (8:00 AM to 4:00 PM, or 9:25 AM on Friday)
export const isWithinSchoolHours = (): boolean => {
  const now = new Date()
  const day = now.getDay() // 0 is Sunday, 6 is Saturday

  // Return false for weekends
  if (day === 0 || day === 6) return false

  const hours = now.getHours()
  const minutes = now.getMinutes()

  // Friday (day 5) starts at 9:25 AM
  if (day === 5) {
    // Friday: 9:25 AM to 3:10 PM
    return (hours === 9 && minutes >= 25) || (hours > 9 && hours < 15) || (hours === 15 && minutes < 10)
  }

  // Monday-Thursday: 8:00 AM to 3:10 PM (inclusive of 8:00, exclusive of 3:10)
  return hours >= 8 && (hours < 15 || (hours === 15 && minutes < 10))
}

// Check if the school day is over (after 3:10 PM on a weekday)
export const isSchoolDayOver = (): boolean => {
  const now = new Date()
  const day = now.getDay() // 0 is Sunday, 6 is Saturday

  // Only applies to weekdays
  if (day === 0 || day === 6) return false

  const hours = now.getHours()
  const minutes = now.getMinutes()

  // School day is considered over after 3:10 PM
  return hours > 15 || (hours === 15 && minutes >= 10)
}

// Get the next valid school day (Monday-Friday)
export const getNextSchoolDay = (currentDate: Date): Date => {
  const nextDay = new Date(currentDate)
  nextDay.setDate(currentDate.getDate() + 1)

  const dayOfWeek = nextDay.getDay() // 0 is Sunday, 6 is Saturday

  // If it's Saturday (6), go to Monday (1)
  if (dayOfWeek === 6) {
    nextDay.setDate(nextDay.getDate() + 2)
  }
  // If it's Sunday (0), go to Monday (1)
  else if (dayOfWeek === 0) {
    nextDay.setDate(nextDay.getDate() + 1)
  }

  return nextDay
}
