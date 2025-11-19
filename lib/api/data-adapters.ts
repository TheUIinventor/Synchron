"use client"

import type { TimetableEntry, Notice, BellTime, AwardPoint } from "./client"
import type { Period } from "@/contexts/timetable-context"

// Convert API timetable entries to app format
export function adaptTimetableData(entries: TimetableEntry[]): Record<string, Period[]> {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
  const timetable: Record<string, Period[]> = {}

  days.forEach((day) => {
    timetable[day] = []
  })

  entries.forEach((entry) => {
    const dayName = days[entry.dayOfWeek - 1]
    if (dayName) {
      const period: Period = {
        id: Number.parseInt(entry.id),
        period: entry.period,
        time: `${formatTime(entry.startTime)} - ${formatTime(entry.endTime)}`,
        subject: entry.subject,
        teacher: entry.teacher,
        room: entry.room,
      }
      timetable[dayName].push(period)
    }
  })

  // Sort periods by start time for each day
  Object.keys(timetable).forEach((day) => {
    timetable[day].sort((a, b) => {
      const timeA = a.time.split(" - ")[0]
      const timeB = b.time.split(" - ")[0]
      return timeA.localeCompare(timeB)
    })
  })

  return timetable
}

// Convert API bell times to app format
export function adaptBellTimesData(bellTimes: BellTime[]): Record<string, { period: string; time: string }[]> {
  const schedules: Record<string, { period: string; time: string }[]> = {
    "Mon/Tues": [],
    "Wed/Thurs": [],
    Fri: [],
  }

  bellTimes.forEach((bell) => {
    const bellEntry = {
      period: bell.period,
      time: bell.endTime ? `${formatTime(bell.startTime)} - ${formatTime(bell.endTime)}` : formatTime(bell.startTime),
    }

    switch (bell.dayPattern) {
      case "mon-tue":
        schedules["Mon/Tues"].push(bellEntry)
        break
      case "wed-thu":
        schedules["Wed/Thurs"].push(bellEntry)
        break
      case "fri":
        schedules["Fri"].push(bellEntry)
        break
    }
  })

  return schedules
}

// Convert API notices to app format
export function adaptNoticesData(notices: Notice[]) {
  return notices.map((notice) => ({
    id: Number.parseInt(notice.id),
    title: notice.title,
    content: notice.content,
    category: notice.category,
    date: formatDate(notice.publishedDate),
    isPinned: notice.isPinned,
  }))
}

// Apply substitutions/variations to an existing timetable (in-place copy)
export function applySubstitutionsToTimetable(
  timetable: Record<string, Period[]>,
  substitutions: Array<{
    date?: string
    period?: string
    subject?: string
    originalTeacher?: string
    substituteTeacher?: string
    fromRoom?: string
    toRoom?: string
    reason?: string
  }>
): Record<string, Period[]> {
  // Create shallow copy of timetable structure
  const result: Record<string, Period[]> = {}
  Object.keys(timetable).forEach((d) => {
    result[d] = timetable[d].map((p) => ({ ...p }))
  })

  // Simple heuristic: match substitution by period string and subject (if provided)
  substitutions.forEach((sub) => {
    if (!sub) return
    // If date is present, try to map to day name; otherwise apply across all days
    const candidateDays = (() => {
      if (sub.date) {
        try {
          const d = new Date(sub.date)
          if (!isNaN(d.getTime())) {
            const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
            const name = names[d.getDay()]
            return [name]
          }
        } catch (e) {
          // ignore parse errors and fall back to all days
        }
        // try to match textual day names
        const dayNames = Object.keys(result)
        const found = dayNames.filter((dn) => sub.date && dn.toLowerCase().includes(sub.date.toLowerCase()))
        if (found.length > 0) return found
      }
      return Object.keys(result)
    })()

    // normalizers for comparison
    const normalize = (s?: string) => (s || "").toString().toLowerCase().replace(/[^a-z0-9]/g, "").trim()

    candidateDays.forEach((day) => {
      result[day].forEach((period) => {
        // Normalize period identifiers: allow matching "1", "Period 1", "p1"
        const subPeriodNorm = normalize(sub.period)
        const periodNorm = normalize(period.period)

        const periodMatch = sub.period ? (subPeriodNorm === periodNorm || periodNorm.endsWith(subPeriodNorm) || subPeriodNorm.endsWith(periodNorm)) : true

        // Subject match: fuzzy contains or exact after normalization
        const subjectMatch = sub.subject ? normalize(period.subject).includes(normalize(sub.subject)) || normalize(sub.subject).includes(normalize(period.subject)) : true

        if (periodMatch && subjectMatch) {
          // Replace teacher and room values when substitution provides them
          if (sub.substituteTeacher && sub.substituteTeacher !== period.teacher) {
            period.isSubstitute = true
            period.teacher = sub.substituteTeacher
          }
          if (sub.toRoom && sub.toRoom !== period.room) {
            period.isRoomChange = true
            period.room = sub.toRoom
          }
          // Also handle cases where only 'room' or 'replacement' fields are present
          if (!sub.toRoom && (sub.fromRoom || sub.room)) {
            const newRoom = sub.room || sub.fromRoom
            if (newRoom && newRoom !== period.room) {
              period.isRoomChange = true
              period.room = newRoom
            }
          }
        }
      })
    })
  })

  return result
}

// Convert API award points to app format
export function adaptAwardPointsData(awards: AwardPoint[]) {
  return awards.map((award) => ({
    id: Number.parseInt(award.id),
    title: award.title,
    points: award.points,
    date: formatDate(award.awardedDate),
    category: capitalizeFirst(award.category),
    description: award.description,
  }))
}

// Helper functions
function formatTime(timeString: string): string {
  // Convert from ISO time format or 24h format to display format
  const date = new Date(`2000-01-01T${timeString}`)
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  })
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
