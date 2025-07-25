import type { BellTime } from "@/contexts/timetable-context"
import { isWithinSchoolHours } from "./time-utils"

// Format time to 12-hour format without AM/PM
const formatTo12HourNoAmPm = (date: Date): string => {
  let hours = date.getHours()
  const minutes = date.getMinutes().toString().padStart(2, "0")
  hours = hours % 12
  hours = hours ? hours : 12 // the hour '0' should be '12'
  return `${hours}:${minutes}`
}

// Parse time string (e.g., "9:00 - 10:05" or "3:10") to get Date object
export const parseBellTime = (timeString: string): { start: Date; end: Date | null } => {
  const now = new Date()

  // Check if it's a time range or just a single time (like "End of Day")
  if (timeString.includes(" - ")) {
    const [startStr, endStr] = timeString.split(" - ")

    const startParts = startStr.trim().split(":")
    const startHour = Number.parseInt(startParts[0], 10)
    const startMinute = Number.parseInt(startParts[1], 10)

    const endParts = endStr.trim().split(":")
    const endHour = Number.parseInt(endParts[0], 10)
    const endMinute = Number.parseInt(endParts[1], 10)

    const startDate = new Date(now)
    startDate.setHours(startHour, startMinute, 0, 0)

    const endDate = new Date(now)
    endDate.setHours(endHour, endMinute, 0, 0)

    return { start: startDate, end: endDate }
  } else {
    // Single time (like "3:10" for End of Day)
    const timeParts = timeString.trim().split(":")
    const hour = Number.parseInt(timeParts[0], 10)
    const minute = Number.parseInt(timeParts[1], 10)

    const startDate = new Date(now)
    startDate.setHours(hour, minute, 0, 0)

    return { start: startDate, end: null }
  }
}

// Format time string to 12-hour format without AM/PM
export const formatTimeTo12Hour = (timeString: string): string => {
  if (timeString.includes(" - ")) {
    const [startStr, endStr] = timeString.split(" - ")

    const startParts = startStr.trim().split(":")
    const startHour = Number.parseInt(startParts[0], 10)
    const startMinute = Number.parseInt(startParts[1], 10)
    const startDate = new Date()
    startDate.setHours(startHour, startMinute, 0, 0)

    const endParts = endStr.trim().split(":")
    const endHour = Number.parseInt(endParts[0], 10)
    const endMinute = Number.parseInt(endParts[1], 10)
    const endDate = new Date()
    endDate.setHours(endHour, endMinute, 0, 0)

    return `${formatTo12HourNoAmPm(startDate)} - ${formatTo12HourNoAmPm(endDate)}`
  } else {
    const timeParts = timeString.trim().split(":")
    const hour = Number.parseInt(timeParts[0], 10)
    const minute = Number.parseInt(timeParts[1], 10)
    const date = new Date()
    date.setHours(hour, minute, 0, 0)

    return formatTo12HourNoAmPm(date)
  }
}

// Calculate time until next bell
export const getNextBell = (
  bellTimes: BellTime[],
): {
  nextBell: BellTime | null
  timeUntil: number
  isCurrentlyInPeriod: boolean
  currentPeriod: BellTime | null
} => {
  const now = new Date()

  // Check if within school hours
  if (!isWithinSchoolHours()) {
    return {
      nextBell: null,
      timeUntil: 0,
      isCurrentlyInPeriod: false,
      currentPeriod: null,
    }
  }

  // Find current period
  let currentPeriod: BellTime | null = null
  for (const bell of bellTimes) {
    if (bell.time.includes(" - ")) {
      const { start, end } = parseBellTime(bell.time)
      if (end && now >= start && now <= end) {
        currentPeriod = bell
        break
      }
    }
  }

  // Find next bell
  let nextBell: BellTime | null = null
  let timeUntil = 0

  if (currentPeriod) {
    // Currently in a period, next bell is the end of this period
    const { end } = parseBellTime(currentPeriod.time)
    if (end) {
      timeUntil = end.getTime() - now.getTime()

      // Find the next period after current
      const currentIndex = bellTimes.findIndex((b) => b.period === currentPeriod?.period)
      if (currentIndex < bellTimes.length - 1) {
        nextBell = bellTimes[currentIndex + 1]
      }
    }

    return {
      nextBell,
      timeUntil,
      isCurrentlyInPeriod: true,
      currentPeriod,
    }
  } else {
    // Not currently in a period, find the next one
    for (const bell of bellTimes) {
      const { start } = parseBellTime(bell.time)
      if (now < start) {
        nextBell = bell
        timeUntil = start.getTime() - now.getTime()
        break
      }
    }

    return {
      nextBell,
      timeUntil,
      isCurrentlyInPeriod: false,
      currentPeriod: null,
    }
  }
}

// Format milliseconds to MM:SS format
export const formatCountdown = (milliseconds: number): string => {
  if (milliseconds <= 0) return "00:00"

  const totalSeconds = Math.floor(milliseconds / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  } else {
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }
}
