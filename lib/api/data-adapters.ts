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
      const timeA = (a.time || '').split(" - ")[0]
      const timeB = (b.time || '').split(" - ")[0]
      return String(timeA).localeCompare(String(timeB))
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
    room?: string
  }>,
  options?: { debug?: boolean }
): Record<string, Period[]> {
  // Create shallow copy of timetable structure
  const result: Record<string, Period[]> = {}
  Object.keys(timetable).forEach((d) => {
    result[d] = timetable[d].map((p) => ({ ...p }))
  })

  // Simple heuristic: match substitution by period string and subject (if provided)
  if (options?.debug) {
    try { console.debug('[adapters] applySubstitutionsToTimetable subs=', substitutions ? substitutions.length : 0, substitutions && substitutions[0] ? substitutions[0] : null) } catch (e) {}
  }

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
          // Track whether we changed anything for debug output
          let changed = false

          // Replace teacher when substitution provides one. Prefer any
          // normalized full-name for display (substituteTeacherFull) but
          // keep the short code in `teacher` as a fallback.
          // Accept either a short substitute code/name or a provided full name.
          const hasShortSub = !!sub.substituteTeacher && String(sub.substituteTeacher).trim().length > 0
          const hasFullSub = !!(sub as any).substituteTeacherFull && String((sub as any).substituteTeacherFull).trim().length > 0

          if (hasShortSub || hasFullSub) {
            period.isSubstitute = true
            const prev = period.teacher
            // Preserve the original teacher so UI can show it for other days
            if (!(period as any).originalTeacher) (period as any).originalTeacher = prev

            // If a short substitute identifier is provided, update the `teacher` field
            if (hasShortSub) {
              period.teacher = sub.substituteTeacher as string
            }

            // Prefer an available full name for display
            if (hasFullSub) {
              (period as any).fullTeacher = String((sub as any).substituteTeacherFull)
              if (options?.debug) console.debug(`Applied substitute teacher (full name provided): ${prev} -> ${period.teacher || (period as any).fullTeacher} / ${ (period as any).fullTeacher } (day=${day} period=${period.period} subject=${period.subject})`)
            } else if (hasShortSub) {
              // No full name provided; use the short substitute for display too
              (period as any).fullTeacher = String(sub.substituteTeacher)
              if (options?.debug) console.debug(`Applied substitute teacher (short name only): ${prev} -> ${period.teacher} (day=${day} period=${period.period} subject=${period.subject})`, sub)
            }

            // Preserve casualSurname separately when provided by the upstream data.
            // If upstream provides both a casual token (e.g. initial) and a
            // casualSurname, combine them so downstream UI can display the
            // exact casual form (e.g. "M Finegan"). When a casual surname is
            // provided we should prefer it for on-screen display even if a
            // full name is not supplied; this prevents short placeholder codes
            // from appearing after background refreshes.
            if ((sub as any).casualSurname) {
              // Upstream often provides a short casual token (e.g. a 4-letter
              // code) *and* a casualSurname (e.g. "V Likourezos"). For UI
              // clarity we should prefer the casualSurname exactly as provided
              // rather than prepending the casual token. Store the casual token
              // separately if present and keep `casualSurname` clean.
              const casualToken = (sub as any).casual ? String((sub as any).casual).trim() : ''
              const surname = String((sub as any).casualSurname).trim()
              ;(period as any).casualToken = casualToken || undefined
              ;(period as any).casualSurname = surname
              // Make the casual surname the authoritative displayed teacher
              period.teacher = surname
            }

            // If no casualSurname was provided but a full display name exists,
            // prefer that for the displayed teacher value.
            else if ((period as any).fullTeacher) {
              period.teacher = String((period as any).fullTeacher)
            }

            changed = true
          }

          // Prefer explicit toRoom as the authoritative destination. Only
          // treat this as a room change when `toRoom` is explicitly provided
          // and differs from the scheduled room (compare trimmed, case-insensitive).
          const toRoomProvided = typeof sub.toRoom !== 'undefined' && sub.toRoom !== null && String(sub.toRoom).trim().length > 0
          const fromRoomProvided = typeof (sub as any).fromRoom !== 'undefined' && (sub as any).fromRoom !== null && String((sub as any).fromRoom).trim().length > 0
          const normalizeRoom = (r?: string) => (r || '').toString().trim().toLowerCase()
          if (toRoomProvided) {
            const candidateRoom = String(sub.toRoom).trim()
            // If the substitution provides a `fromRoom`, ensure we only
            // apply this room change when the scheduled room matches the
            // provided `fromRoom`. This prevents accidental global room
            // replacements when `toRoom` is present but not intended for
            // all matching subjects/periods.
            if (fromRoomProvided) {
              const providedFrom = String((sub as any).fromRoom).trim()
              if (normalizeRoom(providedFrom) !== normalizeRoom(period.room)) {
                // scheduled room differs from fromRoom -> skip
              } else {
                if (normalizeRoom(candidateRoom) !== normalizeRoom(period.room)) {
                  period.isRoomChange = true
                  const prevRoom = period.room
                  ;(period as any).displayRoom = candidateRoom
                  changed = true
                  try { console.debug('[adapters] applied toRoom -> displayRoom', { day, period: period.period, subject: period.subject, prevRoom, toRoom: candidateRoom }) } catch (e) {}
                }
              }
            } else {
              if (normalizeRoom(candidateRoom) !== normalizeRoom(period.room)) {
                // Do not overwrite the original `room` value from the API.
                // Instead, set a non-destructive `displayRoom` field which the
                // UI will prefer when rendering destination rooms.
                period.isRoomChange = true
                const prevRoom = period.room
                ;(period as any).displayRoom = candidateRoom
                changed = true
                try {
                  console.debug('[adapters] applied toRoom -> displayRoom', { day, period: period.period, subject: period.subject, prevRoom, toRoom: candidateRoom })
                } catch (e) {}
              }
            }
          } else {
            // For debugging: if a substitution provides `room` or `fromRoom`
            // but not an explicit `toRoom`, report this when debug enabled.
            const fallbackRoom = typeof sub.room !== 'undefined' && sub.room !== null && String(sub.room).trim().length > 0 ? String(sub.room).trim() :
              (typeof sub.fromRoom !== 'undefined' && sub.fromRoom !== null && String(sub.fromRoom).trim().length > 0 ? String(sub.fromRoom).trim() : undefined)
            if (fallbackRoom) {
              if (normalizeRoom(fallbackRoom) !== normalizeRoom(period.room)) {
                // Do not overwrite the original `room`. Store the fallback
                // in `displayRoom` for UI-only rendering. Do NOT mark
                // `isRoomChange` because there's no explicit `toRoom`.
                const prevRoom = period.room
                ;(period as any).displayRoom = fallbackRoom
                changed = true
                try { console.debug('[adapters] applied fallback->displayRoom', { day, period: period.period, subject: period.subject, prevRoom, fallbackRoom }) } catch (e) {}
              } else if (options?.debug) {
                console.debug(`Fallback room provided but equal to scheduled room: ${fallbackRoom} (day=${day} period=${period.period})`)
              }
            }
          }

          if (options?.debug && !changed) {
            console.debug(`Matched substitution but no field replacements: (day=${day} period=${period.period} subject=${period.subject})`, sub)
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
