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
